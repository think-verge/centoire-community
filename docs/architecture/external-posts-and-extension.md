# External posts: summary + extension reader (plan)

Status: planned. Phase 1 (no stored bodies, `/r/:id` redirect, summary page) is already implemented.

## Goal
- Never scrape or store article bodies for external (RSS) posts. Store metadata + our own AI summary only.
- The Centoire post (drawer / `/p/:slug`) is the **summary page**. Upvote, comment, bookmark and share all live there.
- "Read post" opens the original article **inside Centoire** through our browser extension. The article view has no Centoire actions.
- Everyone who can't use the extension (mobile, Safari, extension not installed or declined) falls back to opening the article in a new tab through `/r/:id`.

## How the reader works
```
Centoire page (drawer)
 └─ <iframe src="chrome-extension://<id>/frame.html?target=<article>&parentOrigin=<centoire>">   (extension page)
     └─ <iframe sandbox src="<article>">        ← real publisher page, loads because the extension
                                                   removed its X-Frame-Options / CSP for this tab+host
```
1. The web app detects the extension with `chrome.runtime.sendMessage(extId, {type:"ping"})` (allowed by `externally_connectable` for Centoire origins only).
2. First use: the extension frame shows an "Enable reader" button. The click requests the optional permissions (`declarativeNetRequestWithHostAccess` + host access); it must be a user gesture inside an extension page.
3. Background worker adds a **session** declarativeNetRequest rule: `tabIds:[tab]`, `resourceTypes:[sub_frame]`, `requestDomains:[article host]`, action `modifyHeaders` removing `X-Frame-Options` and `Content-Security-Policy`.
4. `frame.html` validates the target (http/https only) and `parentOrigin` (Centoire allow-list), loads the inner sandboxed iframe, and `postMessage`s `ready | error(reason)` to the parent.
5. Closing the reader, the tab, or a 30 min TTL removes the rule.
6. Opening the reader also counts the click (`POST /api/v1/r/:id`, 204) so click stats stay accurate.

## Work breakdown

### A. Extension (`extension/`, new, MV3, TypeScript, Chrome + Edge)
- `manifest.json`: optional permissions only for the broad access; `externally_connectable.matches` and `web_accessible_resources` limited to Centoire origins; strict extension-page CSP.
- `background.ts`: message handlers (`ping`, `enableFrame`, `disableFrame`), session-rule add/remove, cleanup on tab close and TTL alarm, survives service-worker restarts by re-reading session rules.
- `frame.html/.ts`: permission prompt, target + origin validation, inner iframe `sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"` (no top navigation, so frame-busting scripts cannot hijack the Centoire tab), event messaging.
- Shared message protocol/constants in `packages/contracts` so the web app and extension cannot drift.
- Build: Vite/esbuild to `extension/dist`, zip script for store upload, pinned dev `key` for a stable extension id; separate id lists for Chrome and Edge.

### B. Web app (`ui/`)
- `useReaderExtension()`: detection (cached), install state, permission state, error reasons.
- Reader surface (see decision below) with states `checking → needs-install | needs-permission → loading → ready | error`, always with "Open original ↗" and a visible Back to the summary.
- Install banner for users without the extension (shown once per session, dismissible); `READ POST` falls back to new tab via `/r/:id` when not available or on error/timeout (8 s without `ready`).
- Feature flag `VITE_READER_EXTENSION`.

### C. Backend (`backend/`)
- `POST /api/v1/r/:id` count-only variant (keeps the existing `GET` redirect for fallback).
- `readMode` counters (`reader` vs `newTab`) alongside `clickCount`, to measure real extension adoption.

