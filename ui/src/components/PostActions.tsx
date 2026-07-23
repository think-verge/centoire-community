import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useBookmarkPost,
  useListBookmarkFolders,
  useUnbookmarkPost,
  useUnvotePost,
  useVotePost,
} from "../lib/api/generated/engagement/engagement";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { useAuth } from "../lib/auth-context";
import { StitchIcon } from "./PostCard";

/**
 * Upvote / comment / bookmark row. Optimistic per-card state: counts flip
 * instantly and reconcile with server truth on the next feed refetch.
 * Bookmarking with folders: click opens a picker when folders exist.
 */
export function PostActions({
  post,
  onOpenModal,
}: {
  post: PostCardType;
  onOpenModal?: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [voted, setVoted] = useState<1 | -1 | null>(
    (post.viewer.voted as 1 | -1 | null) ?? null,
  );
  const [bookmarked, setBookmarked] = useState(post.viewer.bookmarked);
  const [upvotes, setUpvotes] = useState(post.upvoteCount);
  const [saves, setSaves] = useState(post.bookmarkCount);
  const [stitching, setStitching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const votePost = useVotePost();
  const unvotePost = useUnvotePost();
  const bookmarkPost = useBookmarkPost();
  const unbookmarkPost = useUnbookmarkPost();
  const { data: folderData } = useListBookmarkFolders({
    query: { enabled: pickerOpen },
  });

  useEffect(() => {
    if (!pickerOpen) return;
    function onOutsideClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [pickerOpen]);

  const canEngage = Boolean(user?.emailVerified);

  function toggleUpvote() {
    if (!canEngage) {
      navigate("/verify-email");
      return;
    }
    if (voted === 1) {
      setVoted(null);
      setUpvotes((n) => n - 1);
      unvotePost.mutate({ id: post.id });
    } else {
      setVoted(1);
      setUpvotes((n) => n + 1);
      setStitching(true);
      setTimeout(() => setStitching(false), 400);
      votePost.mutate({ id: post.id, data: { value: 1 } });
    }
  }

  function saveTo(folderId: string | null) {
    setPickerOpen(false);
    setBookmarked(true);
    setSaves((n) => n + 1);
    bookmarkPost.mutate({ id: post.id, data: { folderId } });
  }

  function handleBookmarkClick() {
    if (bookmarked) {
      setBookmarked(false);
      setSaves((n) => n - 1);
      unbookmarkPost.mutate({ id: post.id });
    } else {
      // Opening the picker lazily fetches folders; direct-save happens from it.
      setPickerOpen(true);
    }
  }

  return (
    <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-xs">
      <button
        type="button"
        aria-pressed={voted === 1}
        onClick={toggleUpvote}
        title={voted === 1 ? "Remove upvote" : "Upvote"}
        className={`flex items-center gap-1 transition-colors ${
          voted === 1 ? "font-semibold text-crimson" : "text-ink-soft hover:text-crimson"
        }`}
      >
        <StitchIcon className={`size-4 ${stitching ? "animate-stitch" : ""}`} />
        {upvotes}
      </button>
      <button
        type="button"
        onClick={onOpenModal ?? (() => navigate(`/p/${post.slug}#comments`))}
        className="flex items-center gap-1 text-ink-soft hover:text-ink"
        title="Comments"
      >
        <CommentIcon className="size-4" />
        {post.commentCount}
      </button>
      <div className="relative ml-auto" ref={pickerRef}>
        <button
          type="button"
          aria-pressed={bookmarked}
          aria-haspopup="menu"
          onClick={handleBookmarkClick}
          title={bookmarked ? "Remove from saved" : "Save"}
          className={`flex items-center gap-1 transition-colors ${
            bookmarked ? "font-semibold text-gold" : "text-ink-soft hover:text-gold"
          }`}
        >
          <BookmarkSmallIcon className="size-4" filled={bookmarked} />
          {saves}
        </button>
        {pickerOpen && (
          <div
            role="menu"
            aria-label="Save to folder"
            className="absolute bottom-full right-0 z-30 mb-2 w-44 rounded-xl border border-line bg-paper py-1 shadow-card-hover"
          >
            <p className="kicker px-3 pb-1 pt-1.5">Save to</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => saveTo(null)}
              className="block w-full px-3 py-1.5 text-left text-xs font-medium text-ink hover:bg-cream"
            >
              All bookmarks
            </button>
            {(folderData?.folders ?? []).map((folder) => (
              <button
                key={folder.id}
                type="button"
                role="menuitem"
                onClick={() => saveTo(folder.id)}
                className="block w-full truncate px-3 py-1.5 text-left text-xs font-medium text-ink hover:bg-cream"
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
              className="block w-full border-t border-line px-3 py-1.5 text-left text-xs text-ink-faint hover:bg-cream"
            >
              + New folder…
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type IconProps = { className?: string };
function CommentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3.5A8 8 0 1 1 21 12z" strokeLinejoin="round" />
    </svg>
  );
}
function BookmarkSmallIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      <path d="M7 4h10v16l-5-3.5L7 20z" strokeLinejoin="round" />
    </svg>
  );
}
