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

/**
 * Upvote / comment / bookmark row. Optimistic per-card state: counts flip
 * instantly and reconcile with server truth on the next feed refetch.
 * Bookmarking with folders: click opens a picker when folders exist.
 */
export function PostActions({
  post,
  onOpenModal,
  prependNode,
}: {
  post: PostCardType;
  onOpenModal?: () => void;
  prependNode?: React.ReactNode;
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
  const pickerRef = useRef<HTMLDivElement>(null);

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
      votePost.mutate({ id: post.id, data: { value: 1 } });
    }
  }

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
      // Opening the picker lazily fetches folders; direct-save happens from it.
      setPickerOpen(true);
    }
  }

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2.5">
        {prependNode}
        <button
          type="button"
          aria-pressed={voted === 1}
          onClick={toggleUpvote}
          title={voted === 1 ? "Remove upvote" : "Upvote"}
          className={`flex items-center gap-1.5 transition-colors text-[12px] font-ui font-medium ${
            voted === 1 ? "text-[#E4572E]" : "text-[#737373] hover:text-[#E4572E]"
          }`}
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 11l7-7m0 0l7 7m-7-7v14" /></svg>
          {upvotes >= 1000 ? (upvotes/1000).toFixed(1) + 'k' : upvotes}
        </button>
        <button
          type="button"
          onClick={onOpenModal ?? (() => navigate(`/p/${post.slug}#comments`))}
          className="flex items-center gap-1.5 text-[12px] font-ui font-medium text-[#737373] hover:text-[#111111]"
          title="Comments"
        >
          <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          {post.commentCount}
        </button>
      </div>

      <div className="relative ml-auto flex items-center gap-2 text-[#737373]" ref={pickerRef}>
        <svg className="size-4 cursor-pointer hover:text-[#111111] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
        <div className="border border-[#EAEAEA] rounded-[8px] p-1 cursor-pointer hover:bg-black/5 transition-colors">
          <button
            type="button"
            aria-pressed={bookmarked}
            aria-haspopup="menu"
            onClick={handleBookmarkClick}
            title={bookmarked ? "Remove from saved" : "Save"}
            className={`flex items-center justify-center transition-colors ${
              bookmarked ? "text-[#E4572E]" : "text-[#737373] hover:text-[#111111]"
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


