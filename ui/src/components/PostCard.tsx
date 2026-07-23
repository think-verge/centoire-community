import { Link, useNavigate } from "react-router-dom";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { AvatarBubble } from "./AppShell";
import { PostActions } from "./PostActions";

/**
 * Masonry hybrid: posts with a cover image render as visual cards, text posts
 * as compact editorial cards. Both share the byline + action row.
 */
export function PostCard({
  post,
  onOpenPost,
}: {
  post: PostCardType;
  onOpenPost?: (post: PostCardType) => void;
}) {
  const navigate = useNavigate();
  const external = post.origin === "aggregated" && post.externalUrl;

  function openPost() {
    if (onOpenPost) {
      onOpenPost(post);
    } else if (external) {
      window.open(post.externalUrl!, "_blank", "noopener");
    } else {
      navigate(`/p/${post.slug}`);
    }
  }

  return (
    <article className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-line bg-paper shadow-card transition-shadow hover:shadow-card-hover">
      {post.coverImageUrl && (
        <button type="button" onClick={openPost} className="block w-full cursor-pointer">
          <img
            src={post.coverImageUrl}
            alt=""
            loading="lazy"
            className="max-h-72 w-full object-cover"
          />
        </button>
      )}
      <div className="p-4">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {post.authorIsCreator && (
            <span className="rounded-full bg-crimson px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-inverse">
              Must Read
            </span>
          )}
          {post.tags.slice(0, 2).map((tag) => (
            <Link key={tag.id} to={`/t/${tag.slug}`} className="kicker hover:underline">
              {tag.name}
            </Link>
          ))}
        </div>
        <button type="button" onClick={openPost} className="block cursor-pointer text-left">
          <h2 className="font-display-serif text-xl font-semibold leading-snug group-hover:text-crimson-deep">
            {post.title}
            {external && <span className="ml-1 text-sm text-ink-faint">↗</span>}
          </h2>
        </button>
        {!post.coverImageUrl && post.excerpt && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
            {post.excerpt}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
          {post.author && (
            <Link
              to={post.author.handle ? `/u/${post.author.handle}` : "#"}
              className="flex items-center gap-1.5 font-medium text-ink-soft hover:text-ink"
            >
              <AvatarBubble
                name={post.author.displayName}
                url={post.author.avatarUrl}
                size="size-5"
              />
              {post.author.displayName}
            </Link>
          )}
          {post.source && (
            <span className="flex items-center gap-1.5 font-medium text-ink-soft">
              {post.source.faviconUrl && (
                <img src={post.source.faviconUrl} alt="" className="size-4 rounded-sm" />
              )}
              {hostname(post.source.siteUrl)}
            </span>
          )}
          {post.circle && (
            <>
              <span aria-hidden>·</span>
              <Link to={`/c/${post.circle.slug}`} className="text-gold hover:underline">
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
/** The Centoire upvote is a stitch — thread dashes over a peak. */
export function StitchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M5 14 12 5l7 9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" />
      <path d="M8 19h8" strokeLinecap="round" strokeDasharray="3 2.5" />
    </svg>
  );
}
