# Centoire Discovery Engine (MVP)

Watches streetwear & sneaker sources across regions, stores every new item with the
time we **first saw it**, and (by the end of the MVP week) groups items into stories,
flags what's breaking, and measures how far ahead of BoF / WWD we were.

The watchlist is split in three files. Every source has a `region`; items carry `regions`,
so everything can be filtered by market.

- [`brand_sites.yaml`](brand_sites.yaml): brands' own channels: Nike SNKRS launch-page
  sitemaps for US/JP/GB/KR/IN, Nike landing pages and newsroom, Supreme previews and news,
  ASICS press, and 24 brand blogs (Stüssy, ALD, Kith, BAPE, Patta, JJJJound, Corteiz, Brain
  Dead, Denim Tears, Noah, WTAPS, sacai, Neighborhood, Bluorng, …). Sitemaps and pages have
  no feed, so the engine remembers every URL they have ever listed and reports only new ones
  (`app/sites.py`).
- [`instagram.yaml`](instagram.yaml): 70 brand, insider, collaborator and shop accounts
  (170 of 180 calls/hour).
- [`sources.yaml`](sources.yaml): publishers in 11 markets (feeds, plus news sitemaps or
  homepage article lists for Sole Retriever, Complex, House of Heat, Sneakerjagers, Fashion
  Press, Sneaker Freaker and Grailify), benchmarks (BoF, WWD), Google News searches per
  market, Reddit, Shopify store catalogues and END. launches (release confirmation, not
  early news).
- **Discovered sources** (role `discovered`, kept in MongoDB): added automatically by origin
  tracing, below.

## Finding primary sources automatically (origin tracing)

Publishers credit where a story started: "Photos: acgtaiwan, runners_highest", "Images via
Nike", an embedded Instagram post ("A post shared by … (@travisscott)"), a link to an X post.
Every article the engine collects is read for those credits (`app/citations.py`): from the
feed's article text, or by opening the article for feeds that only carry a summary
(`fetch_article: true`). Each credited name is counted per publisher and per day
(`app/origins.py`, MongoDB `origin_candidates`).

A name becomes a **primary source** when 2+ publishers credited it, or one publisher credited it
on 3+ different days. Plain links count for less (3+ publishers for a website), editions of one
outlet (hypebeast.com/.cn/.kr) count once, and names a publisher puts on most of its articles
(its own accounts, its shop) are ignored. Every 30 minutes, qualifying names are added:

| Credited name | What happens |
|---|---|
| Instagram account | checked via business discovery, then watched (slow tier, within the hourly budget). Waits as `pending_instagram` until Instagram is connected |
| Website | watched if it publishes an RSS/Atom feed; otherwise `not_watchable` |
| X / TikTok / Weibo / YouTube / a person's name | `not_watchable`: listed for a person to follow up |

- `GET /origins?min_publishers=2` — credited names, with the article lines that credited them
- `POST /origins/{id}/reject` — never add this one (e.g. `instagram:size`)
- `python -m scripts.trace_origins` — read every feed's current articles and run one promotion pass

## Stories: one event, every site that reported it

Articles are grouped by the event they report (`app/stories.py`, MongoDB `stories`). Every
minute, new articles go through Gemini in batches of 40:

1. **Triage** (`STORY_TRIAGE_MODEL`, default gemini-3.5-flash-lite): is it fashion / streetwear /
   sneaker / art news? Deals, listings, job ads, personal Reddit posts and off-topic news are
   dropped (kept in `items`, with `triage.relevant: false`). Relevant ones get a category and
   one neutral English headline, so a Japanese, Korean and English write-up read alike.
2. **Candidates**: the headline is embedded (`EMBED_MODEL`, gemini-embedding-001); stories from
   the last 14 days with close headlines are candidates.
3. **Match** (`STORY_MATCH_MODEL`, default gemini-3.5-flash): which candidate story each article
   belongs to, or which new story it starts. Follow-ups (leak → reveal → release date) join;
   other colourways or other collabs of the same brand don't.

A story counts **websites**, not feeds: Hypebeast's English, Korean and Chinese editions are one
website, and each outlet behind a Google News result is its own website.

- `GET /stories?hours=48&min_websites=3` — stories, most widely covered first: who published
  first, when the engine saw it, and the spread (each website with its first time)
- `GET /stories/{id}` — the same plus every article
- `python -m scripts.build_stories` — triage and group the backlog (run with the engine stopped)

## Run

```bash
uv venv -p 3.12 .venv && uv pip install -p .venv -r requirements.txt
cp .env.example .env
mongod --dbpath .data/mongo --bind_ip 127.0.0.1 --port 27017   # or point MONGODB_URI at Atlas
.venv/bin/uvicorn app.main:app --port 8090                      # API + poller in one process
```

- `GET /items?region=IN&role=publisher` — newest fresh items first
- `GET /sources` — watchlist with last poll status per source
- `GET /stats` — counts by region
- `python -m scripts.poll --once` — one polling round, prints a health table
- `python -m pytest -q`

## How "first seen" stays honest

Items present on a source's very first poll are stored with `baseline: true`; they were
published before we started watching, so they never count toward lead time.

## MVP week

| Day | Status |
|---|---|
| 1–2 Watchlist + poller (RSS, Google News, Reddit, Shopify), regions, first-seen times | done |
| 3 Instagram connector: 60-account watchlist ([instagram.yaml](instagram.yaml)), call budget + auto back-off, engagement snapshots, tagged-account candidates (`/instagram`, `/instagram/candidates`) | built; waiting for Meta credentials — see [docs/instagram-setup.md](docs/instagram-setup.md) |
| 3 Brand websites: sitemap and newsroom diffing, brand blog feeds ([brand_sites.yaml](brand_sites.yaml)) | done, live |
| 3 Origin tracing: find primary sources from publishers' credits and add them automatically | done, live |
| 4 Stories: Gemini relevance triage, English headline, grouping by event across languages, websites per story (`/stories`) | done, live |
| 5 Breaking detection + lead time vs BoF/WWD | |
| 6 Live page | |
| 7 Polish + demo | |

Known gap: Reddit answers 429 to unauthenticated feeds; switch to the official OAuth API
(`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`).
