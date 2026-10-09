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
  onOpenPost?: (post: PostCardType) => void;
}

export function MasonryFeed({
  posts,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyState,
  onOpenPost,
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
      <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
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
      <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onOpenPost={onOpenPost} />
        ))}
        {isFetchingNextPage &&
          Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={`next-page-skeleton-${i}`} tall={i % 2 === 0} />
          ))}
      </div>
      <div ref={sentinelRef} aria-hidden />
      {!hasNextPage && posts.length > 0 && (
        <p className="py-6 text-center text-sm text-ink-faint">You're all caught up.</p>
      )}
    </>
  );
}

function SkeletonCard({ tall }: { tall: boolean }) {
  return (
    <div className="flex flex-col rounded-[16px] bg-white min-h-[320px] h-full" style={{ boxShadow: '0px 4px 14px rgba(17, 17, 17, 0.14)' }}>
      {tall && <div className="h-[158px] w-full shrink-0 animate-pulse rounded-t-[16px] bg-[var(--color-sand)]" />}
      <div className="p-4 flex flex-col flex-1 gap-1">
        <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-sand)]" />
        <div className="mt-2 h-5 w-4/5 animate-pulse rounded bg-[var(--color-sand)]" />
        <div className="mt-1.5 h-5 w-3/5 animate-pulse rounded bg-[var(--color-sand)]" />
        <div className="mt-4 h-3 w-2/5 animate-pulse rounded bg-[var(--color-sand)]" />
      </div>
    </div>
  );
}
