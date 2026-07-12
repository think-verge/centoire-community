import { useEffect, useRef, type ReactNode } from "react";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { PostCard } from "./PostCard";

interface MasonryFeedProps {
  posts: PostCardType[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  emptyState: ReactNode;
}

export function MasonryFeed({
  posts,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyState,
}: MasonryFeedProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} tall={i % 3 === 0} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <div className="columns-1 gap-4 sm:columns-2 xl:columns-3 2xl:columns-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinelRef} aria-hidden />
      {isFetchingNextPage && (
        <p className="py-6 text-center text-sm text-ink-faint">Loading more…</p>
      )}
      {!hasNextPage && posts.length > 0 && (
        <p className="py-6 text-center text-sm text-ink-faint">You're all caught up.</p>
      )}
    </>
  );
}

function SkeletonCard({ tall }: { tall: boolean }) {
  return (
    <div className="mb-4 break-inside-avoid rounded-xl border border-line bg-paper p-4">
      {tall && <div className="mb-3 h-40 animate-pulse rounded-lg bg-cream" />}
      <div className="h-3 w-16 animate-pulse rounded bg-cream" />
      <div className="mt-2 h-5 w-4/5 animate-pulse rounded bg-cream" />
      <div className="mt-1.5 h-5 w-3/5 animate-pulse rounded bg-cream" />
      <div className="mt-4 h-3 w-2/5 animate-pulse rounded bg-cream" />
    </div>
  );
}
