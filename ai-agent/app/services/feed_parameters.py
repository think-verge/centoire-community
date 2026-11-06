"""
Feed Engine Parameters to Tune (Ticket #106 / Flow 5).

Single source of truth for all tunable constants across candidate retrieval,
negative filtering, scoring weights, variety arrangement, and caching.
"""

from dataclasses import dataclass, field
from typing import Tuple


@dataclass(frozen=True)
class FeedParameters:
    # ---------------------------------------------------------------------------
    # Candidate Generation Budget (~200 total candidates)
    # ---------------------------------------------------------------------------
    CANDIDATE_POOL_TARGET: int = 200

    # Topic mix candidates: 100 slots proportional to share
    TOPIC_MIX_SLOTS: int = 100
    TOPIC_MIX_CLUSTER_FLOOR: int = 5  # minimum candidate slots per active cluster
    TOPIC_MIX_CLUSTER_CAP: int = 40   # maximum candidate slots per active cluster
    TOPIC_MIX_WINDOW_DAYS: int = 7    # newest and most-engaged from the last 7 days

    # Following candidates: 40 slots from followed accounts (72 h window)
    FOLLOWING_SLOTS: int = 40
    FOLLOWING_WINDOW_HOURS: int = 72

    # Circle candidates: 30 slots (most-engaged, 72 h window)
    CIRCLES_SLOTS: int = 30
    CIRCLES_WINDOW_HOURS: int = 72

    # Curated candidates: 15 slots (platform curated/editorial)
    CURATED_SLOTS: int = 15

    # Exploration candidates: 15 slots (good posts from clusters where user has 0% share)
    EXPLORATION_SLOTS: int = 15

    # ---------------------------------------------------------------------------
    # Negative Filters
    # ---------------------------------------------------------------------------
    SEEN_POSTS_WINDOW_DAYS: int = 7
    # Cosine similarity threshold against negative list (hidden posts)
    HIDDEN_SIMILARITY_THRESHOLD: float = 0.82

    # ---------------------------------------------------------------------------
    # Scoring Formula:
    # 3.0 x interest + 2.0 x freshness(48 h half-life) + 2.0 x follows + 1.5 x in_circle
    # ---------------------------------------------------------------------------
    WEIGHT_INTEREST: float = 3.0
    WEIGHT_FRESHNESS: float = 2.0
    FRESHNESS_HALF_LIFE_HOURS: float = 48.0
    WEIGHT_FOLLOWS: float = 2.0
    WEIGHT_IN_CIRCLE: float = 1.5

    # ---------------------------------------------------------------------------
    # Variety Arrangement (Top 20)
    # ---------------------------------------------------------------------------
    # Author diversity: skip if author already has 2 posts in the last 10 positions
    VARIETY_AUTHOR_WINDOW: int = 10
    VARIETY_AUTHOR_MAX_COUNT: int = 2

    # Topic diversity: skip if previous 3 are the same cluster
    VARIETY_CONSECUTIVE_CLUSTER_LIMIT: int = 3

    # Exploration insertion positions in top 20 (1-based: positions 5, 12, 18)
    EXPLORATION_POSITIONS: Tuple[int, ...] = (5, 12, 18)

    # ---------------------------------------------------------------------------
    # Caching, Serving & Pagination
    # ---------------------------------------------------------------------------
    BUILD_SIZE: int = 60          # build 60 items
    SERVE_PAGE_SIZE: int = 20     # serve 20 per page
    CACHE_TTL_MINUTES: int = 15   # cache for 15 minutes
    CACHE_TTL_SECONDS: int = 15 * 60


# Global parameters singleton
DEFAULT_FEED_PARAMS = FeedParameters()
