"""
Initial clustering script: Run once on the curated library before the first member signs up.

Usage:
    python -m scripts.cluster_posts [--dry-run] [--clusters 40]

Workflow:
1. Fetches all posts with embeddings from the backend.
2. Fits K-means (default 40 clusters, configurable 30-50).
3. L2-normalizes centres so dot product == cosine similarity.
4. Stages clusters as version 1.
5. Executes cutover to activate version 1 and assign all posts.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

# Ensure ai-agent directory is on sys.path regardless of current working directory
_ai_agent_root = Path(__file__).resolve().parent.parent
if str(_ai_agent_root) not in sys.path:
    sys.path.insert(0, str(_ai_agent_root))

from dotenv import load_dotenv

load_dotenv(_ai_agent_root / ".env")
load_dotenv()

from app.services.clustering_service import get_cluster_config
from app.services.recluster_orchestrator import run_recluster_job


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Bootstrap initial topic clusters on post embeddings (version 1)."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview cluster counts and assignments without saving.",
    )
    parser.add_argument(
        "--clusters",
        type=int,
        default=None,
        help="Number of clusters (30-50, default from TOPIC_N_CLUSTERS or 40).",
    )
    args = parser.parse_args()

    n_clusters = args.clusters or get_cluster_config()
    print(
        f"[cluster_posts] Initializing clustering job (n_clusters={n_clusters}, "
        f"dry_run={args.dry_run})..."
    )

    result = asyncio.run(
        run_recluster_job(
            dry_run=args.dry_run,
            n_clusters=n_clusters,
        )
    )

    print("\n[cluster_posts] Execution Result:")
    for k, v in result.items():
        print(f"  {k}: {v}")

    if result.get("status") in ("completed", "dry_run"):
        print("\n[cluster_posts] Done ✓")
    else:
        print(f"\n[cluster_posts] Incomplete: {result.get('reason', 'unknown')}")


if __name__ == "__main__":
    main()

