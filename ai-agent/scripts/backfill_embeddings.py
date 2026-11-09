"""
Backfill script: generate embeddings for posts that lack them.

Usage:
    python -m scripts.backfill_embeddings [--dry-run]

Reads NODE_BACKEND_URL from the environment or .env file.
Calls the sync embed endpoint so each result is immediately written back.
Rate-limits to 1 request per 0.5 s to respect Gemini API quotas.
"""
import argparse
import os
import sys
import time

import httpx
from dotenv import load_dotenv

load_dotenv()

NODE_BACKEND_URL: str = os.getenv("NODE_BACKEND_URL", "http://localhost:8000")
EMBED_SYNC_URL: str = "http://localhost:8001/v1/embed-post/sync"
AI_INTERNAL_SECRET: str = os.getenv("AI_INTERNAL_SECRET", "dev-internal-secret")
BATCH_SIZE: int = 50
RATE_LIMIT_SECONDS: float = 0.5  # 1 request per 0.5 s

_INTERNAL_HEADERS = {"X-Internal-Secret": AI_INTERNAL_SECRET}


def fetch_posts_without_embedding(limit: int, offset: int) -> list[dict]:
    """Fetch a page of posts that still need embedding."""
    url = (
        f"{NODE_BACKEND_URL}/api/v1/internal/posts/without-embedding"
        f"?limit={limit}&offset={offset}"
    )
    resp = httpx.get(url, headers=_INTERNAL_HEADERS, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


def embed_post_sync(post: dict) -> dict:
    """Call the sync embed endpoint for a single post."""
    payload = {
        "postId": str(post.get("_id", post.get("postId", ""))),
        "title": post.get("title", ""),
        "excerpt": post.get("excerpt", ""),
        "aiSummary": post.get("aiSummary"),
        "hashtags": post.get("hashtags", []),
        "circleName": post.get("circleName"),
        "authorHandle": post.get("authorHandle"),
        "origin": post.get("origin", "native"),
        "contentText": post.get("contentText"),
    }
    resp = httpx.post(EMBED_SYNC_URL, json=payload, timeout=60.0)
    resp.raise_for_status()
    return resp.json()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill embeddings for posts without them."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview which posts would be processed without writing anything.",
    )
    args = parser.parse_args()
    dry_run: bool = args.dry_run

    if dry_run:
        print("[backfill] DRY-RUN mode — no embeddings will be written")

    offset = 0
    total_processed = 0
    total_skipped = 0
    total_errors = 0

    while True:
        try:
            posts = fetch_posts_without_embedding(limit=BATCH_SIZE, offset=offset)
        except Exception as exc:
            print(f"[backfill][ERROR] Failed to fetch posts (offset={offset}): {exc}", file=sys.stderr)
            sys.exit(1)

        if not posts:
            break

        for post in posts:
            post_id = str(post.get("_id", post.get("postId", "unknown")))
            embedding_status = post.get("embeddingStatus", "")

            # Idempotent: skip already-completed posts
            if embedding_status == "completed":
                print(f"[backfill] post {post_id} → already embedded, skipping")
                total_skipped += 1
                continue

            if dry_run:
                print(f"[backfill] [dry-run] would embed post {post_id}")
                total_processed += 1
                continue

            try:
                result = embed_post_sync(post)
                cluster_id = result.get("clusterId")
                cluster_label = f"cluster {cluster_id}" if cluster_id is not None else "no cluster"
                print(f"[backfill] post {post_id} → {cluster_label} ✓")
                total_processed += 1
            except Exception as exc:
                print(
                    f"[backfill][ERROR] post {post_id} failed: {exc}",
                    file=sys.stderr,
                )
                total_errors += 1

            time.sleep(RATE_LIMIT_SECONDS)

        offset += BATCH_SIZE

    print(
        f"\n[backfill] done — processed: {total_processed}, "
        f"skipped: {total_skipped}, errors: {total_errors}"
    )


if __name__ == "__main__":
    main()
