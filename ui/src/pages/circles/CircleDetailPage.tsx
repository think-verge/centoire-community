import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CircleRulesModal } from "../../components/CircleRulesModal";
import { customInstance } from "../../lib/api/http";
import {
  useGetCircle,
  useJoinCircle,
  useLeaveCircle,
  useListCircleMembers,
  useListCirclePostsInfinite,
  useListCircles,
} from "../../lib/api/generated/circles/circles";

/* --- Exact Figma SVG Icons for Meatball Hover Menus --- */
function ShareIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function BookmarkIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HashIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function BellOffIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
      <path d="M18 8a6 6 0 0 0-9.33-5" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function FlagIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function MessageSquareIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UserIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function XIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TranslateIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

interface CircleFeedPostData {
  id: string;
  slug?: string;
  author: {
    id?: string;
    name: string;
    avatarColor: string;
    avatarInitial: string;
    avatarUrl?: string;
    isFollowed?: boolean;
  };
  timeAgo: string;
  title: string;
  body: string;
  mediaType?: "video" | "photo";
  mediaUrl?: string;
  images?: string[];
  duration?: string;
  upvotes: string;
  downvotes: string;
  comments: string;
  shares: string;
  bookmarks: string;
}

export interface HighlightItem {
  id: string;
  badgeText: string;
  badgeBg: string;
  count: string;
  text: string;
  imageUrl?: string;
  bgClass?: string;
  slug?: string;
}

