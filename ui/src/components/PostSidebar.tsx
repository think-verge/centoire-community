import { useState } from "react";
import { Link } from "react-router-dom";
import { AvatarBubble } from "./AppShell";
import {
  useFollowUser,
  useUnfollowUser,
} from "../lib/api/generated/users/users";
import { useAuth } from "../lib/auth-context";
import type { PostDetail } from "../lib/api/generated/model";

export function PostSidebar({ post }: { post: PostDetail }) {
  const { user } = useAuth();
  const canFollow = post.author && user && user.id !== post.author.id;

  return (
    <aside className="space-y-6">
      {post.author && (
        <div className="rounded-xl border border-line bg-paper p-4">
          <Link
            to={post.author.handle ? `/u/${post.author.handle}` : "#"}
            className="flex items-center gap-3 hover:underline"
          >
            <AvatarBubble
              name={post.author.displayName}
              url={post.author.avatarUrl}
              size="size-10"
            />
            <div className="min-w-0">
              <p className="font-semibold leading-tight text-ink">
                {post.author.displayName}
              </p>
              {post.author.handle && (
                <p className="text-xs text-ink-faint">@{post.author.handle}</p>
              )}
            </div>
          </Link>
          {post.authorIsCreator && (
            <div className="mt-2">
              <span className="rounded-full bg-crimson px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-inverse">
                Must Read Creator
              </span>
            </div>
          )}
          {canFollow && (
            <div className="mt-3">
              <FollowButton
                authorId={post.author.id}
                initialFollowing={post.authorFollowedByViewer}
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-1 text-sm text-ink-soft">
        <p>
          <span className="font-semibold text-ink">{post.readTimeMinutes} min</span> read
        </p>
        {post.publishedAt && (
          <time dateTime={post.publishedAt} className="block">
            {new Date(post.publishedAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        )}
      </div>

      {post.tags.length > 0 && (
        <div>
          <p className="kicker mb-2">Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/t/${tag.slug}`}
                className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-ink-soft hover:text-ink"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function FollowButton({
  authorId,
  initialFollowing,
}: {
  authorId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const followUser = useFollowUser({
    mutation: { onSuccess: () => setFollowing(true) },
  });
  const unfollowUser = useUnfollowUser({
    mutation: { onSuccess: () => setFollowing(false) },
  });
  const loading = followUser.isPending || unfollowUser.isPending;

  function toggle() {
    if (following) unfollowUser.mutate({ id: authorId });
    else followUser.mutate({ id: authorId });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`w-full rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
        following
          ? "border-line bg-paper text-ink-soft hover:border-crimson hover:text-crimson"
          : "border-crimson bg-crimson text-ink-inverse hover:bg-crimson-deep"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
