import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { useAuth } from "../lib/auth-context";

export interface WhyAmISeeingThisPopoverProps {
  post: PostCardType;
  isOpen: boolean;
  onClose: () => void;
  onNotInterested?: () => void;
  zIndex?: number;
}

type RecommendationSourceType =
  | "following"
  | "circle"
  | "topics"
  | "curated"
  | "exploration";

interface RecommendationSource {
  type: RecommendationSourceType;
  label: string;
  badgeBg: string;
  badgeText: string;
  headline: string;
  description: string;
}

function resolveRecommendationSource(post: PostCardType): RecommendationSource {
  const viewer = post.viewer as unknown as { authorFollowed?: boolean; circleMember?: boolean };

  // 1. Someone you follow
  if (viewer?.authorFollowed) {
    const name = post.author?.displayName || (post.author?.handle ? `@${post.author.handle}` : "this creator");
    return {
      type: "following",
      label: "Someone you follow",
      badgeBg: "bg-[#E6F4EA]",
      badgeText: "text-[#137333]",
      headline: `Posted by ${name}`,
      description: "You follow this creator. New contributions from people you follow are prioritized in your feed.",
    };
  }

  // 2. Your circle
  if (post.circle && (viewer?.circleMember || post.origin === "native")) {
    return {
      type: "circle",
      label: "Your circle",
      badgeBg: "bg-[#E8F0FE]",
      badgeText: "text-[#1967D2]",
      headline: `Shared in ${post.circle.name}`,
      description: "Discussions and curated stories from your joined circles are delivered directly to your daily Broadsheet.",
    };
  }

  // 3. Your topics
  if (post.hashtags && post.hashtags.length > 0) {
    const formattedTags = post.hashtags.slice(0, 2).map((t) => `#${t.replace(/^#/, "")}`).join(" & ");
    return {
      type: "topics",
      label: "Your topics",
      badgeBg: "bg-[#FCE8E6]",
      badgeText: "text-[#C5221F]",
      headline: `Matches ${formattedTags}`,
      description: "Aligned with the slow-fashion niches and style indices configured in your onboarding profile.",
    };
  }

  // 4. Curated
  if (post.authorIsCreator || post.upvoteCount > 100) {
    return {
      type: "curated",
      label: "Curated",
      badgeBg: "bg-[#F3E8FD]",
      badgeText: "text-[#7627BB]",
      headline: "Curated slow-fashion selection",
      description: "Selected by Centoire editorial curators for craft, material provenance, and design depth.",
    };
  }

  // 5. Exploration
  return {
    type: "exploration",
    label: "Exploration",
    badgeBg: "bg-[#FEF7E0]",
    badgeText: "text-[#B06000]",
    headline: "Trending discovery",
    description: "Recommended based on community engagement and emerging slow-fashion perspectives.",
  };
}

export function WhyAmISeeingThisPopover({
  post,
  isOpen,
  onClose,
  onNotInterested,
  zIndex = 60,
}: WhyAmISeeingThisPopoverProps) {
  const { user } = useAuth();
  const popoverRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";
  const source = resolveRecommendationSource(post);

  const topTopic =
    post.hashtags && post.hashtags.length > 0
      ? `#${post.hashtags[0].replace(/^#/, "")}`
      : post.subcategory || post.category || "Slow Fashion";

  // Score breakdown calculation for admin inspectability
  const upvoteScore = Math.log10(Math.max(0, post.upvoteCount) + 1) * 4;
  const authorFollowedScore = (post.viewer as unknown as { authorFollowed?: boolean })?.authorFollowed ? 6 : 0;
  const circleScore = post.circle ? 4 : 0;
  const creatorScore = post.authorIsCreator ? 3 : 0;
  const publishedDate = post.publishedAt ? new Date(post.publishedAt).getTime() : Date.now();
  const hoursOld = Math.max(0, (Date.now() - publishedDate) / (1000 * 60 * 60));
  const decayPenalty = hoursOld / 6;
  const totalScore = Math.max(
    0,
    upvoteScore + authorFollowedScore + circleScore + creatorScore - decayPenalty,
  );

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      style={{ zIndex }}
      role="dialog"
      aria-modal="false"
      aria-label="Why am I seeing this post"
      className="absolute bottom-full right-[-4px] mb-2.5 w-[245px] sm:w-[265px] rounded-[14px] bg-white border border-[#EAEAEA] shadow-[0px_4px_18px_rgba(17,17,17,0.14)] p-3 flex flex-col text-[#111111] animate-in fade-in zoom-in-95 duration-150 cursor-default"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Downward pointer tail shifted left to point right above the (i) icon */}
      <div className="absolute -bottom-[6px] right-[32px] size-[12px] bg-white border-b border-r border-[#EAEAEA] rotate-45 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between pb-2 border-b border-[#EAEAEA]">
        <div className="flex items-center gap-1.5 text-[#E5552D]">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-ui text-[10px] font-bold uppercase tracking-wider">
            WHY AM I SEEING THIS?
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close explainer"
          className="text-[#737373] hover:text-[#111111] p-0.5 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
        >
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body Content */}
      <div className="relative z-10 pt-2 flex flex-col gap-1.5">
        {/* Source Badge */}
        <div className="flex items-center justify-between">
          <span
            className={`font-ui text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${source.badgeBg} ${source.badgeText}`}
          >
            {source.label}
          </span>
          <span className="font-ui text-[10px] text-[#737373]">
            Topic: <strong className="text-[#111111] font-medium">{topTopic}</strong>
          </span>
        </div>

        <h4 className="font-editorial text-[13.5px] font-semibold text-[#111111] leading-tight mt-0.5">
          {source.headline}
        </h4>

        <p className="font-ui text-[11px] text-[#737373] leading-normal">
          {source.description}
        </p>

        {/* Admin-only Score Inspection Panel */}
        {isAdmin && (
          <div className="mt-1.5 bg-[#F7F7F7] border border-[#EAEAEA] rounded-[8px] p-2 flex flex-col gap-1 font-ui text-[10px]">
            <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-1">
              <span className="font-bold text-[#111111] uppercase tracking-wider text-[9px] flex items-center gap-1">
                <svg className="size-2.5 text-[#E5552D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Admin Score
              </span>
              <span className="font-bold text-[#E5552D]">
                Rank: {totalScore.toFixed(2)} pts
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5 text-[#555555]">
              <div>Upvotes: <strong className="text-[#111111]">+{upvoteScore.toFixed(2)}</strong></div>
              <div>Follow: <strong className="text-[#111111]">+{authorFollowedScore.toFixed(1)}</strong></div>
              <div>Circle: <strong className="text-[#111111]">+{circleScore.toFixed(1)}</strong></div>
              <div>Creator: <strong className="text-[#111111]">+{creatorScore.toFixed(1)}</strong></div>
              <div className="col-span-2 text-[#888888]">
                Decay ({hoursOld.toFixed(1)}h): -{decayPenalty.toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="relative z-10 mt-2 pt-2 border-t border-[#EAEAEA] flex items-center justify-between font-ui text-[10px]">
        <Link
          to="/settings"
          onClick={onClose}
          className="text-[#E5552D] font-medium hover:underline flex items-center gap-1"
        >
          Tune interests
          <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        {onNotInterested && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onNotInterested();
            }}
            className="text-[#737373] hover:text-[#111111] transition-colors cursor-pointer"
          >
            Not interested
          </button>
        )}
      </div>
    </div>
  );
}
