# Centoire Discovery Engine (MVP)

Watches streetwear & sneaker sources across regions, stores every new item with the
time we **first saw it**, and (by the end of the MVP week) groups items into stories,
flags what's breaking, and measures how far ahead of BoF / WWD we were.

The watchlist is split in three files. Every source has a `region`; items carry `regions`,
so everything can be filtered by market.

- [`brand_sites.yaml`](brand_sites.yaml): **early, official signals** from brands' own sites:
  Nike SNKRS launch-page sitemaps for US/JP/GB/KR/IN, Nike landing pages and newsroom,
  Supreme previews and news, ASICS press, and brand blogs (Stüssy, ALD, Kith, BAPE, Patta,
  JJJJound). Sitemaps and pages have no feed, so the engine remembers every URL they have
  ever listed and reports only new ones (`app/sites.py`).
- [`instagram.yaml`](instagram.yaml): brand, insider and collaborator Instagram accounts.
- [`sources.yaml`](sources.yaml): publishers, benchmarks (BoF, WWD), Google News searches per
  market, Reddit, and Shopify store catalogues (release/availability, not early news).

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
| 4 Story grouping (embeddings) + Gemini summary, tags, countries, relevance filter | |
| 5 Breaking detection + lead time vs BoF/WWD | |
| 6 Live page | |
| 7 Polish + demo | |

Known gap: Reddit answers 429 to unauthenticated feeds; switch to the official OAuth API
(`REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET`).
