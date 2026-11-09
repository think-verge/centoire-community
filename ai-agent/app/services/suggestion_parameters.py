"""
Parameters configuration for Circle and Creator Suggestion Engine (Ticket #107).
All scoring weights, decay half-lives, thresholds, and variety constraints defined here.
"""
from dataclasses import dataclass
from typing import Tuple


@dataclass(frozen=True)
class SuggestionParameters:
    # ---------------------------------------------------------------------------
    # Decay and History Windows
    # ---------------------------------------------------------------------------
    POST_HISTORY_DAYS: int = 60           # 60 days of posts for circle/creator mix
    MIX_DECAY_HALF_LIFE_DAYS: float = 14.0 # 14-day half-life decay on post points
    INACTIVE_CUTOFF_DAYS: int = 30         # Filter circles/creators with no posts in 30 days

    # ---------------------------------------------------------------------------
    # Circle Scoring Weights
    # Formula: 3 * match + 2 * friends + 1.5 * activity + 1 * engagement
    # ---------------------------------------------------------------------------
    CIRCLE_WEIGHT_MATCH: float = 3.0
    CIRCLE_WEIGHT_FRIENDS: float = 2.0
    CIRCLE_WEIGHT_ACTIVITY: float = 1.5
    CIRCLE_WEIGHT_ENGAGEMENT: float = 1.0

    # ---------------------------------------------------------------------------
    # Creator Scoring Weights
    # Formula: 3 * match + 3 * engaged + 2 * friends + 1 * active + 1 * engagement
    # ---------------------------------------------------------------------------
    CREATOR_WEIGHT_MATCH: float = 3.0
    CREATOR_WEIGHT_ENGAGED: float = 3.0
    CREATOR_WEIGHT_FRIENDS: float = 2.0
    CREATOR_WEIGHT_ACTIVE: float = 1.0
    CREATOR_WEIGHT_ENGAGEMENT: float = 1.0

    # ---------------------------------------------------------------------------
    # Friends Signal Quantization
    # Quantized to (0.0, 0.33, 0.67, 1.0)
    # ---------------------------------------------------------------------------
    FRIENDS_LEVELS: Tuple[float, float, float, float] = (0.0, 0.33, 0.67, 1.0)

    # ---------------------------------------------------------------------------
    # Variety and Arrangement Rules
    # ---------------------------------------------------------------------------
    MAX_CONSECUTIVE_CLUSTER: int = 2       # Max 2 in a row from one cluster
    EMERGING_CREATOR_INTERVAL: int = 4     # At least 1 in 4 for smaller/newer creators
    EMERGING_CREATOR_MAX_FOLLOWERS: int = 100

    # ---------------------------------------------------------------------------
    # Feedback Thresholds
    # ---------------------------------------------------------------------------
    FEEDBACK_JOIN_TOPIC_POINTS: float = 3.0 # +3 points to target's top clusters
    DISMISS_HIDE_DAYS: int = 30             # Dismiss = hide 30 days
    IGNORE_HIDE_DAYS: int = 14              # Ignore 3 times = hide 14 days
    IGNORE_THRESHOLD_COUNT: int = 3


# Global parameters singleton
DEFAULT_SUGGESTION_PARAMS = SuggestionParameters()

