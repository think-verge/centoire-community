# Centoire Community

The home for everyone in fashion — a daily.dev-style community platform: one personalized feed of aggregated + member content, Circles (niche communities), publishing, and portable reputation.

## Stack

- **Backend** — Node + Express 5 + Mongoose 8 (MongoDB Atlas), TypeScript ESM, MVC (`route → controller → service → model`), Zod schemas that generate the OpenAPI spec.
- **UI** — Vite + React 19 + TypeScript, Tailwind CSS v4 (custom light-editorial design system), TanStack Query 5, TipTap editor.
- **API contract** — `backend/src/schemas` (Zod + `zod-to-openapi`) → `backend/openapi/openapi.json` → [orval](https://orval.dev) generates typed React Query hooks in `ui/src/lib/api/generated`.

## Getting started

```bash
# 1. Backend
cd backend
cp .env.example .env        # set MONGODB_URI (+ optional Cloudinary/Google/Resend keys)
npm install
npm run seed                # hashtags, RSS sources, starter circles, admin user
npm run dev                 # http://localhost:8000

# 2. UI (second terminal)
cd ui
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :8000)
```

Seeded admin: `admin@centoire.app` / `centoire-admin` (change in production).

### The contract loop

Whenever you change or add an endpoint:

```bash
cd backend && npm run openapi     # regenerate openapi/openapi.json from Zod
cd ../ui   && npm run api:refresh # copy spec + regenerate typed hooks (orval)
```

### RSS ingestion

Admin-managed sources (`/admin/sources` in the UI) are fetched by an in-process cron
(every 30 min) when `ENABLE_INGESTION=true`. Manual pulls: the "Fetch now" button, or
`npx tsx scripts/fetch-sources.ts`. Imports are deduped by a canonical-URL hash; only
title/excerpt/og-image are stored and cards link out to the original story.

### Email

Without `RESEND_API_KEY`, verification and password-reset links are printed to the
backend console (`[mail] …`) — click them from there in development.

### Images

With Cloudinary env vars set, uploads go to Cloudinary; otherwise files land in
`backend/uploads/` and are served at `/uploads` (dev fallback).

## Platform mode (gateway + services)

Besides the single-process monolith above, the backend can run as an Acuvity-style set of
services behind a gateway. See [`docs/architecture/microservices.md`](docs/architecture/microservices.md)
for the design. Everything below is in addition to `cd backend && npm run dev`, which still works on its own.

| Process | Dir | Port | Needs |
|---|---|---|---|
| NATS (JetStream) | — | 4222 | `nats-server` binary |
| gateway | `services/gateway` | 8100 public / 8101 internal | NATS |
| core (the monolith) | `backend` | 8000 | NATS, `MONGODB_URI`, `NOTIFICATIONS_EXTERNAL=true` |
| notifications | `services/notifications` | 8111 | NATS, `MONGODB_URI` |
| search | `services/search` | 8112 | NATS, `MONGODB_URI` |
| UI | `ui` | 5173 | `API_PROXY_TARGET=http://localhost:8100` |
| ai-agent (optional) | `ai-agent` | 8001 | Python 3.12 |

First time: `npm install` at the repo root (installs and builds the shared `@centoire/*` packages),
plus `npm install` in `backend/` and `ui/`. Services read `MONGODB_URI` / `JWT_SECRET` from `backend/.env`
if they have no `.env` of their own.

### Starting everything

**macOS / Linux with tmux + tmuxinator (what `centmux` uses today)**

```bash
make platform-install     # once
./centmux                 # one tmux window per process (iTerm: control mode); ./centmux kill to stop
```

`make nats gateway core notifications search ui-platform` start the same processes one at a time
(`make` is not available on stock Windows).

**Without tmux/iTerm, or on Windows (works today, one terminal per row)**

Start them in this order. Replace the env syntax for your shell
(bash/zsh: `NATS_URL=… cmd`, PowerShell: `$env:NATS_URL="…"; cmd`, cmd.exe: `set NATS_URL=…&& cmd`).

```text
1. nats-server -js                                   # install: brew install nats-server | scoop install nats-server | choco install nats-server
2. cd services/gateway        && npm run dev         # NATS_URL=nats://127.0.0.1:4222
3. cd backend                 && npm run dev         # NATS_URL=nats://127.0.0.1:4222  NOTIFICATIONS_EXTERNAL=true
4. cd services/notifications  && npm run dev         # NATS_URL=nats://127.0.0.1:4222
5. cd services/search         && npm run dev         # NATS_URL=nats://127.0.0.1:4222
6. cd ui                      && npm run dev         # API_PROXY_TARGET=http://localhost:8100
```

Open http://localhost:5173. On Windows, WSL2 also works: install tmux + tmuxinator inside WSL and use `./centmux`.

### Plan: cross-platform runner (not implemented yet)

Goal: one command that works on Windows, macOS and Linux with only Node installed, no tmux, iTerm, `make` or bash.

Why `centmux` doesn't port: it is a bash script around tmux + tmuxinator, the `Makefile` needs GNU make, inline
`KEY=value cmd` env syntax is POSIX-only, and the AI agent's venv activation differs on Windows.

1. **`scripts/dev.mjs` (Node, no shell assumptions).** A service table (name, cwd, command, env, ready-check)
   is the single source of truth. It spawns each process with `child_process` using the `env` option (no inline
   `KEY=value`), prefixes and colours each line of output by service name, waits for a TCP/HTTP ready-check before
   starting dependents (NATS, then gateway, then the rest), restarts nothing silently, and on Ctrl+C kills whole
   process trees (`taskkill /T /F` on Windows, process groups elsewhere).
2. **Root npm scripts** that call it: `npm run dev:platform` (everything), `npm run dev:standalone`
   (monolith + UI only), and flags `--only gateway,core` / `--skip agent` for partial stacks.
3. **Make `centmux` and `make` thin wrappers** over the same service table so tmux users keep their layout and
   there is no second place to edit ports or env.
4. **NATS without a manual install.** `scripts/ensure-nats.mjs` uses `nats-server` from `PATH` if present,
   otherwise downloads a pinned release for the current OS/arch into `.data/bin/` and verifies its checksum.
   A `docker-compose.yml` with just NATS is offered as the alternative.
5. **Optional AI agent.** A small helper creates `ai-agent/.venv` and picks `Scripts\python.exe` vs `bin/python`;
   if Python is missing the runner skips the agent with a warning instead of failing.
6. **`npm run doctor` preflight.** Checks Node >= 22, that ports 4222/5173/8000/8100/8101/8111/8112 are free,
   that `backend/.env` has `MONGODB_URI`, and that `npm install` has been run, with a fix hint per failure.
7. **Housekeeping.** `.gitattributes` forcing LF for shell scripts, quoting for paths with spaces, and
   `scripts/` kept dependency-free so it runs before `npm install` finishes.
8. **CI smoke test** on `windows-latest` and `ubuntu-latest`: start the platform with a `--smoke` flag, wait for the
   gateway health check and one proxied request, then exit non-zero on any failure.

Done when a fresh Windows machine with Node, a `MONGODB_URI`, and no tmux/make/bash can run
`npm install && npm run dev:platform` and open the app on http://localhost:5173.

## Scripts

| Where | Command | What |
|---|---|---|
| backend | `npm run dev` | tsx watch dev server |
| backend | `npm run openapi` | export OpenAPI spec from Zod |
| backend | `npm run seed` | idempotent seed (hashtags/sources/circles/admin) |
| backend | `npm test` | vitest unit tests |
| backend | `npx tsx scripts/fetch-sources.ts` | one-off RSS pull |
| ui | `npm run dev` | Vite dev server with /api proxy |
| ui | `npm run api:refresh` | regenerate orval client from backend spec |
| ui | `npm run build` | typecheck + production build |

## Production deployment

Production deploys to the shared VM without modifying the existing CAG, Centoire,
or Opho Digital services. Nginx serves the UI on port `5175` and proxies same-origin
API requests to the backend on `127.0.0.1:8002`.

Pushes to `main` run `.github/workflows/deploy-production.yml`. The repository needs
the `CENTOIRE_COMMUNITY_SSH_HOST`, `CENTOIRE_COMMUNITY_SSH_USER`, and
`CENTOIRE_COMMUNITY_SSH_PRIVATE_KEY` GitHub Actions secrets. Runtime secrets are kept
only on the VM in `/etc/centoire-community/backend.env`.
Non-secret Vite build settings are stored in
`/etc/centoire-community/frontend.env`; production currently sets
`VITE_AI_SEARCH_ENABLED=false`.
The SSH user has passwordless sudo access only to the root-owned
`/usr/local/sbin/deploy-centoire-community` wrapper.

Production is served at `https://centoire.com`; `www` and HTTP requests redirect to
the canonical HTTPS origin. The backend uses `CLIENT_ORIGIN=https://centoire.com`
and `COOKIE_SECURE=true`. The `centoire-community-domain` nginx site preserves this
configuration whenever the Let's Encrypt certificate is present.

## Architecture notes

- **For You ranking** (`backend/src/services/feedService.ts`): Mongo aggregation —
  `score = log10(upvotes+1)*4 + hashtagMatch*2 + follow*6 + circle*4 − hoursOld/6` over a
  45-day window; offset cursor capped at 400 (swap for a precomputed rank score at scale).
- **Reputation** is an append-only ledger (`ReputationEvent`) with a denormalized total
  on the user: +2 publish, +10 post upvote, +5 comment upvote, reversed on unvote.
  This is also the future notification emit point.
- **Auth**: 7-day JWT in an httpOnly cookie; `requireVerified` gates posting/voting/
  commenting; Google sign-in activates when `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` are set.
- **Deferred (P1)**: notifications center, leaderboard UI, moderation queue, lookbook
  builder, self-serve syndication, creator analytics.