### D. Ingestion pipeline (queue-based, no stored bodies)
- Poller (own process, per-source schedule, ETag / If-Modified-Since, dedupe on canonical-URL hash) creates a metadata-only post with `enrichmentStatus: "enriching"` and publishes `content.requested` on NATS JetStream.
- Enrichment workers (horizontally scalable, per-domain rate limit, bounded retries, dead-letter): transient fetch for og image + text handed to the AI agent in memory, never persisted; store only summary, hashtags, category, read time, quality flags; re-host the cover image through `uploadService`.
- Any failure (paywall, block, timeout, agent error) falls back to the RSS title + description; the post still publishes.
- Add-source flow: from a site URL auto-discover the RSS feed, name and logo (cheerio, `link[rel=alternate]`, `og:site_name`, favicon).

### E. Tests
- Unit: target URL validation, rule builder (host-scoped, tab-scoped), origin allow-list, message protocol, enrichment fallback paths.
- Extension e2e (Playwright, Chromium with the unpacked extension): a local fixture site sending `X-Frame-Options: DENY`; assert it renders in the reader, assert the rule is removed on close, assert an untrusted `parentOrigin` is refused.
- Manual matrix: Chrome and Edge × freeCodeCamp, dev.to, The Verge, Medium, a paywalled site, a frame-busting site.

## Video posts (no extension needed)
daily.dev plays video posts with YouTube's official embed (`<iframe src="https://www.youtube-nocookie.com/embed/<videoId>">`, verified in the browser); "Watch video" is only a link-out fallback. We do the same, so video works for every user, including mobile and Safari.
- **Detection at ingestion:** item link on `youtube.com/watch?v=`, `youtu.be/<id>` or a YouTube channel feed (`youtube.com/feeds/videos.xml?channel_id=…`, which carries `yt:videoId`, the thumbnail and the description). Store `kind: "video"`, `videoProvider: "youtube"`, `videoId`.
- **Embeddable check:** call YouTube oEmbed once at ingestion; if the owner disabled embedding, set `embeddable: false` and show a "Watch on YouTube ↗" link instead of the player.
- **Display:** the player sits at the top of the summary page (drawer and `/p/:slug`) above our summary, tags, upvote and comment. Click-to-load facade (thumbnail first, iframe on click) for performance; always `youtube-nocookie.com`.
- **Thumbnail and summary:** `https://i.ytimg.com/vi/<id>/hqdefault.jpg` (re-hosted like other cover images); AI summary from the title and description only (no transcript scraping).
- **Later, same pattern:** an allow-list of providers with official embeds (Vimeo, etc.) via oEmbed. Anything without an official embed is an article and uses the extension reader.
- **Read post vs Watch video:** videos never need the reader overlay; the button is only shown when `embeddable` is false.

## Risks and decisions
- **"Everyone has it" is not achievable.** Mobile browsers (Chrome Android, iOS, Safari) cannot run this extension, and some users will decline the permission. The `/r/:id` fallback is mandatory, not optional.
- **Store review** (Chrome Web Store, Edge Add-ons): broad host access plus header modification gets extra scrutiny. Keep permissions optional, write a clear justification and privacy policy, ship unlisted first. Plan for review latency.
- **Paywalled articles** may still show the paywall in the frame because cross-site cookies are usually blocked; "Open original ↗" stays visible.
- **Header removal weakens the publisher's page protections inside the frame.** Mitigated by host-scoped, tab-scoped, session-only rules, the sandbox attribute, and removing the rule on close. DNR cannot edit only the `frame-ancestors` directive, so the whole CSP header is removed for that frame.
- **AGPL:** dailydotdev code is AGPL; we implement the technique ourselves and copy none of their code.
- **Search quality** for external posts depends on the summary + hashtags now that bodies are not stored.

## Order of work
1. Extension + reader UI + count endpoint (proves the core experience end to end on a fixture, then on real sites).
2. Ingestion pipeline + image re-hosting.
3. Add-source auto-discovery.
4. Store submission, rollout behind the flag, adoption metrics.

## Open decision
Reader surface (default in this doc: **overlay inside the drawer**): see the question asked in chat.
