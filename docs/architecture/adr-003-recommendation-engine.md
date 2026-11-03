# ADR 003: Recommendation Engine Platform Architecture

**Date**: 2026-11-02 (Updated 2026-11-03)  
**Status**: Proposed / Accepted  
**Authors**: Saumya Bhardwaj (Backend & Platform), Som Pande (Agentic & ML), Devyansh Sehgal (Reviewer)  
**Ticket**: [#110](https://github.com/think-verge/centoire-community/issues/110) (Epic [#101](https://github.com/think-verge/centoire-community/issues/101))

---

## 1. Context & Requirements

Epic #101 introduces the **Stage 0 Recommendation Engine** for Centoire:
- Deliver a personalized "For You" feed built in **< 300 ms**.
- Provide circle and creator recommendations.
- Adapt dynamically using user topic mix (points, decay, exploration share).
- Stage 0 principles: no heavy online deep learning models in the critical path; based on 768-d post embeddings, ~40 k-means topic clusters, and user topic vectors.

We need to establish:
1. **Service Topology**: Where the recommendation service lives in the monorepo and how it calls the Python agent.
2. **Gateway Registration & Auth**: How the service announces itself to the edge Gateway and receives user identity.
3. **Data Stores & Atlas Vector Search Assessment**: Storage tier capacity vs vector indexing.
4. **Event Transport**: NATS JetStream subjects for domain and behavioral events.
5. **Developer & CI Workflow**: Local execution and automated verification.

---

## 2. Decision Summary

| Aspect | Decision | Rationale |
|---|---|---|
| **Service Location** | Dedicated Node.js service: `services/recsys/` (`@centoire/bahamut`) | Manages feed and suggestion APIs, candidate retrieval, and social graph filters. Calls Som's Python agent separately when ML scoring/embeddings are needed. |
| **Gateway Registration** | Built-in Bahamut NATS registration (`gateway.services`) | Follows standard platform topology used by `services/notifications` and `services/search`. Zero custom gateway code. |
| **Authentication** | Gateway validates JWT cookie at the edge and forwards `x-user-id`, `x-user-email`, `x-user-role`, and `x-gateway-secret` | Bahamut `resolveClaims` middleware automatically parses and injects `req.user`. |
| **Data Store Strategy** | Hybrid: Separate `post_embeddings` with TTL + MongoDB B-Tree cluster indexes + In-Memory Topic Model | Tested Atlas M0 Free Tier (512 MB, max 3 search indexes). Avoids blowing storage limits and guarantees < 300 ms latency. |
| **Event Transport** | NATS JetStream `CENTOIRE_EVENTS` stream: `events.post.*`, `events.behavior.*`, `events.social.*` | Decouples high-volume behavioral logging (impressions/dwell) from core DB writes. |

---

## 3. Detailed Architectural Decisions

### 3.1. Service Topology (`services/recsys/`)

The recommendation platform consists of:
1. **Node.js API & Orchestration Service (`services/recsys/`)**:
   - Built with `@centoire/bahamut` and TypeScript ESM.
   - Owns the public endpoints: `/api/v1/feed/for-you` and `/api/v1/suggestions`.
   - Performs fast candidate generation (B-Tree indexed retrieval, social graph rules, private circle isolation).
   - Calls the Python ML agent when heavy offline/online scoring or vector re-ranking is required.
2. **Python ML Agent (`ai-agent/`)**:
   - Handles Gemini 768-d embeddings, K-means topic clustering (~40 clusters), and model inference.

```
                      ┌─────────────────────────────────────────┐
                      │            NATS JetStream               │
                      │         (gateway.services)              │
                      └──────────────┬──────────────────────────┘
                                     │ (heartbeat announce)
UI (port 5173) ──► Gateway (:8100) ──┼──► core (:8000)
                     │               ├──► notifications (:8111)
                     │               ├──► search (:8112)
                     └───────────────┴──► recsys (:8004) [Node.js + Bahamut]
                                            ├─ /api/v1/feed/for-you
                                            ├─ /api/v1/suggestions
                                            └─ Calls Python Agent for ML/embeddings
```

**Port & Prefix Allocation**:
- **Port**: `8004` (Announce address: `http://127.0.0.1:8004`)
- **Public Routes**:
  - `/api/v1/feed/for-you` (personalized feed)
  - `/api/v1/suggestions` (circle and creator recommendations)
- **Private Routes** (Gateway port `8101` only):
  - `/internal/recsys/*` (health, re-clustering triggers, metrics)
- **Gateway Reservation**: `/api/v1/feed/for-you` and `/api/v1/suggestions` are added to `GATEWAY_RESERVED`. If `recsys` is offline, the gateway fails closed (503) or falls back to core's baseline feed according to configuration.

---

### 3.2. Gateway Registration & Edge Authentication

#### Dynamic Service Announcement
`services/recsys` uses Bahamut's `createServer({ config, bus })` which automatically publishes `ServicePing` heartbeats to NATS subject `gateway.services` every 5 seconds, and cleanly announces `goodbye` on shutdown.

#### Edge Authentication Contract
1. The client sends session cookies (`token`) to the Gateway (`http://localhost:8100`).
2. The Gateway verifies the JWT with `JWT_SECRET`.
3. If valid, the Gateway strips caller-provided headers and injects:
   - `x-user-id`: MongoDB ObjectId string
   - `x-user-email`: user email
   - `x-user-role`: `user` | `admin`
   - `x-gateway-secret`: `GATEWAY_SECRET` from shared env
4. In `services/recsys`, Bahamut's `resolveClaims` middleware populates `req.user` (`{ userId, email, role }`). Unauthenticated public requests (guest feed) still pass through with `req.user === undefined`.

---

### 3.3. Data Store Strategy & Atlas Vector Search Assessment

#### Empirical Cluster Measurement (Conducted on our MongoDB Atlas Cluster):
- **MongoDB Version**: 8.0.36 (Atlas M0 Shared Cluster)
- **Total Storage Quota**: 512 MB
- **Current DB Usage**: 17.56 MB data, 8.96 MB storage, 13.91 MB indexes across 22 collections.
- **768-Dimension Embedding Size**:
  - Measured BSON payload for one 768-d vector: **~6.2 KB binary** (approx **14.8 KB** in JSON representation).
  - 1,000 posts: ~6.2 MB raw data + ~3 MB index overhead = **~9.2 MB**.
  - 10,000 posts: ~62 MB raw data + ~30 MB index overhead = **~92 MB** (~18% of total storage quota).
  - 50,000 posts: **> 450 MB** (would breach free tier limit).
- **Atlas Vector Search Limit**: Atlas M0 enforces a hard cap of **maximum 3 Search / Vector Search indexes per cluster**.

#### The Decision:
1. **Never perform real-time brute-force k-NN vector queries during request time**:
   Real-time vector queries across large collections cannot guarantee the `< 300 ms` SLA on shared compute.
2. **K-Means Topic Cluster Mapping (Stage 0)**:
   When an embedding is generated by Som's agent (Gemini 768-d), the post is assigned to one of the **~40 offline topic clusters** (`topicClusterId: number`).
   - The post's cluster assignment is stored in the post metadata (`topicClusterId`).
   - Candidate generation queries use standard B-Tree indexed queries:
     `{ topicClusterId: { $in: userTopClusters }, publishedAt: { $gte: cutoffDate } }`.
3. **Embedding Storage**:
   Raw embeddings are kept in a dedicated `post_embeddings` collection (or separate `centoire_recsys` database) with a **30-day TTL index** on `createdAt`. This strictly limits the collection size to active candidate window posts, capping vector storage at < 50 MB indefinitely.

---

### 3.4. Event Transport & NATS JetStream Subjects

The event bus operates under NATS JetStream stream `CENTOIRE_EVENTS`.

| Subject | Source | Purpose | Payload Summary |
|---|---|---|---|
| `events.post.published` | Core Backend | Trigger embedding generation | `postId`, `title`, `excerpt`, `aiSummary`, `category`, `circleId`, `isPrivate` |
| `events.post.updated` | Core Backend | Invalidate/update embeddings | `postId`, updated fields |
| `events.post.deleted` | Core Backend | Prune candidate pools | `postId` |
| `events.behavior.batch` | Gateway (`POST /api/v1/events/batch`) | User topic-mix updates | Array of `{ userId, postId, event: "impression" \| "dwell" \| "click" \| "hide", dwellMs, timestamp }` |
| `events.social.*` | Core Backend | Update recommendation graph | `follow`, `unfollow`, `circle_join`, `circle_leave`, `block`, `mute` |

**High-Volume Ingestion Guard**:
Client impression events are **not** written row-by-row into MongoDB Atlas. The UI batches impressions every 5 seconds (or on page unload via `sendBeacon`) to `POST /api/v1/events/batch`. The handler validates the batch and publishes directly to `events.behavior.batch` on NATS for streaming consumption by `services/recsys`.

---

### 3.5. Security & Isolation Constraints

1. **Private Circle Boundary**:
   Posts originating from private circles (`circle.visibility === "private"`) are **hard-excluded** from the general candidate generation pool. They are only included if the query explicitly scopes to `userMemberCircleIds`.
2. **DPDP & GDPR Compliance**:
   Behavioral interaction logs are anonymized or purged after 30 days. `/internal/recsys/user/:id` supports complete deletion when a user exercises their right to erasure.

---

## 4. Local Execution & Tooling Integration

- **Command**: `make recsys` (or `cd services/recsys && npm run dev`).
- **Process Supervisor**: Managed alongside other platform services via `centmux` (`.tmuxinator.yml`) and `Makefile`.
- **CI Matrix**: Automatically included in monorepo workspace check legs (`npm run typecheck` and `npm run build`).