/* --- Helper utilities for count formatting & local persistence --- */
function parseCount(val: string | number | undefined): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const str = String(val).trim().toLowerCase();
  if (str.endsWith("k")) {
    return Math.round(parseFloat(str.replace("k", "")) * 1000);
  }
  if (str.endsWith("m")) {
    return Math.round(parseFloat(str.replace("m", "")) * 1000000);
  }
  const num = parseInt(str.replace(/[^0-9]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

function formatCount(num: number): string {
  if (num < 0) num = 0;
  if (num >= 1000000) {
    const val = (num / 1000000).toFixed(1);
    return val.endsWith(".0") ? `${val.slice(0, -2)}m` : `${val}m`;
  }
  if (num >= 1000) {
    const val = (num / 1000).toFixed(1);
    return val.endsWith(".0") ? `${val.slice(0, -2)}k` : `${val}k`;
  }
  return String(num);
}

function getStoredFollowedAuthors(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem("centoire_followed_authors") || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveFollowedAuthorLocally(idOrName: string, isFollowed: boolean) {
  try {
    const list = getStoredFollowedAuthors();
    const updated = isFollowed
      ? Array.from(new Set([...list, idOrName]))
      : list.filter((item) => item !== idOrName);
    localStorage.setItem("centoire_followed_authors", JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function getStoredDismissedPostIds(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem("centoire_hidden_posts") || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveDismissedPostLocally(id: string) {
  try {
    const list = getStoredDismissedPostIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem("centoire_hidden_posts", JSON.stringify(list));
    }
  } catch {
    // ignore
  }
}

interface PostLocalState {
  userVoted?: 1 | -1 | null;
  upvoteDelta?: number;
  downvoteDelta?: number;
  hasShared?: boolean;
  sharesDelta?: number;
  bookmarked?: boolean;
  bookmarkDelta?: number;
  commentDelta?: number;
}

function getAllPostLocalStates(): Record<string, PostLocalState> {
  try {
    const raw = localStorage.getItem("centoire_post_local_states");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getPostLocalState(postId: string): PostLocalState {
  const all = getAllPostLocalStates();
  return all[postId] || {};
}

function updatePostLocalState(postId: string, updates: Partial<PostLocalState>) {
  try {
    const all = getAllPostLocalStates();
    all[postId] = { ...(all[postId] || {}), ...updates };
    localStorage.setItem("centoire_post_local_states", JSON.stringify(all));
  } catch {
    // ignore
  }
}

/* --- Circle Feed Post Card with Exact Figma Styling and Feed-Level Hover Menu --- */
function CircleFeedCard({
  post,
  onToast,
  onDismiss,
}: {
  post: CircleFeedPostData;
  onToast?: (msg: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Author follow state: initialized from localStorage or post data
  const authorKey = post.author.id || post.author.name;
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(() => {
    if (post.author.isFollowed) return true;
    return getStoredFollowedAuthors().includes(authorKey);
  });

  // Base counts from props
  const baseUpvotes = useRef(parseCount(post.upvotes));
  const baseDownvotes = useRef(parseCount(post.downvotes));
  const baseShares = useRef(parseCount(post.shares));
  const baseBookmarks = useRef(parseCount(post.bookmarks));
  const baseComments = useRef(parseCount(post.comments));

  // Local persistent state for this post
  const postLocal = getPostLocalState(post.id);

  // Interconnected Upvote & Downvote counts (frontend handles separate downvotes)
  const [upvoteDelta, setUpvoteDelta] = useState(postLocal.upvoteDelta ?? 0);
  const [downvoteDelta, setDownvoteDelta] = useState(postLocal.downvoteDelta ?? 0);
  const [userVoted, setUserVoted] = useState<1 | -1 | null>(postLocal.userVoted ?? null);

  // Shares count (limited to 1 share per user, persistent)
  const [hasShared, setHasShared] = useState(postLocal.hasShared ?? false);
  const [sharesDelta, setSharesDelta] = useState(postLocal.sharesDelta ?? 0);

  // Bookmarking state & count (persistent)
  const [bookmarked, setBookmarked] = useState(postLocal.bookmarked ?? false);
  const [bookmarkDelta, setBookmarkDelta] = useState(postLocal.bookmarkDelta ?? 0);

  // Comments count delta (persistent)
  const [commentDelta] = useState(postLocal.commentDelta ?? 0);

  useEffect(() => {
    baseUpvotes.current = parseCount(post.upvotes);
    baseDownvotes.current = parseCount(post.downvotes);
    baseShares.current = parseCount(post.shares);
    baseBookmarks.current = parseCount(post.bookmarks);
    baseComments.current = parseCount(post.comments);
  }, [post.upvotes, post.downvotes, post.shares, post.bookmarks, post.comments]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMenuOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setMenuOpen(false), 200);
  };

  const handleShare = async () => {
    setMenuOpen(false);
    if (!hasShared) {
      setHasShared(true);
      setSharesDelta(1);
      updatePostLocalState(post.id, { hasShared: true, sharesDelta: 1 });
    }
    const postSlug = post.slug || post.id;
    const shareUrl = `${window.location.origin}/p/${postSlug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      onToast?.("Post link copied to clipboard!");
    } catch {
      onToast?.("Unable to copy link");
    }
  };

  const handleFollowPost = () => {
    setMenuOpen(false);
    onToast?.("Post notifications coming soon (not yet supported by backend)");
  };

  const handleFollowPerson = async () => {
    const nextState = !isFollowingAuthor;
    setIsFollowingAuthor(nextState);
    saveFollowedAuthorLocally(authorKey, nextState);

    if (nextState) {
      onToast?.(`Following ${post.author.name}`);
      if (post.author.id) {
        try {
          await customInstance({ url: `/users/${post.author.id}/follow`, method: "POST" });
        } catch {
          // ignore
        }
      }
    } else {
      onToast?.(`Unfollowed ${post.author.name}`);
      if (post.author.id) {
        try {
          await customInstance({ url: `/users/${post.author.id}/follow`, method: "DELETE" });
        } catch {
          // ignore
        }
      }
    }
  };

  const handleMutePerson = () => {
    setMenuOpen(false);
    onToast?.("User muting coming soon (not yet supported by backend)");
  };

  const handleNotInterested = async () => {
    setMenuOpen(false);
    saveDismissedPostLocally(post.id);
    onDismiss?.(post.id);
    onToast?.("Post hidden · Centoire will show less like this");
    if (post.id) {
      try {
        await customInstance({ url: `/posts/${post.id}/not-interested`, method: "POST" });
      } catch (err) {
        console.error("Not interested error:", err);
      }
    }
  };

  const handleTranslate = () => {
    setMenuOpen(false);
    onToast?.("Translation coming soon (not yet supported by backend)");
  };

  const handleReport = async () => {
    setMenuOpen(false);
    if (post.id) {
      try {
        await customInstance({ url: `/posts/${post.id}/report`, method: "POST" });
        onToast?.("Post reported · Thank you for keeping Centoire safe");
      } catch {
        onToast?.("Post reported · Thank you for keeping Centoire safe");
      }
    } else {
      onToast?.("Post reported · Thank you for keeping Centoire safe");
    }
  };

  const handleUpvote = async () => {
    if (userVoted === 1) {
      // Toggle off upvote
      setUserVoted(null);
      setUpvoteDelta(0);
      updatePostLocalState(post.id, { userVoted: null, upvoteDelta: 0 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/vote`, method: "DELETE" });
      }
      onToast?.("Upvote removed");
    } else if (userVoted === -1) {
      // Switching from downvote to upvote: downvote decreases by 1, upvote increases by 1
      setUserVoted(1);
      setUpvoteDelta(1);
      setDownvoteDelta(0);
      updatePostLocalState(post.id, { userVoted: 1, upvoteDelta: 1, downvoteDelta: 0 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/vote`, method: "POST", data: { value: 1 } });
      }
      onToast?.("Post upvoted");
    } else {
      // First vote: upvote
      setUserVoted(1);
      setUpvoteDelta(1);
      setDownvoteDelta(0);
      updatePostLocalState(post.id, { userVoted: 1, upvoteDelta: 1, downvoteDelta: 0 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/vote`, method: "POST", data: { value: 1 } });
      }
      onToast?.("Post upvoted");
    }
  };

  const handleDownvote = async () => {
    if (userVoted === -1) {
      // Toggle off downvote
      setUserVoted(null);
      setDownvoteDelta(0);
      updatePostLocalState(post.id, { userVoted: null, downvoteDelta: 0 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/vote`, method: "DELETE" });
      }
      onToast?.("Downvote removed");
    } else if (userVoted === 1) {
      // Switching from upvote to downvote: upvote decreases by 1, downvote increases by 1
      setUserVoted(-1);
      setUpvoteDelta(0);
      setDownvoteDelta(1);
      updatePostLocalState(post.id, { userVoted: -1, upvoteDelta: 0, downvoteDelta: 1 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/vote`, method: "POST", data: { value: -1 } });
      }
      onToast?.("Post downvoted");
    } else {
      // First vote: downvote
      setUserVoted(-1);
      setDownvoteDelta(1);
      setUpvoteDelta(0);
      updatePostLocalState(post.id, { userVoted: -1, upvoteDelta: 0, downvoteDelta: 1 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/vote`, method: "POST", data: { value: -1 } });
      }
      onToast?.("Post downvoted");
    }
  };

  const handleBookmark = async () => {
    if (bookmarked) {
      setBookmarked(false);
      setBookmarkDelta(0);
      updatePostLocalState(post.id, { bookmarked: false, bookmarkDelta: 0 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/bookmark`, method: "DELETE" });
      }
      onToast?.("Removed from bookmarks");
    } else {
      setBookmarked(true);
      setBookmarkDelta(1);
      updatePostLocalState(post.id, { bookmarked: true, bookmarkDelta: 1 });
      if (post.id) {
        void customInstance({ url: `/posts/${post.id}/bookmark`, method: "POST", data: { folderId: null } });
      }
      onToast?.("Post bookmarked");
    }
  };

  const handleCommentClick = () => {
    if (post.slug) {
      navigate(`/p/${post.slug}#comments`);
    } else {
      onToast?.("Comments section coming soon (UI in progress)");
    }
  };

  const displayUpvotes = formatCount(baseUpvotes.current + upvoteDelta);
  const displayDownvotes = formatCount(baseDownvotes.current + downvoteDelta);
  const displayShares = formatCount(baseShares.current + sharesDelta);
  const displayBookmarks = formatCount(baseBookmarks.current + bookmarkDelta);
  const displayComments = formatCount(baseComments.current + commentDelta);

  const hasMedia = Boolean(post.mediaUrl || (post.images && post.images.length > 0));
  const photoList = post.images && post.images.length > 0
    ? post.images
    : post.mediaUrl
    ? [post.mediaUrl, post.mediaUrl, post.mediaUrl, post.mediaUrl]
    : [];
  const currentPhoto = post.images && post.images.length > 0
    ? post.images[activePhotoIndex] || post.mediaUrl
    : post.mediaUrl;

  return (
    <article className="w-full max-w-[612px] rounded-[16px] border border-[rgba(17,17,17,0.1)] bg-white shadow-[0_4px_10px_rgba(17,17,17,0.10)] flex flex-col relative transition-shadow hover:shadow-[0_6px_16px_rgba(17,17,17,0.12)]">
      {/* Upper Content Section (Figma: 20px padding left/right/top, 14px bottom to media or 16px to divider) */}
      <div className={`pt-[20px] px-[20px] ${hasMedia ? "pb-[14px]" : "pb-[16px]"} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <div className={`size-[40px] rounded-full ${post.author.avatarColor} text-white flex items-center justify-center font-ui text-[15px] font-semibold shrink-0 overflow-hidden`}>
              {post.author.avatarUrl ? (
                <img src={post.author.avatarUrl} alt={post.author.name} className="w-full h-full object-cover" />
              ) : (
                post.author.avatarInitial
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-ui text-[14px] font-semibold text-[#111111] leading-[18px]">
                {post.author.name}
              </span>
              <span className="font-ui text-[12px] text-[rgba(17,17,17,0.6)] leading-[16px] mt-0.5">
                {post.timeAgo}
              </span>
            </div>
          </div>

          {/* Meatball menu with Feed-Level hover box (Frame 2147226122) */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              aria-label="Post options"
              className="size-[32px] rounded-full hover:bg-black/5 flex items-center justify-center text-[rgba(17,17,17,0.6)] hover:text-[#111111] transition-colors cursor-pointer"
            >
              <svg width="17.5" height="2.63" viewBox="0 0 17.5 2.63" fill="none">
                <circle cx="1.315" cy="1.315" r="1.315" fill="currentColor" />
                <circle cx="8.75" cy="1.315" r="1.315" fill="currentColor" />
                <circle cx="16.185" cy="1.315" r="1.315" fill="currentColor" />
              </svg>
            </button>

            {/* Feed Level Meatball Menu Pop-up (Frame 2147226122) */}
            <div
              className={`absolute top-full -right-2.5 mt-2.5 w-[240px] bg-white rounded-[16px] shadow-[0_0_10px_1px_rgba(17,17,17,0.2)] border border-[rgba(17,17,17,0.08)] py-1 px-3 z-50 transition-all duration-150 ${
                menuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"
              }`}
            >
              {/* Top right caret: increased size and length, rounded tip */}
              <div className="absolute -top-2 right-4 size-5 bg-white rotate-45 border-t border-l border-[rgba(17,17,17,0.08)] rounded-tl-[2px]" />

              <div className="relative z-10 flex flex-col">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                >
                  <span className="text-[rgba(17,17,17,0.7)] shrink-0"><ShareIcon /></span>
                  <span className="leading-none">Share</span>
                </button>
                <button
                  type="button"
                  onClick={handleFollowPost}
                  className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                >
                  <span className="text-[rgba(17,17,17,0.7)] shrink-0"><MessageSquareIcon /></span>
                  <span className="leading-none">Follow this post</span>
                </button>
                <button
                  type="button"
                  onClick={handleFollowPerson}
                  className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                >
                  <span className="text-[rgba(17,17,17,0.7)] shrink-0"><UserIcon /></span>
                  <span className="leading-none">{isFollowingAuthor ? "Following" : "Follow this person"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleMutePerson}
                  className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                >
                  <span className="text-[rgba(17,17,17,0.7)] shrink-0"><BellOffIcon /></span>
                  <span className="leading-none">Mute this person</span>
                </button>
                <button
                  type="button"
                  onClick={handleNotInterested}
                  className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                >
                  <span className="text-[rgba(17,17,17,0.7)] shrink-0"><XIcon /></span>
                  <span className="leading-none">Not interested</span>
                </button>
                <button
                  type="button"
                  onClick={handleTranslate}
                  className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                >
                  <span className="text-[rgba(17,17,17,0.7)] shrink-0"><TranslateIcon /></span>
                  <span className="leading-none">Translate</span>
                </button>
                <button
                  type="button"
                  onClick={handleReport}
                  className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer"
                >
                  <span className="text-[rgba(17,17,17,0.7)] shrink-0"><FlagIcon /></span>
                  <span className="leading-none">Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Title — Figma: Playfair Display 500 (Medium), 16px, 22px line-height, 0% letter-spacing, rgba(17,17,17,1) */}
        <h3
          onClick={() => {
            if (post.slug || post.id) {
              navigate(`/p/${post.slug || post.id}`);
            }
          }}
          className="font-editorial text-[16px] font-medium leading-[22px] text-[#111111] mb-2 tracking-normal cursor-pointer hover:underline"
        >
          {post.title}
        </h3>

        {/* Body — Figma: Plus Jakarta Sans 400 (Regular), 14px, 22px line-height, 0% letter-spacing, rgba(17,17,17,0.7) */}
        <p className="font-ui text-[14px] font-normal leading-[22px] text-[rgba(17,17,17,0.7)] tracking-normal">
          {post.body}
        </p>
      </div>

      {/* Video Media Container — Figma: Full Width 612px Fill x 320px Fixed */}
      {post.mediaType === "video" && post.mediaUrl && (
        <div className="w-full h-[320px] relative overflow-hidden group cursor-pointer bg-neutral-100 select-none">
          <img
            src={post.mediaUrl}
            alt="Video preview"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur-xs px-3 py-1 font-ui text-[12px] font-medium text-[#111111] shadow-sm">
            video post
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-[56px] rounded-full bg-black/40 backdrop-blur-xs flex items-center justify-center text-white group-hover:scale-105 group-hover:bg-black/55 transition-all shadow-md">
              <svg className="size-6 fill-white translate-x-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {post.duration && (
            <span className="absolute bottom-4 right-4 rounded-full bg-black/60 backdrop-blur-xs px-2.5 py-0.5 font-ui text-[11px] font-medium text-white shadow-sm">
              {post.duration}
            </span>
          )}
        </div>
      )}

      {/* Photo Media Container — Figma: Full Width 612px Fill x 320px Fixed with Dot Slider (Frame 2147226144) */}
      {post.mediaType === "photo" && currentPhoto && (
        <div className="w-full h-[320px] relative overflow-hidden group cursor-pointer bg-neutral-100 select-none">
          <img
            src={currentPhoto}
            alt="Photo preview"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          <span className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur-xs px-3 py-1 font-ui text-[12px] font-medium text-[#111111] shadow-sm">
            photo post
          </span>

          {/* Photo Dot Slider (Figma Frame 2147226144: 56px Hug x 14px Hug, rounded 32px, p-[4px], gap-[8px], bg-white/20, blur 4px) */}
          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 h-[14px] rounded-[32px] bg-white/20 backdrop-blur-[4px] px-[4px] py-[4px] flex items-center gap-[8px] z-10 pointer-events-auto">
            {(photoList.length > 0 ? photoList.slice(0, 4) : [0, 1, 2, 3]).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhotoIndex(idx);
                }}
                aria-label={`Photo ${idx + 1}`}
                className={`size-[6px] rounded-full transition-all cursor-pointer ${
                  idx === activePhotoIndex
                    ? "bg-white scale-100 shadow-sm"
                    : "bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Horizontal Divider Line (Figma: 572px Fill, only on text-only posts; omitted on media posts with no extra space) */}
      {!hasMedia && (
        <div className="mx-[20px] h-px bg-[rgba(17,17,17,0.1)]" />
      )}

      {/* Action Bar (Figma Frame: Fill 612px, Hug 50px, Padding: Top 12px, Right 20px, Bottom 20px, Left 20px) */}
      <div className="w-full pt-[12px] px-[20px] pb-[20px] flex items-center gap-3.5 sm:gap-4 select-none">
        {/* Upvote: matched to comment icon size with balanced stem (19 x 19, viewBox 0 0 24 24) */}
        <button
          type="button"
          onClick={handleUpvote}
          aria-label="Upvote"
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <svg
            className={`w-[19px] h-[19px] transition-colors shrink-0 ${
              userVoted === 1 ? "text-[#111111] stroke-[2.8]" : "text-[rgba(17,17,17,0.6)] group-hover:text-[#111111]"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 18.5V3.5M4.5 11L12 3.5L19.5 11" />
          </svg>
          <span className="font-ui text-[14px] font-semibold leading-none text-[#111111]">
            {displayUpvotes}
          </span>
        </button>

        {/* Downvote: matched to comment icon size with balanced stem (19 x 19, viewBox 0 0 24 24) */}
        <button
          type="button"
          onClick={handleDownvote}
          aria-label="Downvote"
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <svg
            className={`w-[19px] h-[19px] transition-colors shrink-0 ${
              userVoted === -1 ? "text-[#111111] stroke-[2.8]" : "text-[rgba(17,17,17,0.6)] group-hover:text-[#111111]"
            }`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5.5V20.5M4.5 13L12 20.5L19.5 13" />
          </svg>
          <span className="font-ui text-[14px] font-semibold leading-none text-[#111111]">
            {displayDownvotes}
          </span>
        </button>

        {/* Comments: increased slightly (19 x 19) */}
        <button
          type="button"
          onClick={handleCommentClick}
          aria-label="Comments"
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <svg
            className="w-[19px] h-[19px] text-[rgba(17,17,17,0.6)] group-hover:text-[#111111] transition-colors shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <span className="font-ui text-[14px] font-semibold leading-none text-[#111111]">
            {displayComments}
          </span>
        </button>

        {/* Share: increased slightly (19 x 19) */}
        <button
          type="button"
          onClick={handleShare}
          aria-label="Share post"
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <svg
            className="w-[19px] h-[19px] text-[rgba(17,17,17,0.6)] group-hover:text-[#111111] transition-colors shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span className="font-ui text-[14px] font-semibold leading-none text-[#111111]">
            {displayShares}
          </span>
        </button>

        {/* Bookmark: matched to comment icon size (19 x 19) */}
        <button
          type="button"
          onClick={handleBookmark}
          aria-label="Bookmark post"
          className="inline-flex items-center gap-1.5 cursor-pointer group"
        >
          <svg
            className={`w-[19px] h-[19px] transition-colors shrink-0 ${
              bookmarked ? "text-[#111111] fill-current" : "text-[rgba(17,17,17,0.6)] group-hover:text-[#111111]"
            }`}
            viewBox="0 0 24 24"
            fill={bookmarked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span className="font-ui text-[14px] font-semibold leading-none text-[#111111]">
            {displayBookmarks}
          </span>
        </button>
      </div>
    </article>
  );
}

const FALLBACK_RELATED_CIRCLES = [
  { id: "fallback-beauty-notes", name: "Beauty Notes", slug: "beauty-notes" },
  { id: "fallback-design-jobs", name: "Design Jobs", slug: "design-jobs" },
  { id: "fallback-street-style", name: "Street Style", slug: "street-style" },
];

export function CircleDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [circleMenuOpen, setCircleMenuOpen] = useState(false);
  const circleMenuTimeout = useRef<NodeJS.Timeout | null>(null);

  const queryClient = useQueryClient();
  const [dismissedPostIds, setDismissedPostIds] = useState<string[]>(getStoredDismissedPostIds);

  const handleDismissPost = (id: string) => {
    saveDismissedPostLocally(id);
    setDismissedPostIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    void queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" && q.queryKey[0].includes("/circles/"),
    });
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleCircleMenuEnter = () => {
    if (circleMenuTimeout.current) clearTimeout(circleMenuTimeout.current);
    setCircleMenuOpen(true);
  };

  const handleCircleMenuLeave = () => {
    circleMenuTimeout.current = setTimeout(() => setCircleMenuOpen(false), 200);
  };

  const handleCircleShare = async () => {
    setCircleMenuOpen(false);
    const circleSlug = circle?.slug || circle?.name || slug || "";
    const shareUrl = `${window.location.origin}/c/${circleSlug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Circle link copied to clipboard!");
    } catch {
      showToast("Unable to copy circle link");
    }
  };

  const handleCircleSave = () => {
    setCircleMenuOpen(false);
    showToast("Saving circles coming soon (bookmarks currently only support posts in backend)");
  };

  const handleCircleCustomFeed = () => {
    setCircleMenuOpen(false);
    showToast("Custom feeds coming soon (not yet supported by backend)");
  };

  const handleCircleMute = () => {
    setCircleMenuOpen(false);
    showToast("Muting circles coming soon (not yet supported by backend)");
  };

  const handleCircleReport = () => {
    setCircleMenuOpen(false);
    showToast("Reporting circles coming soon (not yet supported by backend)");
  };

  const { data: circle, isLoading, refetch } = useGetCircle(slug ?? "");
  const {
    data: postPages,
    isLoading: postsLoading,
    isError: postsError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useListCirclePostsInfinite(
    slug ?? "",
    {},
    {
      query: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    },
  );
  const posts = postPages?.pages.flatMap((page) => page.items) ?? [];

  const { data: members } = useListCircleMembers(slug ?? "");
  const firstHashtag = circle?.hashtags[0];
  const { data: relatedPool } = useListCircles(
    firstHashtag ? { hashtag: firstHashtag, limit: 8 } : undefined,
    { query: { enabled: Boolean(firstHashtag) } },
  );

  const join = useJoinCircle({ mutation: { onSuccess: () => refetch() } });
  const leave = useLeaveCircle({ mutation: { onSuccess: () => refetch() } });

  const highlightsRef = useRef<HTMLDivElement>(null);
  const snapTimeoutRef = useRef<number | null>(null);
  const [canScrollHighlights, setCanScrollHighlights] = useState({ left: false, right: false });

  // Dynamic Circle Highlights: from circle object (if backend provides it) or featured media posts
  const circleExplicitHighlights = (circle as unknown as { highlights?: HighlightItem[] })?.highlights;
  const postHighlights: HighlightItem[] = (posts || [])
    .filter((p) => Boolean(p.coverImageUrl))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      badgeText: (p.author?.displayName || circle?.name || "C").charAt(0).toUpperCase(),
      badgeBg: "bg-[#111111]",
      count: formatCount(p.upvoteCount || 0),
      text: p.title,
      imageUrl: p.coverImageUrl || undefined,
      slug: p.slug,
    }));

  const highlights: HighlightItem[] =
    circleExplicitHighlights && circleExplicitHighlights.length > 0
      ? circleExplicitHighlights
      : postHighlights;

  const updateHighlightsScroll = () => {
    if (highlightsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = highlightsRef.current;
      setCanScrollHighlights({
        left: scrollLeft > 5,
        right: Math.ceil(scrollLeft) < scrollWidth - clientWidth - 5,
      });
    }
  };

  useEffect(() => {
    if (highlights.length > 0) {
      updateHighlightsScroll();
      window.addEventListener("resize", updateHighlightsScroll);
      return () => {
        window.removeEventListener("resize", updateHighlightsScroll);
        if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current);
      };
    }
  }, [highlights.length]);

  const scrollHighlights = (direction: "left" | "right") => {
    if (highlightsRef.current) {
      const children = Array.from(highlightsRef.current.children) as HTMLElement[];
      if (children.length === 0) return;
      const firstChild = children[0];
      const step = firstChild.offsetWidth + 16;
      const currentScroll = highlightsRef.current.scrollLeft;
      const currentIndex = Math.round(currentScroll / step);
      const targetIndex =
        direction === "left"
          ? Math.max(0, currentIndex - 1)
          : Math.min(children.length - 1, currentIndex + 1);

      const targetLeft =
        targetIndex === 0
          ? 0
          : children[targetIndex].offsetLeft - firstChild.offsetLeft;

      highlightsRef.current.style.scrollSnapType = "none";
      highlightsRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });

      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      snapTimeoutRef.current = window.setTimeout(() => {
        if (highlightsRef.current) {
          highlightsRef.current.style.scrollSnapType = "";
        }
      }, 450);
    }
  };

  if (isLoading) return <div className="p-10 text-ink-faint font-ui">Loading...</div>;
  if (!circle) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Not found</p>
        <p className="text-ink-soft font-ui">This circle does not exist.</p>
      </div>
    );
  }

  const joined = Boolean(circle.viewerRole);

  // Dynamic moderators: owner/moderator members, or fallback to the earliest circle member
  const explicitMods = (members ?? []).filter((m) => m.role === "owner" || m.role === "moderator");
  const dynamicModerators =
    explicitMods.length > 0
      ? explicitMods
      : (members ?? []).length > 0
        ? [(members ?? [])[0]]
        : [];
  const moderatorCount = dynamicModerators.length > 0 ? dynamicModerators.length : (circle.memberCount > 0 ? 1 : 0);

  const related = (relatedPool ?? []).filter((c) => c.id !== circle.id).slice(0, 5);
  const displayRelated = related.length > 0 ? related : FALLBACK_RELATED_CIRCLES;

  const totalUpvotes =
    circle.postCount === 0 ? 0 : posts.reduce((sum, p) => sum + (p.upvoteCount ?? 0), 0);

  const visibleLivePosts = posts.filter((p) => !dismissedPostIds.includes(p.id));

  function handleJoinClick() {
    if (!circle) return;
    if (joined) {
      if (circle.viewerRole === "owner") return;
      if (window.confirm(`Leave ${circle.name}?`)) leave.mutate({ slug: circle.slug });
    } else if (circle.rules.length > 0) {
      setRulesOpen(true);
    } else {
      join.mutate({ slug: circle.slug });
    }
  }

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-[#F5F5F5]">
      {/* Primary Content Container: 940px width, fills full height without outer border or shadow */}
      <div className="max-w-[940px] w-full mx-auto h-full flex flex-col bg-[#F5F5F5] overflow-hidden">

        {/* Header Section (Frame 2147226087): 940px Fill */}
        <div className="w-full shrink-0">
          {/* Cover Banner — 120px height with distinct warm luxury tone when no image */}
          <div className="h-[120px] w-full bg-[#BA9E86] overflow-hidden relative z-0">
            {circle.coverImageUrl ? (
              <img src={circle.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#BA9E86] via-[#A88C74] to-[#8C725C] relative overflow-hidden">
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_70%)]" />
              </div>
            )}
          </div>

          {/* Avatar + Actions + Title + Divider (892px Fill within px-6) */}
          <div className="px-6 pb-0 pt-0 relative z-10 bg-[#F5F5F5]">
            {/* Top row with overlapping Avatar and Actions */}
            <div className="flex items-start justify-between mb-3">
              {/* Circular Avatar — 96px size, 2px border #F0F0F0, drop shadow from Figma */}
              <div className="-mt-[48px] size-[96px] rounded-full border-2 border-[#F0F0F0] bg-white overflow-hidden shrink-0 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.15)] relative z-10">
                {circle.avatarUrl ? (
                  <img src={circle.avatarUrl} alt={circle.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#111111] flex items-center justify-center font-editorial text-[36px] font-bold text-white">
                    {circle.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Action Buttons — with margin top below banner */}
              <div className="flex items-center gap-2.5 mt-4 sm:mt-5">
                {joined && (
                  <Link
                    to={`/compose?circle=${circle.id}`}
                    className="rounded-full bg-[#111111] hover:bg-black px-4 py-[9px] font-ui text-[13px] font-medium text-white transition-colors"
                  >
                    Create post
                  </Link>
                )}
                <button
                  onClick={handleJoinClick}
                  disabled={join.isPending || leave.isPending || circle.viewerRole === "owner"}
                  className={`rounded-full border border-[#111111] px-4 py-[9px] font-ui text-[13px] font-medium transition-colors disabled:opacity-50 ${joined
                      ? "bg-transparent text-[#111111] hover:bg-neutral-100"
                      : "bg-[#111111] text-white hover:bg-black"
                    }`}
                >
                  {joined ? (circle.viewerRole === "owner" ? "Owner" : "Joined") : "Join circle"}
                </button>
                <div
                  className="relative"
                  onMouseEnter={handleCircleMenuEnter}
                  onMouseLeave={handleCircleMenuLeave}
                >
                  <button
                    type="button"
                    onClick={() => setCircleMenuOpen((prev) => !prev)}
                    aria-label="More circle options"
                    className="size-[37px] rounded-full border border-[#111111] bg-transparent flex items-center justify-center text-[#111111] hover:bg-black/5 transition-colors cursor-pointer"
                  >
                    <svg width="17.5" height="2.63" viewBox="0 0 17.5 2.63" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="1.315" cy="1.315" r="1.315" fill="#111111" />
                      <circle cx="8.75" cy="1.315" r="1.315" fill="#111111" />
                      <circle cx="16.185" cy="1.315" r="1.315" fill="#111111" />
                    </svg>
                  </button>

                  {/* Meatball menu pop-up (Circle Level) — Frame 2147226124 */}
                  <div
                    className={`absolute top-full -right-1.5 mt-2.5 w-[240px] bg-white rounded-[16px] shadow-[0_0_10px_1px_rgba(17,17,17,0.2)] border border-[rgba(17,17,17,0.08)] py-1 px-3 z-50 transition-all duration-150 ${
                      circleMenuOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible -translate-y-1 pointer-events-none"
                    }`}
                  >
                    {/* Top right caret: increased size and length, rounded tip */}
                    <div className="absolute -top-2 right-4 size-5 bg-white rotate-45 border-t border-l border-[rgba(17,17,17,0.08)] rounded-tl-[2px]" />

                    <div className="relative z-10 flex flex-col">
                      <button
                        type="button"
                        onClick={handleCircleShare}
                        className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                      >
                        <span className="text-[rgba(17,17,17,0.8)] shrink-0"><ShareIcon /></span>
                        <span className="leading-none">Share</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCircleSave}
                        className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                      >
                        <span className="text-[rgba(17,17,17,0.8)] shrink-0"><BookmarkIcon /></span>
                        <span className="leading-none">Save Circle</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCircleCustomFeed}
                        className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                      >
                        <span className="text-[rgba(17,17,17,0.8)] shrink-0"><HashIcon /></span>
                        <span className="leading-none">Add to custom feed</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCircleMute}
                        className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer border-b border-[rgba(17,17,17,0.06)]"
                      >
                        <span className="text-[rgba(17,17,17,0.8)] shrink-0"><BellOffIcon /></span>
                        <span className="leading-none">Mute this circle</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCircleReport}
                        className="flex items-center gap-3 w-full py-2.5 px-1.5 text-left font-ui text-[13px] font-normal text-[rgba(17,17,17,1)] hover:bg-[#F7F7F7] rounded-[8px] transition-colors cursor-pointer"
                      >
                        <span className="text-[rgba(17,17,17,0.8)] shrink-0"><FlagIcon /></span>
                        <span className="leading-none">Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Circle Title (title-block in Figma: 892px Fill, Hug 43px, gap 8px) */}
            <div className="w-full mb-6">
              <h1 className="font-editorial text-[32px] font-semibold text-[rgba(17,17,17,1)] leading-none">
                c/{circle.name}
              </h1>
            </div>

            {/* Divider Line (Figma: 892px Fill, 1px Fixed, rgba(17,17,17,0.2)) */}
            <div className="w-full h-px bg-[rgba(17,17,17,0.2)]" />
          </div>
        </div>

        {/* 2-Column Body Layout: 660px Feed + 280px Sidebar — each scrolls independently */}
        <div className="flex flex-col lg:flex-row w-full flex-1 min-h-0 overflow-hidden bg-[#F5F5F5]">

          {/* Left: Feed Column (Width: 660px Fill) — Highlights + Feed scroll together */}
          <div className="w-full lg:w-[660px] flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#F5F5F5]">

            {/* Circle Highlights */}
            <div className="p-6 pb-2 shrink-0">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-ui text-[20px] font-bold text-[#111111]">Circle Highlights</h2>
                  <button
                    type="button"
                    className="font-ui text-[14px] font-medium leading-[15px] text-[rgba(17,17,17,0.6)] hover:text-[#111111] underline underline-offset-[3px] decoration-[rgba(17,17,17,0.25)] hover:decoration-[#111111] transition-colors"
                  >
                    View all
                  </button>
                </div>
                {highlights.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollHighlights("left")}
                      disabled={!canScrollHighlights.left}
                      aria-label="Previous highlights"
                      className={`size-[36px] shrink-0 rounded-full bg-white border border-[#111111]/10 flex items-center justify-center transition-colors ${
                        canScrollHighlights.left
                          ? "text-[#111111] hover:bg-black/5 cursor-pointer"
                          : "text-[#111111]/40 cursor-not-allowed"
                      }`}
                    >
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollHighlights("right")}
                      disabled={!canScrollHighlights.right}
                      aria-label="Next highlights"
                      className={`size-[36px] shrink-0 rounded-full bg-white border border-[#111111]/10 flex items-center justify-center transition-colors ${
                        canScrollHighlights.right
                          ? "text-[#111111] hover:bg-black/5 cursor-pointer"
                          : "text-[#111111]/40 cursor-not-allowed"
                      }`}
                    >
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {highlights.length > 0 ? (
                /* Highlights cards rail (Figma Frame: highlight-cards, 612 Fill x 176 Hug, gap 16px) */
                <div
                  ref={highlightsRef}
                  onScroll={updateHighlightsScroll}
                  className="flex items-stretch gap-4 overflow-x-auto snap-x scroll-pl-2 px-2 -mx-2 pt-3 -mt-3 pb-5 -mb-5"
                  style={{ scrollbarWidth: "none" }}
                >
                  {highlights.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.slug) navigate(`/p/${item.slug}`);
                      }}
                      className={`snap-start shrink-0 w-[193.33px] h-[176px] rounded-[16px] border border-[rgba(17,17,17,0.1)] p-[16px] flex flex-col justify-between relative overflow-hidden group cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-shadow hover:shadow-[0_6px_16px_rgba(0,0,0,0.2)] ${item.bgClass || "bg-[#111111]"}`}
                    >
                      {item.imageUrl && (
                        <>
                          <img
                            src={item.imageUrl}
                            alt={item.text}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/20 pointer-events-none" />
                        </>
                      )}
                      <div className="flex items-center justify-between relative z-10">
                        <span className={`size-[36px] rounded-full ${item.badgeBg || "bg-[#111111]"} flex items-center justify-center font-ui text-[12px] font-bold text-white shrink-0 leading-none`}>
                          {item.badgeText}
                        </span>
                        <span className="inline-flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.8)] px-[10px] py-[6px] shrink-0 font-ui text-[12px] font-semibold text-[rgba(17,17,17,1)] leading-none">
                          {item.count}
                        </span>
                      </div>
                      <p className="font-ui text-[12px] font-medium text-white leading-[18px] line-clamp-4 relative z-10">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty state matching the feed box style */
                <div className="rounded-[16px] border border-[rgba(17,17,17,0.1)] bg-white p-6 text-center shadow-[0_4px_10px_rgba(17,17,17,0.10)]">
                  <p className="font-ui text-[15px] font-semibold text-[#111111] mb-1">No highlights yet</p>
                  <p className="font-ui text-[13px] text-[rgba(17,17,17,0.6)]">
                    Featured discussions and community spotlights will appear here.
                  </p>
                </div>
              )}
            </div>

            {/* Circle Feed Header & Posts */}
            <div className="p-6 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-ui text-[20px] font-bold text-[#111111]">Circle Feed</h2>
                <button
                  type="button"
                  className="h-[36px] rounded-full border border-[#111111]/10 bg-white hover:bg-black/5 text-[#111111] px-3.5 font-ui text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  Filters
                  <svg className="size-3 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* Feed posts */}
              <div className="space-y-4">
                {visibleLivePosts.length > 0 ? (
                  visibleLivePosts.map((post) => (
                    <CircleFeedCard
                      key={post.id}
                      post={{
                        id: post.id,
                        slug: post.slug,
                        author: {
                          id: post.author?.id,
                          name: post.author?.displayName || "Community Member",
                          avatarColor: "bg-[#111111]",
                          avatarInitial: (post.author?.displayName || "C").charAt(0).toUpperCase(),
                          avatarUrl: post.author?.avatarUrl || undefined,
                          isFollowed: Boolean((post.viewer as unknown as { authorFollowed?: boolean })?.authorFollowed),
                        },
                        timeAgo: post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                          : "Recently",
                        title: post.title,
                        body: post.excerpt || post.title,
                        mediaType: post.coverImageUrl ? "photo" : undefined,
                        mediaUrl: post.coverImageUrl || undefined,
                        upvotes: String(post.upvoteCount || 0),
                        downvotes: "0",
                        comments: String(post.commentCount || 0),
                        shares: "0",
                        bookmarks: String(post.bookmarkCount || 0),
                      }}
                      onToast={showToast}
                      onDismiss={handleDismissPost}
                    />
                  ))
                ) : !postsLoading ? (
                  <div className="rounded-[16px] border border-[rgba(17,17,17,0.1)] bg-white p-8 text-center shadow-[0_2px_8px_rgba(17,17,17,0.06)]">
                    <p className="font-ui text-[15px] font-semibold text-[#111111] mb-1">No posts in this circle yet</p>
                    <p className="font-ui text-[13px] text-[rgba(17,17,17,0.6)]">
                      Be the first to share a post and start the conversation!
                    </p>
                  </div>
                ) : null}

                {postsLoading && (
                  <p className="font-ui text-[14px] text-[#8A8A8A]">Loading posts...</p>
                )}
                {postsError && (
                  <p className="font-ui text-[14px] text-crimson">Couldn't load posts.</p>
                )}
                {hasNextPage && (
                  <button
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="mx-auto block rounded-full border border-[#111111] px-6 py-2 font-ui text-[13px] font-medium text-[#111111] hover:bg-black hover:text-white disabled:opacity-50 transition-colors"
                  >
                    {isFetchingNextPage ? "Loading..." : "Load more"}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Right: Sidebar Column (Figma: circle-sidebar, 280px Fixed x 738px Hug, border-l 1px) */}
          <div className="w-full lg:w-[280px] shrink-0 border-t lg:border-t-0 lg:border-l border-[rgba(17,17,17,0.1)] p-5 flex flex-col gap-4 lg:self-start lg:h-fit max-h-full overflow-y-auto bg-[#F5F5F5]">

            {/* Circle Title & Description */}
            <div>
              <h2 className="font-editorial text-[24px] font-semibold text-[rgba(17,17,17,1)] mb-2 leading-none">
                {circle.name}
              </h2>
              <p className="font-ui text-[13px] text-[rgba(17,17,17,0.6)] leading-[20px]">
                {circle.description}
              </p>
            </div>

            {/* Stats Row — no top border line */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <p className="font-ui text-[11px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.6)]">
                  MEMBERS
                </p>
                <p className="font-ui text-[15px] font-semibold text-[#111111] mt-0.5">
                  {circle.memberCount >= 1000 ? `${(circle.memberCount / 1000).toFixed(1)}k` : circle.memberCount}
                </p>
              </div>
              <div>
                <p className="font-ui text-[11px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.6)]">
                  POSTS
                </p>
                <p className="font-ui text-[15px] font-semibold text-[#111111] mt-0.5">
                  {circle.postCount}
                </p>
              </div>
              <div>
                <p className="font-ui text-[11px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.6)]">
                  UPVOTES
                </p>
                <p className="font-ui text-[15px] font-semibold text-[#111111] mt-0.5">
                  {totalUpvotes >= 1000 ? `${(totalUpvotes / 1000).toFixed(1)}k` : totalUpvotes}
                </p>
              </div>
            </div>

            {/* Rules */}
            {circle.rules && circle.rules.length > 0 && (
              <div className="pt-3 border-t border-[#EAEAEA]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-ui text-[14px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.8)]">
                    RULES
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRulesOpen(true)}
                    className="font-ui text-[12px] font-medium leading-[15px] text-[rgba(17,17,17,0.6)] hover:text-[#111111] underline underline-offset-[3px] decoration-[rgba(17,17,17,0.25)] hover:decoration-[#111111] transition-colors"
                  >
                    View all
                  </button>
                </div>
                <ul className="space-y-2">
                  {circle.rules.slice(0, 3).map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 font-ui text-[13px] text-[rgba(17,17,17,0.6)] leading-[20px]">
                      <span className="size-1 rounded-full bg-[rgba(17,17,17,0.6)] shrink-0 mt-2" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Membership */}
            <div className="pt-3 border-t border-[#EAEAEA]">
              <h3 className="font-ui text-[14px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.8)] mb-2">
                MEMBERSHIP
              </h3>
              <p className="font-ui text-[13px] text-[rgba(17,17,17,0.6)] leading-[20px] mb-3">
                Open to members who want to read, share, and discuss with a thoughtful community.
              </p>
              <div className="space-y-2 font-ui text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-[rgba(17,17,17,0.6)]">Type</span>
                  <span className="font-medium text-[#111111]">Public</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[rgba(17,17,17,0.6)]">Approval</span>
                  <span className="font-medium text-[#111111]">Instant</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[rgba(17,17,17,0.6)]">Moderators</span>
                  <div className="inline-flex items-center h-[22px] rounded-[64px] border border-[rgba(17,17,17,0.1)] pl-[2px] pr-[8px] py-[2px] gap-2 bg-transparent shrink-0">
                    <div className="flex -space-x-1.5 shrink-0">
                      {dynamicModerators.length > 0 ? (
                        dynamicModerators.map((mod, i) =>
                          mod.user.avatarUrl ? (
                            <img
                              key={mod.user.id || i}
                              src={mod.user.avatarUrl}
                              alt={mod.user.displayName || "Moderator"}
                              className="size-[18px] rounded-full border border-[#F5F5F5] object-cover shrink-0"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              key={mod.user.id || i}
                              title={mod.user.displayName}
                              className="size-[18px] rounded-full border border-[#F5F5F5] bg-[#111111] text-white flex items-center justify-center font-ui text-[9px] font-semibold shrink-0"
                            >
                              {mod.user.displayName ? mod.user.displayName.charAt(0).toUpperCase() : "M"}
                            </div>
                          ),
                        )
                      ) : (
                        <div
                          title={circle.name}
                          className="size-[18px] rounded-full border border-[#F5F5F5] bg-[#111111] text-white flex items-center justify-center font-ui text-[9px] font-semibold shrink-0"
                        >
                          {circle.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="font-ui text-[12px] font-medium leading-none text-[#111111]">
                      {moderatorCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Related Circles / Tags — tighter gap from Membership */}
            <div className="-mt-1">
              <h3 className="font-ui text-[14px] font-semibold uppercase tracking-wider text-[rgba(17,17,17,0.8)] mb-2">
                RELATED CIRCLES
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {displayRelated.map((c) => (
                  <Link
                    key={c.id}
                    to={`/c/${c.slug}`}
                    className="inline-flex items-center rounded-full border border-[rgba(17,17,17,0.1)] bg-transparent hover:border-[#111111] hover:bg-black/5 px-2.5 py-1 font-ui text-[12px] font-normal leading-none text-[rgba(17,17,17,1)] transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
                {circle.hashtags?.map((tag) => (
                  <Link
                    key={tag}
                    to={`/hashtag/${tag}`}
                    className="inline-flex items-center rounded-full border border-[rgba(17,17,17,0.1)] bg-transparent hover:border-[#111111] hover:bg-black/5 px-2.5 py-1 font-ui text-[12px] font-normal leading-none text-[rgba(17,17,17,1)] transition-colors"
                  >
                    {tag}
                  </Link>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>

      {rulesOpen && (
        <CircleRulesModal
          circle={circle}
          onCancel={() => setRulesOpen(false)}
          onAgree={() =>
            join.mutate(
              { slug: circle.slug },
              { onSuccess: () => setRulesOpen(false) },
            )
          }
          loading={join.isPending}
        />
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 bg-[#111111] text-white text-[13px] font-ui font-medium rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.3)] flex items-center gap-2 pointer-events-none transition-all">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
