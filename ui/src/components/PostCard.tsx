import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { AvatarBubble } from "./AppShell";
import { PostActions } from "./PostActions";
import { CATEGORY_LABELS, isPostCategory } from "../lib/categoryTaxonomy";

export function PostCard({
  post,
  onOpenPost,
}: {
  post: PostCardType;
  onOpenPost?: (post: PostCardType) => void;
}) {
  const navigate = useNavigate();
  const external = post.origin === "aggregated" && post.externalUrl;
  const [imageLoaded, setImageLoaded] = useState(!post.coverImageUrl);

  function openPost() {
    if (onOpenPost) {
      onOpenPost(post);
    } else if (external) {
      window.open(post.externalUrl!, "_blank", "noopener");
    } else {
      navigate(`/p/${post.slug}`);
    }
  }

  const categoryLabel =
    post.subcategory ??
    (post.category && isPostCategory(post.category) ? CATEGORY_LABELS[post.category] : null);

  return (
    <article className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-white shadow-sm transition-shadow hover:shadow-md">
      {post.coverImageUrl && (
        <button type="button" onClick={openPost} className="relative block w-full cursor-pointer">
          {!imageLoaded && (
            <div className="h-48 w-full animate-pulse bg-[var(--color-sand)]" aria-hidden />
          )}
          <img
            src={post.coverImageUrl}
            alt=""
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
            className={`max-h-72 w-full object-cover transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "absolute inset-0 h-48 opacity-0"
            }`}
          />
          {/* Source + category overlay */}
          {imageLoaded && (post.source || categoryLabel) && (
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/65 to-transparent px-3 py-3">
              {post.source && (
                <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 font-ui text-[10px] font-semibold uppercase text-white backdrop-blur-sm">
                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-coral)]" />
                  {hostname(post.source.siteUrl)}
                </span>
              )}
              {categoryLabel && (
                <span className="font-ui text-[10px] uppercase tracking-wide text-white/80">
                  {categoryLabel}
                </span>
              )}
            </div>
          )}
        </button>
      )}

      <div className="p-4">
        {/* Must Read badge (no more tag kicker links here) */}
        {post.authorIsCreator && (
          <span className="mb-2 inline-block rounded-full bg-[var(--color-coral)] px-2 py-0.5 font-ui text-[10px] font-semibold uppercase tracking-wide text-white">
            Must Read
          </span>
        )}

        <button type="button" onClick={openPost} className="block cursor-pointer text-left">
          <h2 className="font-editorial text-xl font-semibold leading-snug text-[var(--color-charcoal)] group-hover:text-[var(--color-coral)]">
            {post.title}
            {external && <span className="ml-1 text-sm text-[var(--color-taupe)]">↗</span>}
          </h2>
        </button>

        {!post.coverImageUrl && post.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--color-stone)]">
            {post.excerpt}
          </p>
        )}

        {/* No-cover card: show category + tags as pills */}
        {!post.coverImageUrl && (post.source || categoryLabel || post.tags.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {post.source && (
              <span className="flex items-center gap-1 rounded-full border border-[var(--color-hairline)] px-2 py-0.5 font-ui text-[10px] text-[var(--color-stone)]">
                <span className="size-1.5 rounded-full bg-[var(--color-coral)]" />
                {hostname(post.source.siteUrl)}
              </span>
            )}
            {categoryLabel && (
              <span className="rounded-full border border-[var(--color-hairline)] px-2 py-0.5 font-ui text-[10px] text-[var(--color-stone)]">
                {categoryLabel}
              </span>
            )}
            {post.tags.slice(0, 2).map((tag) => (
              <Link
                key={tag.id}
                to={`/t/${tag.slug}`}
                className="rounded-full border border-[var(--color-hairline)] px-2 py-0.5 font-ui text-[10px] text-[var(--color-stone)] hover:border-[var(--color-coral)] hover:text-[var(--color-coral)]"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-taupe)]">
          {post.author && (
            <Link
              to={post.author.handle ? `/u/${post.author.handle}` : "#"}
              className="flex items-center gap-1.5 font-medium text-[var(--color-stone)] hover:text-[var(--color-charcoal)]"
            >
              <AvatarBubble
                name={post.author.displayName}
                url={post.author.avatarUrl}
                size="size-5"
              />
              {post.author.displayName}
            </Link>
          )}
          {post.circle && (
            <>
              <span aria-hidden>·</span>
              <Link to={`/c/${post.circle.slug}`} className="text-[var(--color-coral)] hover:underline">
                {post.circle.name}
              </Link>
            </>
          )}
          <span className="ml-auto">{post.readTimeMinutes} min</span>
        </div>

        <PostActions
          post={post}
          onOpenModal={onOpenPost ? () => onOpenPost(post) : undefined}
        />
      </div>
    </article>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

type IconProps = { className?: string };
export function StitchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M5 14 12 5l7 9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" />
      <path d="M8 19h8" strokeLinecap="round" strokeDasharray="3 2.5" />
    </svg>
  );
}
