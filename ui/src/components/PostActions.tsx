import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useBookmarkPost,
  useListBookmarkFolders,
  useUnbookmarkPost,
  useUnvotePost,
  useVotePost,
} from "../lib/api/generated/engagement/engagement";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { useAuth } from "../lib/auth-context";
import { customInstance } from "../lib/api/http";

/**
 * Upvote / comment / bookmark row. Optimistic per-card state: counts flip
 * instantly and reconcile with server truth on the next feed refetch.
 * Bookmarking with folders: click opens a picker when folders exist.
 */
export function PostActions({
  post,
  onOpenModal,
  prependNode,
  onOptionsToggle,
  optionsZIndex,
  onHide,
}: {
  post: PostCardType;
  onOpenModal?: () => void;
  prependNode?: React.ReactNode;
  onOptionsToggle?: (isOpen: boolean) => void;
  optionsZIndex?: number;
  onHide?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [voted, setVoted] = useState<1 | -1 | null>(
    (post.viewer.voted as 1 | -1 | null) ?? null,
  );
  const [bookmarked, setBookmarked] = useState(post.viewer.bookmarked);
  const [upvotes, setUpvotes] = useState(post.upvoteCount);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const invalidateFeeds = () => {
    void queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/feed"),
    });
    void queryClient.invalidateQueries({ queryKey: [`/posts/${post.slug}`] });
  };

  const votePost = useVotePost({ mutation: { onSuccess: invalidateFeeds } });
  const unvotePost = useUnvotePost({ mutation: { onSuccess: invalidateFeeds } });
  const bookmarkPost = useBookmarkPost({ mutation: { onSuccess: invalidateFeeds } });
  const unbookmarkPost = useUnbookmarkPost({ mutation: { onSuccess: invalidateFeeds } });

  // Sync local display state from props when feed refreshes with server truth,
  // but only when no mutation is in flight (to avoid reverting optimistic updates).
  useEffect(() => {
    if (!votePost.isPending && !unvotePost.isPending) {
      setVoted((post.viewer.voted as 1 | -1 | null) ?? null);
      setUpvotes(post.upvoteCount);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.upvoteCount, post.viewer.voted]);

  useEffect(() => {
    if (!bookmarkPost.isPending && !unbookmarkPost.isPending) {
      setBookmarked(post.viewer.bookmarked);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.bookmarkCount, post.viewer.bookmarked]);
  const { data: folderData } = useListBookmarkFolders({
    query: { enabled: pickerOpen },
  });

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (pickerOpen && pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
      if (optionsOpen && optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
        onOptionsToggle?.(false);
      }
    }
    function onScroll() {
      if (pickerOpen) setPickerOpen(false);
      if (optionsOpen) {
        setOptionsOpen(false);
        onOptionsToggle?.(false);
      }
    }
    if (pickerOpen || optionsOpen) {
      document.addEventListener("mousedown", onOutsideClick);
      document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    }
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [pickerOpen, optionsOpen, onOptionsToggle]);

  const canEngage = Boolean(user?.emailVerified);


  function saveTo(folderId: string | null) {
    setPickerOpen(false);
    setBookmarked(true);
    bookmarkPost.mutate({ id: post.id, data: { folderId } });
  }

  function handleBookmarkClick() {
    if (bookmarked) {
      setBookmarked(false);
      unbookmarkPost.mutate({ id: post.id });
    } else {
      // Optimistically bookmark and open picker for folders
      setBookmarked(true);
      bookmarkPost.mutate({ id: post.id, data: { folderId: null } });
      setPickerOpen(true);
    }
  }

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reported, setReported] = useState(
    Boolean((post.viewer as unknown as { reported?: boolean })?.reported),
  );

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  function toggleUpvote() {
    if (!canEngage) {
      navigate(user ? "/verify-email" : "/login");
      return;
    }
    if (voted === 1) {
      // Removing upvote: decrement upvote count by 1
      setVoted(null);
      setUpvotes((n) => Math.max(0, n - 1));
      unvotePost.mutate({ id: post.id });
    } else {
      // Casting upvote: always increment upvote count by exactly 1
      setVoted(1);
      setUpvotes((n) => n + 1);
      votePost.mutate({ id: post.id, data: { value: 1 } });
    }
  }

  function handleSeeMore() {
    setOptionsOpen(false);
    onOptionsToggle?.(false);
    if (post.author?.handle) {
      navigate(`/u/${post.author.handle}`);
    } else if (post.source?.name) {
      navigate(`/search?q=${encodeURIComponent(post.source.name)}`);
    } else {
      navigate("/discover");
    }
  }

  function handleNotInterested() {
    setOptionsOpen(false);
    onOptionsToggle?.(false);
    onHide?.();
    void customInstance({ url: `/posts/${post.id}/not-interested`, method: "POST" });
    setToastMessage("Post hidden · Centoire will show less like this");
  }

  function handleDownvote() {
    setOptionsOpen(false);
    onOptionsToggle?.(false);
    if (!canEngage) {
      navigate(user ? "/verify-email" : "/login");
      return;
    }
    if (voted === -1) {
      // Removing downvote: user returns to neutral state, upvote count is NOT increased
      setVoted(null);
      unvotePost.mutate({ id: post.id });
      setToastMessage("Downvote removed");
      return;
    }

    // A post with 0 votes cannot be downvoted
    if (upvotes <= 0 && voted !== 1) {
      setToastMessage("Cannot downvote a post with 0 votes");
      return;
    }

    // Casting downvote:
    // If the user had previously upvoted the post, take back their upvote (-1)
    if (voted === 1) {
      setUpvotes((n) => Math.max(0, n - 1));
    }
    setVoted(-1);
    votePost.mutate({ id: post.id, data: { value: -1 } });
    setToastMessage("Post downvoted");
  }

  async function handleReport() {
    setOptionsOpen(false);
    onOptionsToggle?.(false);
    if (!user) {
      navigate("/login");
      return;
    }
    if (reported) {
      setToastMessage("You have already reported this post");
      return;
    }
    try {
      const res = await customInstance<{ alreadyReported?: boolean }>({
        url: `/posts/${post.id}/report`,
        method: "POST",
      });
      if (res?.alreadyReported) {
        setReported(true);
        setToastMessage("You have already reported this post");
      } else {
        setReported(true);
        setToastMessage("Post reported · Thank you for keeping Centoire safe");
      }
    } catch {
      setToastMessage("Unable to submit report");
    }
  }

  async function handleShare() {
    setOptionsOpen(false);
    onOptionsToggle?.(false);
    const shareUrl = `${window.location.origin}/p/${post.slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMessage("Link copied to clipboard!");
    } catch {
      setToastMessage("Unable to copy link");
    }
  }

  return (
    <div className="flex items-center justify-between w-full">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 bg-[#111111] text-white text-[12px] font-ui font-medium rounded-full shadow-2xl flex items-center gap-2 pointer-events-none transition-all">
          <span>{toastMessage}</span>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        {prependNode}
        <button
          type="button"
          aria-pressed={voted === 1}
          onClick={toggleUpvote}
          title={voted === 1 ? "Remove upvote" : "Upvote"}
          className={`flex items-center gap-1.5 transition-colors text-[14px] font-ui font-semibold ${
            voted === 1 ? "text-[#E4572E]" : "text-[#111111]/60 hover:text-[#E4572E]"
          }`}
        >
          <svg className="size-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 11l7-7m0 0l7 7m-7-7v16" /></svg>
          {upvotes >= 1000 ? (upvotes/1000).toFixed(1) + 'k' : upvotes}
        </button>
        <button
          type="button"
          onClick={onOpenModal ?? (() => navigate(`/p/${post.slug}#comments`))}
          className="flex items-center gap-1.5 text-[14px] font-ui font-semibold text-[#111111]/60 hover:text-[#111111]"
          title="Comments"
        >
          <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          {post.commentCount}
        </button>
      </div>

      <div className="relative ml-auto flex items-center gap-2 text-[#111111]/60">
        <div className="relative" ref={optionsRef}>
          <svg
            onClick={() => {
              const next = !optionsOpen;
              setOptionsOpen(next);
              onOptionsToggle?.(next);
            }}
            className="size-4 cursor-pointer hover:text-[#111111] transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
          {optionsOpen && (
            <div
              style={{ zIndex: optionsZIndex ?? 50 }}
              className="absolute top-full right-[-26px] mt-4 w-[240px] rounded-[16px] bg-white border border-[#EAEAEA] shadow-[0px_4px_14px_rgba(17,17,17,0.14)] after:content-[''] after:absolute after:-top-4 after:left-0 after:w-full after:h-4"
            >
              {/* Tooltip Tail */}
              <div className="absolute -top-[12px] right-[21px] size-[24px] bg-white border-t border-l border-[#EAEAEA] rotate-45 pointer-events-none"></div>
              <div className="flex flex-col w-full bg-white rounded-[16px] overflow-hidden relative z-10 px-3 py-[3px] [&>button]:h-[38px] [&>button]:py-0 [&>button]:px-0">
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 font-ui text-[13px] font-medium text-[#111111] transition-colors border-b border-[#EAEAEA] cursor-pointer"
                  onClick={handleSeeMore}
                >
                  <svg className="size-[18px] text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  See more from this person
                </button>
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 font-ui text-[13px] font-medium text-[#111111] transition-colors border-b border-[#EAEAEA] cursor-pointer"
                  onClick={handleNotInterested}
                >
                  <svg className="size-[18px] text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  Not interested
                </button>
                <button
                  type="button"
                  className={`flex items-center gap-3 px-4 py-3 hover:bg-black/5 font-ui text-[13px] font-medium transition-colors border-b border-[#EAEAEA] cursor-pointer ${
                    voted === -1 ? "text-[#E4572E] font-semibold" : "text-[#111111]"
                  }`}
                  onClick={handleDownvote}
                >
                  <svg className={`size-[18px] ${voted === -1 ? "text-[#E4572E]" : "text-[#737373]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  {voted === -1 ? "Downvoted" : "Downvote"}
                </button>
                {reported ? (
                  <button
                    type="button"
                    className="flex items-center gap-3 px-4 py-3 font-ui text-[13px] font-medium text-[#737373] transition-colors border-b border-[#EAEAEA] cursor-default opacity-85"
                    onClick={() => {
                      setOptionsOpen(false);
                      onOptionsToggle?.(false);
                      setToastMessage("You have already reported this post");
                    }}
                  >
                    <svg className="size-[18px] text-[#00C365]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Reported
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 font-ui text-[13px] font-medium text-[#111111] transition-colors border-b border-[#EAEAEA] cursor-pointer"
                    onClick={handleReport}
                  >
                    <svg className="size-[18px] text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                    Report
                  </button>
                )}
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 font-ui text-[13px] font-medium text-[#111111] transition-colors cursor-pointer"
                  onClick={handleShare}
                >
                  <svg className="size-[18px] text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                  Share
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="border border-[#EAEAEA] rounded-[8px] p-1 cursor-pointer hover:bg-black/5 transition-colors" ref={pickerRef}>
          <button
            type="button"
            aria-pressed={bookmarked}
            aria-haspopup="menu"
            onClick={handleBookmarkClick}
            title={bookmarked ? "Remove from saved" : "Save"}
            className={`flex items-center justify-center transition-colors ${
              bookmarked ? "text-[#E4572E]" : "text-[#111111]/60 hover:text-[#111111]"
            }`}
          >
            <svg className="size-4" fill={bookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
          </button>
        </div>
        {pickerOpen && (
          <div
            role="menu"
            aria-label="Save to folder"
            className="absolute bottom-full right-0 z-30 mb-2 w-44 rounded-xl border border-[#EAEAEA] bg-white py-1 shadow-lg"
          >
            <p className="font-ui text-[10px] uppercase font-bold tracking-wider text-[#737373] px-3 pb-1 pt-1.5">Save to</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => saveTo(null)}
              className="block w-full px-3 py-1.5 text-left font-ui text-[12px] font-medium text-[#111111] hover:bg-black/5"
            >
              All bookmarks
            </button>
            {(folderData?.folders ?? []).map((folder) => (
              <button
                key={folder.id}
                type="button"
                role="menuitem"
                onClick={() => saveTo(folder.id)}
                className="block w-full truncate px-3 py-1.5 text-left font-ui text-[12px] font-medium text-[#111111] hover:bg-black/5"
              >
                {folder.name}
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPickerOpen(false);
                navigate("/bookmarks");
              }}
              className="block w-full border-t border-[#EAEAEA] px-3 py-1.5 text-left font-ui text-[12px] text-[#737373] hover:bg-black/5"
            >
              + New folder…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


