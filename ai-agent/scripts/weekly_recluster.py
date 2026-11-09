"""
Weekly / monthly reclustering job.

Usage:
    python -m scripts.weekly_recluster [--dry-run] [--clusters 40]

Workflow:
1. Reclusters all post embeddings.
2. Matches new clusters to old centres via Hungarian algorithm (linear sum assignment)
   so that cluster IDs persist across runs (stability guarantee).
3. Computes transition matrix M for proportional mix remapping.
4. Stages new cluster centres under version v + 1.
5. Executes versioned cutover:
   - Updates posts' cluster assignments and versions.
   - Activates version v + 1 atomically in metadata.
   - Feeds never see mixed versions.
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
        description="Weekly reclustering job with cluster ID persistence and mix remapping."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview cluster matching and version increment without writing changes.",
    )
    parser.add_argument(
        "--clusters",
        type=int,
        default=None,
        help="Target number of clusters (30-50, default from TOPIC_N_CLUSTERS or 40).",
    )
    args = parser.parse_args()

    n_clusters = args.clusters or get_cluster_config()
    print(
        f"[weekly_recluster] Starting weekly recluster job (n_clusters={n_clusters}, "
        f"dry_run={args.dry_run})..."
    )

    result = asyncio.run(
        run_recluster_job(
            dry_run=args.dry_run,
            n_clusters=n_clusters,
        )
    )

    print("\n[weekly_recluster] Execution Result:")
    for k, v in result.items():
        print(f"  {k}: {v}")

    if result.get("status") in ("completed", "dry_run"):
        print("\n[weekly_recluster] Reclustering job completed successfully ✓")
    else:
        print(f"\n[weekly_recluster] Job paused/skipped: {result.get('reason', 'unknown')}")


if __name__ == "__main__":
    main()

