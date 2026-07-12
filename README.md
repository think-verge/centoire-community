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
npm run seed                # tags, RSS sources, starter circles, admin user
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

## Scripts

| Where | Command | What |
|---|---|---|
| backend | `npm run dev` | tsx watch dev server |
| backend | `npm run openapi` | export OpenAPI spec from Zod |
| backend | `npm run seed` | idempotent seed (tags/sources/circles/admin) |
| backend | `npm test` | vitest unit tests |
| backend | `npx tsx scripts/fetch-sources.ts` | one-off RSS pull |
| ui | `npm run dev` | Vite dev server with /api proxy |
| ui | `npm run api:refresh` | regenerate orval client from backend spec |
| ui | `npm run build` | typecheck + production build |

## Architecture notes

- **For You ranking** (`backend/src/services/feedService.ts`): Mongo aggregation —
  `score = log10(upvotes+1)*4 + tagMatch*2 + follow*6 + circle*4 − hoursOld/6` over a
  45-day window; offset cursor capped at 400 (swap for a precomputed rank score at scale).
- **Reputation** is an append-only ledger (`ReputationEvent`) with a denormalized total
  on the user: +2 publish, +10 post upvote, +5 comment upvote, reversed on unvote.
  This is also the future notification emit point.
- **Auth**: 7-day JWT in an httpOnly cookie; `requireVerified` gates posting/voting/
  commenting; Google sign-in activates when `GOOGLE_CLIENT_ID`/`VITE_GOOGLE_CLIENT_ID` are set.
- **Deferred (P1)**: notifications center, leaderboard UI, moderation queue, lookbook
  builder, self-serve syndication, creator analytics.
