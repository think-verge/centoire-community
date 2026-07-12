import { generateHTML } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { useMemo } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { AvatarBubble } from "../../components/AppShell";
import { CommentThread } from "../../components/CommentThread";
import { PostActions } from "../../components/PostActions";
import { useGetPost } from "../../lib/api/generated/posts/posts";

const EXTENSIONS = [StarterKit, Image, Link];

export function PostDetailPage() {
  const { slug } = useParams();
  const { data: post, isLoading, error } = useGetPost(slug ?? "");

  const html = useMemo(() => {
    if (!post?.content) return null;
    try {
      return generateHTML(post.content, EXTENSIONS);
    } catch {
      return null;
    }
  }, [post?.content]);

  if (isLoading) {
    return <div className="p-10 text-center text-ink-faint">Loading…</div>;
  }
  if (error || !post) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Not found</p>
        <p className="text-ink-soft">{error?.message ?? "This post does not exist."}</p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          {post.tags.map((tag) => (
            <RouterLink key={tag.id} to={`/t/${tag.slug}`} className="kicker hover:underline">
              {tag.name}
            </RouterLink>
          ))}
          {post.circle && (
            <>
              <span className="text-ink-faint">·</span>
              <RouterLink
                to={`/c/${post.circle.slug}`}
                className="text-xs font-semibold text-gold hover:underline"
              >
                {post.circle.name}
              </RouterLink>
            </>
          )}
        </div>
        <h1 className="font-display-serif mt-3 text-4xl font-semibold leading-tight">
          {post.title}
        </h1>
        <div className="mt-4 flex items-center gap-3 text-sm text-ink-soft">
          {post.author && (
            <RouterLink
              to={post.author.handle ? `/u/${post.author.handle}` : "#"}
              className="flex items-center gap-2 font-medium text-ink hover:underline"
            >
              <AvatarBubble name={post.author.displayName} url={post.author.avatarUrl} />
              {post.author.displayName}
            </RouterLink>
          )}
          {post.source && (
            <a
              href={post.externalUrl ?? post.source.siteUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 font-medium text-ink hover:underline"
            >
              {post.source.faviconUrl && (
                <img src={post.source.faviconUrl} alt="" className="size-5 rounded" />
              )}
              From {new URL(post.source.siteUrl).hostname.replace("www.", "")}
            </a>
          )}
          <span aria-hidden>·</span>
          {post.publishedAt && (
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </time>
          )}
          <span aria-hidden>·</span>
          <span>{post.readTimeMinutes} min read</span>
        </div>
      </header>

      {post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt=""
          className="mt-8 w-full rounded-xl border border-line object-cover"
        />
      )}

      {post.origin === "aggregated" && post.externalUrl ? (
        <div className="mt-8 rounded-xl border border-line bg-paper p-6">
          <p className="text-lg leading-relaxed text-ink-soft">{post.excerpt}</p>
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
          >
            Read the full story ↗
          </a>
        </div>
      ) : (
        html && (
          <div
            className="prose-editorial mt-8 text-[17px] leading-relaxed"
            // Content is TipTap JSON authored in our editor and rendered with the
            // same extension set — no raw user HTML enters this path.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      )}

      <footer className="mt-10 border-t border-line pt-6" id="comments">
        <div className="mb-8 max-w-md">
          <PostActions post={post} />
        </div>
        <CommentThread postId={post.id} />
      </footer>
    </article>
  );
}
