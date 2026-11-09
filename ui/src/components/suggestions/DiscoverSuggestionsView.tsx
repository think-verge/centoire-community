import { useState } from "react";
import { Link } from "react-router-dom";
import { AvatarBubble } from "../AppShell";
import { Button } from "../Button";
import { SuggestionReasonBadge } from "./SuggestionReasonBadge";
import {
  useSuggestedCircles,
  useSuggestedCreators,
  useDismissSuggestion,
  type SuggestedCircle,
  type SuggestedCreator,
} from "../../lib/api/suggestions";
import { useJoinCircle } from "../../lib/api/generated/circles/circles";
import { useFollowUser, useUnfollowUser } from "../../lib/api/generated/users/users";

export function DiscoverSuggestionsView() {
  const [activeTab, setActiveTab] = useState<"all" | "circles" | "creators">("all");
  const { data: rawCircles, isLoading: circlesLoading } = useSuggestedCircles(12);
  const { data: rawCreators, isLoading: creatorsLoading } = useSuggestedCreators(12);
  const dismissMutation = useDismissSuggestion();
  const joinMutation = useJoinCircle();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const [dismissedCircleIds, setDismissedCircleIds] = useState<Set<string>>(new Set());
  const [dismissedCreatorIds, setDismissedCreatorIds] = useState<Set<string>>(new Set());
  const [joinedCircleIds, setJoinedCircleIds] = useState<Set<string>>(new Set());
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());

  const circles = (rawCircles || []).filter((c) => !dismissedCircleIds.has(c.id));
  const creators = (rawCreators || []).filter((c) => !dismissedCreatorIds.has(c.id));

  const handleDismissCircle = (circleId: string) => {
    setDismissedCircleIds((prev) => new Set(prev).add(circleId));
    dismissMutation.mutate({ targetType: "circle", targetId: circleId });
  };

  const handleDismissCreator = (creatorId: string) => {
    setDismissedCreatorIds((prev) => new Set(prev).add(creatorId));
    dismissMutation.mutate({ targetType: "creator", targetId: creatorId });
  };

  const handleJoinCircle = (circle: SuggestedCircle) => {
    setJoinedCircleIds((prev) => new Set(prev).add(circle.id));
    joinMutation.mutate({ slug: circle.slug });
  };

  const handleFollowToggle = (creator: SuggestedCreator) => {
    const isFollowing = followedUserIds.has(creator.id);
    if (isFollowing) {
      setFollowedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(creator.id);
        return next;
      });
      unfollowMutation.mutate({ id: creator.id });
    } else {
      setFollowedUserIds((prev) => new Set(prev).add(creator.id));
      followMutation.mutate({ id: creator.id });
    }
  };

  const isLoading = circlesLoading || creatorsLoading;

  return (
    <div className="space-y-8">
      {/* Category Pills Bar */}
      <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          {(
            [
              { id: "all", label: "All Suggestions" },
              { id: "circles", label: `Circles (${circles.length})` },
              { id: "creators", label: `Creators (${creators.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-ink text-ink-inverse shadow-sm"
                  : "border border-line bg-paper text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-8 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-surface/70 border border-line/40" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && circles.length === 0 && creators.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-12 text-center bg-paper">
          <p className="font-editorial text-2xl font-bold text-ink">No suggestions right now</p>
          <p className="mt-2 text-sm text-ink-soft max-w-md mx-auto">
            As you explore circles and follow creators across the community, your recommendations will personalize automatically.
          </p>
        </div>
      )}

      {/* CIRCLES SECTION */}
      {!isLoading && (activeTab === "all" || activeTab === "circles") && circles.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="kicker">Recommended Communities</p>
              <h2 className="font-editorial text-2xl font-bold text-ink">Circles you might like</h2>
            </div>
            <Link to="/circles" className="text-xs font-semibold text-primary hover:underline">
              View all circles →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {circles.map((circle) => {
              const isJoined = joinedCircleIds.has(circle.id);
              return (
                <div
                  key={circle.id}
                  className="relative flex flex-col justify-between rounded-xl border border-line bg-paper p-5 transition-all hover:border-ink-soft/40 hover:shadow-sm"
                >
                  <button
                    type="button"
                    aria-label={`Dismiss ${circle.name}`}
                    onClick={() => handleDismissCircle(circle.id)}
                    className="absolute top-3.5 right-3.5 p-1 text-ink-faint hover:text-ink rounded-full transition-colors cursor-pointer"
                    title="Not interested"
                  >
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>

                  <div>
                    <div className="flex items-start gap-3 mb-3 pr-6">
                      <div className="size-12 rounded-xl bg-surface border border-line flex items-center justify-center font-display-serif text-xl font-bold text-ink shrink-0 overflow-hidden">
                        {circle.avatarUrl ? (
                          <img src={circle.avatarUrl} alt={circle.name} className="size-full object-cover" />
                        ) : (
                          circle.name.charAt(0)
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link to={`/c/${circle.slug}`} className="font-semibold text-base text-ink hover:text-primary transition-colors block truncate">
                          {circle.name}
                        </Link>
                        <p className="text-xs text-ink-faint">{circle.memberCount} members</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <SuggestionReasonBadge reason={circle.reason} />
                    </div>

                    <p className="text-xs text-ink-soft line-clamp-2 leading-relaxed mb-4">
                      {circle.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[11px] text-ink-faint">
                      {circle.isPrivate ? "Private Circle" : "Open Circle"}
                    </span>
                    <Button
                      variant={isJoined ? "secondary" : "primary"}
                      onClick={() => handleJoinCircle(circle)}
                      disabled={isJoined}
                      className="text-xs px-4 py-1 h-8"
                    >
                      {isJoined ? "Joined" : "Join Circle"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CREATORS SECTION */}
      {!isLoading && (activeTab === "all" || activeTab === "creators") && creators.length > 0 && (
        <section className={activeTab === "all" && circles.length > 0 ? "pt-6 border-t border-line" : ""}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="kicker">Influential Curators</p>
              <h2 className="font-editorial text-2xl font-bold text-ink">Creators to follow</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {creators.map((creator) => {
              const isFollowing = followedUserIds.has(creator.id);
              return (
                <div
                  key={creator.id}
                  className="relative flex flex-col justify-between rounded-xl border border-line bg-paper p-5 transition-all hover:border-ink-soft/40 hover:shadow-sm"
                >
                  <button
                    type="button"
                    aria-label={`Dismiss ${creator.displayName}`}
                    onClick={() => handleDismissCreator(creator.id)}
                    className="absolute top-3.5 right-3.5 p-1 text-ink-faint hover:text-ink rounded-full transition-colors cursor-pointer"
                    title="Not interested"
                  >
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>

                  <div>
                    <div className="flex items-start gap-3 mb-3 pr-6">
                      <AvatarBubble name={creator.displayName} url={creator.avatarUrl ?? null} size="size-12 text-lg shrink-0" />
                      <div className="min-w-0">
                        <Link to={`/u/${creator.handle}`} className="font-semibold text-base text-ink hover:text-primary transition-colors block truncate">
                          {creator.displayName}
                        </Link>
                        <p className="text-xs text-ink-faint">@{creator.handle}</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <SuggestionReasonBadge reason={creator.reason} />
                    </div>

                    {creator.bio && (
                      <p className="text-xs text-ink-soft line-clamp-2 leading-relaxed mb-4">
                        {creator.bio}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-line/40 flex items-center justify-between">
                    <span className="text-[11px] text-ink-faint">
                      <strong>{creator.followerCount}</strong> followers
                    </span>
                    <Button
                      variant={isFollowing ? "secondary" : "primary"}
                      onClick={() => handleFollowToggle(creator)}
                      className="text-xs px-4 py-1 h-8"
                    >
                      {isFollowing ? "Following" : "Follow"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
