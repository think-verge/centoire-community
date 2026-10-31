# Centoire platform (microservices)

Modelled on the Acuvity stack: a library (`@centoire/bahamut`) that every service builds on, a **gateway** that
discovers services over NATS, and one process + one database per service. Bahamut is *not* a central server;
the gateway is the central piece.

```
UI ──► gateway :8100 (public)  ──► core :8000        (monolith, fallback for /api/v1/* and /uploads)
        gateway :8101 (internal)├─► notifications :8111   /api/v1/notifications   db: centoire_notifications
        ▲ routes learned from   └─► search :8112          /api/v1/search          db: centoire_search
        │ NATS `gateway.services`
NATS+JetStream :4222  ◄── domain events (stream CENTOIRE_EVENTS, subjects events.<name>)
```

## Pieces
| Path | Role |
|---|---|
| `packages/bahamut` | Kit: `defineIdentity` + processors + generic dispatch pipeline, NATS bus (durable consumers), registration heartbeat, auth/claims, service client, config |
| `packages/contracts` | Domain event types (with snapshots) shared by every service |
| `services/gateway` | Route table from announcements; public + internal listeners; longest-prefix wins; reserved prefixes fail closed (503) |
| `services/notifications` | Owns notifications; consumes events durably; stores actor/post/circle snapshots (no cross-DB populate) |
| `services/search` | Read model of posts/people/circles/hashtags, fed by core's `/internal/sync/*` change feed (updatedAt keyset) + id reconciliation for deletes |
| `backend/` | The monolith, now a registered service (`core`). Standalone when `NATS_URL` is unset |

## Run
`make platform-install` once, then `./centmux` (or `make nats gateway core notifications search ui-platform`).
`make backend` / `make ui` still run the monolith standalone (notifications served in-process).

## Rules of the road
- Never read another service's collections. Carry a snapshot in the event, or pull from the sync feed.
- Emit with `emitDomainEvent` (core) / `bus.emit` (services); consume with a durable name so restarts replay.
- New extracted prefix: add it to `GATEWAY_RESERVED` so an outage 503s instead of falling back to core.
- Public contract is unchanged: same-origin `/api/v1`, cookies, `{detail}` errors. OpenAPI is still generated from `backend/src/schemas`.

## Cutover status
Core still contains the old in-process notification/search code behind `NOTIFICATIONS_EXTERNAL` (default false).
Delete it after the extracted services have run in production. Prod deploy is unchanged functionally (no `NATS_URL`).
