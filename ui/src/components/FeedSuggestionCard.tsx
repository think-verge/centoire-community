import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { customInstance } from "../lib/api/http";
import { useAuth } from "../lib/auth-context";
import { useFollowUser } from "../lib/api/generated/users/users";
import { useJoinCircle } from "../lib/api/generated/circles/circles";

interface SuggestedCircle {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl?: string;
  memberCount: number;
  reason?: string;
}

interface SuggestedCreator {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  followerCount: number;
  isEmerging?: boolean;
  reason?: string;
}

export function FeedSuggestionCard({ onDismiss }: { onDismiss?: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"circles" | "creators">("circles");
  const [circles, setCircles] = useState<SuggestedCircle[]>([]);
  const [creators, setCreators] = useState<SuggestedCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joinedCircleIds, setJoinedCircleIds] = useState<Set<string>>(new Set());
  const [followedUserHandles, setFollowedUserHandles] = useState<Set<string>>(new Set());
  const [dismissedLocally, setDismissedLocally] = useState(false);

  const followMutation = useFollowUser();
  const joinMutation = useJoinCircle();

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      setIsLoading(true);
      try {
        if (user) {
          // Authenticated: fetch from suggestions API
          const [circlesRes, creatorsRes] = await Promise.allSettled([
            customInstance<{ items: SuggestedCircle[] }>({
              url: "/suggestions/circles?limit=5",
              method: "GET",
            }),
            customInstance<{ items: SuggestedCreator[] }>({
              url: "/suggestions/creators?limit=5",
              method: "GET",
            }),
          ]);

          if (cancelled) return;

          if (circlesRes.status === "fulfilled" && circlesRes.value?.items?.length) {
            setCircles(circlesRes.value.items.slice(0, 5));
          } else {
            // Fallback public circles
            await loadFallbackCircles();
          }

          if (creatorsRes.status === "fulfilled" && creatorsRes.value?.items?.length) {
            setCreators(creatorsRes.value.items.slice(0, 5));
          }
        } else {
          // Guest: load public fallback circles
          await loadFallbackCircles();
        }
      } catch {
        if (!cancelled) {
          await loadFallbackCircles();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function loadFallbackCircles() {
      try {
        const res = await customInstance<{ items: Array<{ id: string; name: string; slug: string; description: string; memberCount: number; avatarUrl?: string }> }>({
          url: "/circles?limit=5",
          method: "GET",
        });
        if (!cancelled && res?.items?.length) {
          setCircles(
            res.items.slice(0, 5).map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              description: c.description || "Active community circle",
              avatarUrl: c.avatarUrl,
              memberCount: c.memberCount || 1,
              reason: "Popular circle",
            })),
          );
        }
      } catch {
        // Fallback static
        if (!cancelled) {
          setCircles([
            { id: "1", name: "Fashion & Editorial", slug: "fashion", description: "Curated fashion essays and aesthetics", memberCount: 142, reason: "Trending" },
            { id: "2", name: "Digital Culture", slug: "digital-culture", description: "Design, internet culture & society", memberCount: 98, reason: "Recommended" },
            { id: "3", name: "Art & Architecture", slug: "art-architecture", description: "Visual architecture and modern art", memberCount: 76, reason: "Featured" },
          ]);
        }
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleDismissItem = async (type: "circle" | "creator", id: string) => {
    if (type === "circle") {
      setCircles((prev) => prev.filter((c) => c.id !== id));
    } else {
      setCreators((prev) => prev.filter((c) => c.id !== id));
    }

    if (user) {
      try {
        await customInstance({
          url: "/suggestions/dismiss",
          method: "POST",
          data: { targetType: type, targetId: id },
        });
      } catch {
        // Non-blocking
      }
    }
  };

  const handleJoinCircle = (circle: SuggestedCircle) => {
    setJoinedCircleIds((prev) => new Set(prev).add(circle.id));
    joinMutation.mutate({ slug: circle.slug });
  };

  const handleFollowCreator = (creator: SuggestedCreator) => {
    setFollowedUserHandles((prev) => new Set(prev).add(creator.handle));
    followMutation.mutate({ id: creator.id });
  };

  const handleDismissCard = () => {
    setDismissedLocally(true);
    onDismiss?.();
  };

  if (dismissedLocally) return null;

  return (
    <article
      className="group relative break-inside-avoid rounded-[16px] bg-white flex flex-col flex-1 min-h-[320px] h-full transition-shadow duration-300 p-4 border border-[#EAEAEA]"
      style={{ boxShadow: "0px 4px 14px rgba(17, 17, 17, 0.14)" }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-1.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-[#E4572E]/10 text-[#E4572E]">
            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <h4 className="font-ui text-[12px] font-bold tracking-wider uppercase text-[#111111]">
            Suggested for You
          </h4>
        </div>
        <button
          type="button"
          onClick={handleDismissCard}
          aria-label="Dismiss suggestions"
          className="text-[#999999] hover:text-[#111111] p-1 rounded-md transition-colors"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 my-3">
        <button
          type="button"
          onClick={() => setActiveTab("circles")}
          className={`flex-1 py-1.5 text-center text-[11px] font-ui font-semibold rounded-lg transition-colors ${
            activeTab === "circles"
              ? "bg-[#111111] text-white"
              : "bg-[#F5F5F5] text-[#666666] hover:bg-[#EAEAEA]"
          }`}
        >
          Circles to join
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("creators")}
          className={`flex-1 py-1.5 text-center text-[11px] font-ui font-semibold rounded-lg transition-colors ${
            activeTab === "creators"
              ? "bg-[#111111] text-white"
              : "bg-[#F5F5F5] text-[#666666] hover:bg-[#EAEAEA]"
          }`}
        >
          People to follow
        </button>
      </div>

      {/* Content List */}
      <div className="flex-1 flex flex-col gap-2.5 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-3 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="size-9 rounded-full bg-[#F0F0F0] shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3 w-3/4 rounded bg-[#F0F0F0]" />
                  <div className="h-2.5 w-1/2 rounded bg-[#F0F0F0]" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === "circles" ? (
          circles.length > 0 ? (
            circles.slice(0, 4).map((circle) => {
              const isJoined = joinedCircleIds.has(circle.id);
              return (
                <div
                  key={circle.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-[#FAFAFA] transition-colors"
                >
                  <Link
                    to={`/c/${circle.slug}`}
                    className="flex items-center gap-2.5 min-w-0 flex-1 group/item"
                  >
                    <div className="size-8 rounded-full bg-[#111111]/5 flex items-center justify-center font-editorial font-bold text-[#111111] text-xs shrink-0">
                      {circle.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-ui text-[13px] font-semibold text-[#111111] truncate group-hover/item:text-[#E4572E]">
                        {circle.name}
                      </p>
                      <p className="font-ui text-[11px] text-[#737373] truncate">
                        {circle.reason || `${circle.memberCount} members`}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isJoined}
                      onClick={() => handleJoinCircle(circle)}
                      className={`text-[11px] font-ui font-semibold px-2.5 py-1 rounded-full transition-colors ${
                        isJoined
                          ? "bg-[#EAEAEA] text-[#737373] cursor-default"
                          : "bg-[#E4572E] text-white hover:bg-[#D04922]"
                      }`}
                    >
                      {isJoined ? "Joined" : "Join"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismissItem("circle", circle.id)}
                      className="text-[#B0B0B0] hover:text-[#111111] p-1"
                      title="Dismiss"
                    >
                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center font-ui text-xs text-[#888888] py-6">All circles caught up!</p>
          )
        ) : creators.length > 0 ? (
          creators.slice(0, 4).map((creator) => {
            const isFollowed = followedUserHandles.has(creator.handle);
            return (
              <div
                key={creator.id}
                className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-[#FAFAFA] transition-colors"
              >
                <Link
                  to={`/u/${creator.handle}`}
                  className="flex items-center gap-2.5 min-w-0 flex-1 group/item"
                >
                  <div className="size-8 rounded-full bg-[#111111]/5 flex items-center justify-center font-editorial font-bold text-[#111111] text-xs shrink-0">
                    {creator.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-[13px] font-semibold text-[#111111] truncate group-hover/item:text-[#E4572E]">
                      {creator.displayName}
                    </p>
                    <p className="font-ui text-[11px] text-[#737373] truncate">
                      @{creator.handle} {creator.reason ? `· ${creator.reason}` : ""}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={isFollowed}
                    onClick={() => handleFollowCreator(creator)}
                    className={`text-[11px] font-ui font-semibold px-2.5 py-1 rounded-full transition-colors ${
                      isFollowed
                        ? "bg-[#EAEAEA] text-[#737373] cursor-default"
                        : "bg-[#111111] text-white hover:bg-black"
                    }`}
                  >
                    {isFollowed ? "Following" : "Follow"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissItem("creator", creator.id)}
                    className="text-[#B0B0B0] hover:text-[#111111] p-1"
                    title="Dismiss"
                  >
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center font-ui text-xs text-[#888888] py-6">All creators caught up!</p>
        )}
      </div>

      {/* Footer Explore Link */}
      <div className="pt-2 border-t border-[#F0F0F0] mt-auto text-center">
        <Link
          to={activeTab === "circles" ? "/circles" : "/discover"}
          className="font-ui text-[11px] font-semibold text-[#E4572E] hover:underline inline-flex items-center gap-1"
        >
          Explore more {activeTab === "circles" ? "circles" : "creators"} &rarr;
        </Link>
      </div>
    </article>
  );
}
