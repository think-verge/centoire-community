# ADR 004: Event Log Privacy — Consent, Retention, Export, and Erasure

**Date**: 2026-11-10  
**Status**: Accepted / Implemented  
**Authors**: Saumya Bhardwaj (Backend & Platform), Devyansh Sehgal (Reviewer)  
**Ticket**: [#117](https://github.com/think-verge/centoire-community/issues/117) (Epic [#101](https://github.com/think-verge/centoire-community/issues/101))  
**Cross-References**: [#94](https://github.com/think-verge/centoire-community/issues/94) (Data Localization), [#111](https://github.com/think-verge/centoire-community/issues/111) (Behavioral Event Stream)

---

## 1. Context & Regulatory Mandate

The Centoire recommendation platform (Epic #101) ingests behavioral telemetry (post views, dwell time, clicks, reads, bookmarks, circle interactions, dismissals). Under modern privacy frameworks, behavioral interaction telemetry linked to an identifiable member constitutes **Personal Data**.

### Regulatory Drivers:
1. **India Digital Personal Data Protection Act (DPDP Act 2023)**:
   - Centoire's primary launch market is **India**.
   - §6 (Consent and Notice): Consent must be freely given, specific, informed, and unambiguous. Data principals must have the ability to withdraw consent easily.
   - §8 (Purpose Limitation & Erasure): Data fiduciaries must retain personal data only as long as necessary for the specified purpose and must erase personal data upon withdrawal of consent or account deletion.
   - §11 (Right to Access & Data Portability): Data principals are entitled to an export summary of all personal data held about them.
2. **European Union General Data Protection Regulation (GDPR)**:
   - Article 15 (Right of Access), Article 17 (Right to Erasure / "To be Forgotten"), Article 20 (Right to Data Portability), and Article 21 (Right to Object to Automated Profiling).

This ADR formalizes the data map, consent lifecycle, automated retention TTLs, portability export endpoints, and cascaded erasure across core and microservice stores.

---

## 2. Recommendation & Telemetry Data Map

All recommendation and interaction data resides in the primary MongoDB Atlas cluster (and downstream streaming caches):

| Collection / Store | Schema / Model | Purpose | PII / Identifiers | Retention Policy | Storage Footprint Controls |
|---|---|---|---|---|---|
| `events` | `Event` (`backend/src/models/Event.ts`) | Raw behavioral telemetry (impressions, dwell times, scrolls, clicks, shares) | `userId` (ObjectId), `sessionId` (String) | **30 Days TTL** (via index on `at: 1`) | TTL expiration automatically purges entries older than 2,592,000 seconds (30 days), preventing Atlas quota overflow. |
| `usertopicmixes` | `UserTopicMix` (`backend/src/models/UserTopicMix.ts`) | User dynamic topic preferences, decay multipliers, points, and `hiddenPostIds` | `userId` (ObjectId) | Persistent until account deletion or profile reset | Single document per user; auto-pruned on `deleteAccount`. |
| `suggestionfeedbacks` | `SuggestionFeedback` (`backend/src/models/SuggestionFeedback.ts`) | Suppressed recommendation candidates (dismissed circles/creators) | `userId` (ObjectId), `targetId` (ObjectId) | **30 Days Dismissal Window** (`dismissedUntil`) | Cleaned up on account deletion or expiration. |
| `users` | `User` (`backend/src/models/User.ts`) | Account profile, privacy preferences (`privacyConsent`), followed hashtags | `_id`, `email`, `handle`, `location`, `domains` | Retained during active account lifecycle | Erased completely upon user deletion request. |
| `centoire_recsys` (microservice) | MongoDB / In-memory candidate pools | Topic cluster indexes and vector inference caches | `userId` | In-memory ephemeral / synchronized via NATS | Purged on `user.deleted` NATS event subscription. |

---

## 3. Consent Management & Anonymization

### 3.1. Consent Schema
Each `User` document stores an explicit `privacyConsent` object:
```ts
privacyConsent: {
  behavioralTracking: { type: Boolean, default: true },
  personalizedRecommendations: { type: Boolean, default: true },
  consentedAt: { type: Date, default: () => new Date() },
}
```

### 3.2. Opt-out Behavioral Ingestion
When `privacyConsent.behavioralTracking === false`:
- The client-side batch ingestion (`POST /api/v1/events/batch` via `eventService.ingestEventBatch`) inspects user consent.
- If behavioral tracking is disabled, the system **strips the `userId`**, treating the event purely as an anonymous, aggregated telemetry counter.
- Anonymized events cannot be linked back to the user identity or profile, fulfilling DPDP §6 purpose-limitation guidelines.

### 3.3. API Endpoints
- `GET /api/v1/users/me/privacy`: Inspect current consent settings and timestamp.
- `PUT /api/v1/users/me/privacy`: Update consent preferences (`behavioralTracking`, `personalizedRecommendations`).

---

## 4. Retention Policy (TTL)

To guarantee compliance with data minimization principles and operate strictly within Atlas storage budgets (512 MB shared cap):
- An automatic TTL index is created on the `Event` collection:
  ```ts
  eventSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
  ```
- Any event log older than 30 days is automatically purged by MongoDB background workers.
- Suggestion dismissals in `SuggestionFeedback` enforce a 30-day window (`dismissedUntil = Date.now() + 30 * 86400000`).

---

## 5. Right to Access & Data Portability (Export)

- **Endpoint**: `GET /api/v1/users/me/export` (authenticated).
- **Format**: Machine-readable JSON structured for portability:
  ```json
  {
    "exportedAt": "2026-11-10T10:30:00.000Z",
    "complianceStandard": "India DPDP Act 2023 / GDPR",
    "user": {
      "id": "6724fa...",
      "email": "user@domain.com",
      "handle": "userhandle",
      "displayName": "User Name",
      "domains": ["fashiontech", "knitwear"],
      "followedHashtags": ["#knitwear", "#sustainable"],
      "privacyConsent": { "behavioralTracking": true, "personalizedRecommendations": true }
    },
    "topicMix": {
      "activeDays": 5,
      "mix": { "textiles": 0.45, "luxury": 0.55 },
      "hiddenPostIds": []
    },
    "suggestionFeedback": [
      { "targetType": "circle", "targetId": "67280...", "dismissedUntil": "2026-12-10T..." }
    ],
    "events": [
      { "action": "dwell", "postId": "67281...", "dwellMs": 4200, "at": "2026-11-09T..." }
    ]
  }
  ```

---

## 6. Right to Erasure (Cascaded Account Deletion)

When a user triggers account deletion (`DELETE /api/v1/users/me`):
1. **Core Database Cleanup**:
   - `Event.deleteMany({ userId })`: All personal event logs are deleted immediately.
   - `UserTopicMix.deleteMany({ userId })`: Personalized topic model and hidden posts records are deleted.
   - `SuggestionFeedback.deleteMany({ userId })`: All dismissed suggestion records are purged.
   - Core social models (`Bookmark`, `Vote`, `Follow`, `CircleMembership`, `User`) are deleted.
2. **Microservice Erasure via NATS JetStream**:
   - Core emits domain event `user.deleted` with `{ userId }`.
   - `services/recsys`: Listens on `user.deleted` and purges any user-keyed cached vectors, recommendation candidate pools, and custom scoring entries.
   - `services/search`: Listens on `user.deleted` and removes `PersonDoc` index documents.
   - `services/notifications`: Listens on `user.deleted` and deletes notification backlogs.
3. **Acceptance Verification**:
   - Querying `Event.countDocuments({ userId })` and `UserTopicMix.countDocuments({ userId })` returns strictly `0`.

---

## 7. Launch-Market Decision & Data Localization Coordination

### 7.1. Launch-Market Decision:
- **Primary Market**: **India**. The platform's user base and pilot creators launch in India, making the **DPDP Act 2023** the baseline legal standard for notice, consent capture, and right to grievance redressal.
- **Secondary / Cross-Border Cohorts**: Europe (GDPR) and North America. Where EU/UK members interact, GDPR principles (lawful basis, explicit consent for profiling) are respected by applying the stricter standard across all user consent endpoints.

### 7.2. Coordination with Data Localization (#94):
- In conjunction with Issue #94 (Data Localization by region):
  - Primary Atlas database clusters for Indian users are provisioned within AWS Mumbai (`ap-south-1`) or GCP Mumbai (`asia-south1`).
  - Cross-border transfers of personal event logs comply with Central Government rules under DPDP Act §16. Because behavioral logs are processed within the domestic region, raw interaction logs do not leave Indian jurisdiction without anonymization.
  - EU cohort telemetry will map to AWS Frankfurt (`eu-central-1`) upon expansion under Issue #94.
