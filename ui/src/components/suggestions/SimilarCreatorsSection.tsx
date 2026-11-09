import { useState } from "react";
import { Link } from "react-router-dom";
import { AvatarBubble } from "../AppShell";
import { Button } from "../Button";
import { SuggestionReasonBadge } from "./SuggestionReasonBadge";
import {
  useSuggestedCreators,
  useDismissSuggestion,
  type SuggestedCreator,
} from "../../lib/api/suggestions";
import { useFollowUser, useUnfollowUser } from "../../lib/api/generated/users/users";
import { useAuth } from "../../lib/auth-context";

export function SimilarCreatorsSection({ currentUserId }: { currentUserId?: string }) {
  const { user } = useAuth();
  const { data: rawCreators, isLoading, isError } = useSuggestedCreators(8);
  const dismissMutation = useDismissSuggestion();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  // Filter out current user and dismissed creators
  const creators = (rawCreators || [])
    .filter((c) => c.id !== currentUserId && c.id !== user?.id)
    .filter((c) => !dismissedIds.has(c.id));

  const handleDismiss = (creatorId: string) => {
    // Immediate optimistic hide
    setDismissedIds((prev) => new Set(prev).add(creatorId));
    dismissMutation.mutate({ targetType: "creator", targetId: creatorId });
  };

  const handleFollowToggle = (creator: SuggestedCreator) => {
    const isFollowing = followedIds.has(creator.id);
    if (isFollowing) {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(creator.id);
        return next;
      });
      unfollowMutation.mutate({ id: creator.id });
    } else {
      setFollowedIds((prev) => new Set(prev).add(creator.id));
      followMutation.mutate({ id: creator.id });
    }
  };

  if (isLoading) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-paper p-6">
        <p className="kicker mb-4">Discover similar voices</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-lg bg-surface/60 border border-line/40" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || creators.length === 0) {
    return null;
  }

  return (
    <section className="mt-10 rounded-xl border border-line bg-paper p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="kicker">Recommended creators</p>
          <h2 className="font-display-serif text-xl font-semibold text-ink">Similar creators to follow</h2>
        </div>
        <span className="text-xs text-ink-faint">{creators.length} suggestions</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {creators.map((creator) => {
          const isFollowing = followedIds.has(creator.id);
          return (
            <div
              key={creator.id}
              className="relative flex flex-col justify-between rounded-lg border border-line bg-surface/30 p-4 transition-all hover:border-ink-soft/40 hover:shadow-sm"
            >
              {/* Dismiss button */}
              <button
                type="button"
                aria-label={`Dismiss ${creator.displayName}`}
                onClick={() => handleDismiss(creator.id)}
                className="absolute top-2.5 right-2.5 p-1 text-ink-faint hover:text-ink hover:bg-surface rounded-full transition-colors cursor-pointer"
                title="Not interested"
              >
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div className="flex flex-col items-center text-center">
                <Link to={`/u/${creator.handle}`} className="group flex flex-col items-center">
                  <AvatarBubble name={creator.displayName} url={creator.avatarUrl ?? null} size="size-14 text-xl mb-2" />
                  <p className="font-semibold text-sm text-ink group-hover:text-primary transition-colors truncate max-w-[170px]">
                    {creator.displayName}
                  </p>
                  <p className="text-xs text-ink-faint truncate max-w-[170px]">@{creator.handle}</p>
                </Link>

                <div className="mt-2 mb-3">
                  <SuggestionReasonBadge reason={creator.reason} />
                </div>

                {creator.bio && (
                  <p className="text-xs text-ink-soft line-clamp-2 mb-3 px-1">
                    {creator.bio}
                  </p>
                )}
              </div>

              <div className="mt-auto pt-2 border-t border-line/40 flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-faint">
                  <strong>{creator.followerCount}</strong> followers
                </span>
                <Button
                  variant={isFollowing ? "secondary" : "primary"}
                  onClick={() => handleFollowToggle(creator)}
                  className="text-xs px-3 py-1 h-8"
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
