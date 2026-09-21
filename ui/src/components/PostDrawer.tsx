import { useEffect, type ReactNode } from "react";
import { useGetPost } from "../lib/api/generated/posts/posts";
import { PostPanel } from "./PostPanel";
import { PostSidebar } from "./PostSidebar";

interface PostDrawerProps {
  slug: string;
  onClose: () => void;
  /** Custom header action buttons. When omitted the default "Full article ↗" button is shown for external posts. */
  headerActions?: ReactNode;
}

export function PostDrawer({
  slug,
  onClose,
  headerActions,
}: PostDrawerProps) {
  const { data: post } = useGetPost(slug);

  // Keyboard dismiss
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const externalUrl = post?.externalUrl;

  const defaultHeaderActions = externalUrl ? (
    <a
      href={externalUrl}
      target="_blank"
      rel="noreferrer"
      className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-soft hover:text-ink"
    >
      Full article ↗
    </a>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close post"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      {/* Panel — slides in from right */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={post?.title ?? "Post details"}
        className="relative ml-auto flex h-full w-full max-w-5xl flex-col bg-paper shadow-2xl"
      >
        {/* Sticky header strip */}
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-soft hover:bg-cream hover:text-ink"
          >
            <CloseIcon className="size-5" />
          </button>

          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-soft">
            {post?.title ?? ""}
          </p>

          <div className="flex shrink-0 items-center gap-2">
            {headerActions ?? defaultHeaderActions}
          </div>
        </div>

        {/* Body — two-column on desktop */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
            <PostPanel slug={slug} compact />
          </div>

          {post && (
            <div className="hidden w-72 shrink-0 overflow-y-auto border-l border-line px-6 py-8 lg:block">
              <PostSidebar post={post} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
