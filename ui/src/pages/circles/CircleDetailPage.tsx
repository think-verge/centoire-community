import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AvatarBubble } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { MasonryFeed } from "../../components/MasonryFeed";
import {
  useGetCircle,
  useJoinCircle,
  useLeaveCircle,
  useListCircleMembers,
  useListCirclePosts,
} from "../../lib/api/generated/circles/circles";

export function CircleDetailPage() {
  const { slug } = useParams();
  const [tab, setTab] = useState<"posts" | "about" | "members">("posts");
  const [rulesOpen, setRulesOpen] = useState(false);
  const { data: circle, isLoading, refetch } = useGetCircle(slug ?? "");
  const { data: posts, isLoading: postsLoading } = useListCirclePosts(slug ?? "");
  const { data: members } = useListCircleMembers(slug ?? "", {
    query: { enabled: tab === "members" },
  });

  const join = useJoinCircle({ mutation: { onSuccess: () => refetch() } });
  const leave = useLeaveCircle({ mutation: { onSuccess: () => refetch() } });

  if (isLoading) return <div className="p-10 text-ink-faint">Loading…</div>;
  if (!circle) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Not found</p>
        <p className="text-ink-soft">This circle does not exist.</p>
      </div>
    );
  }

  const joined = Boolean(circle.viewerRole);
  const isOwner = circle.viewerRole === "owner";

  function handleJoinClick() {
    if (joined) {
      leave.mutate({ slug: circle!.slug });
    } else if (circle!.rules.length > 0) {
      setRulesOpen(true);
    } else {
      join.mutate({ slug: circle!.slug });
    }
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <header className="rounded-xl border border-line bg-paper p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="kicker mb-1">Circle</p>
            <h1 className="font-display-serif text-3xl font-semibold">{circle.name}</h1>
            <p className="mt-1 text-ink-soft">{circle.description}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-faint">
              <span>{circle.memberCount} members</span>
              <span aria-hidden>·</span>
              <span>{circle.postCount} posts</span>
              {circle.tags.map((tag) => (
                <Link key={tag.id} to={`/t/${tag.slug}`} className="kicker ml-1 hover:underline">
                  {tag.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {joined && (
              <Link
                to={`/compose`}
                className="rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold hover:border-ink-soft"
              >
                Write in circle
              </Link>
            )}
            {!isOwner && (
              <Button
                variant={joined ? "secondary" : "primary"}
                onClick={handleJoinClick}
                loading={join.isPending || leave.isPending}
              >
                {joined ? "Joined" : "Join circle"}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6 flex gap-2 border-b border-line">
        {(["posts", "about", "members"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-selected={tab === value}
            className={`border-b-2 px-3 pb-2 text-sm font-semibold capitalize transition-colors ${
              tab === value
                ? "border-crimson text-crimson"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "posts" && (
          <MasonryFeed
            posts={posts ?? []}
            isLoading={postsLoading}
            hasNextPage={false}
            isFetchingNextPage={false}
            fetchNextPage={() => undefined}
            emptyState={
              <div className="rounded-xl border border-dashed border-line p-12 text-center">
                <p className="font-display-serif text-2xl font-semibold">No posts yet</p>
                <p className="mt-2 text-sm text-ink-soft">
                  {joined ? "Write the first post for this circle." : "Join and start the conversation."}
                </p>
              </div>
            }
          />
        )}
        {tab === "about" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <p className="kicker mb-2">About</p>
              <p className="whitespace-pre-wrap text-ink-soft">
                {circle.about ?? circle.description}
              </p>
            </div>
            {circle.rules.length > 0 && (
              <div>
                <p className="kicker mb-2">Rules</p>
                <ol className="space-y-2">
                  {circle.rules.map((rule, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink-soft">
                      <span className="font-display-serif font-semibold text-gold">{i + 1}</span>
                      {rule}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
        {tab === "members" && (
          <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
            {(members ?? []).map(({ role, user }) => (
              <Link
                key={user.id}
                to={user.handle ? `/u/${user.handle}` : "#"}
                className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4 hover:shadow-card-hover"
              >
                <AvatarBubble name={user.displayName} url={user.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{user.displayName}</p>
                  <p className="text-xs text-ink-faint">
                    {user.handle && `@${user.handle} · `}
                    <span className={role === "owner" ? "text-gold" : ""}>{role}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {rulesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Circle rules"
          onClick={() => setRulesOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-card-hover"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="kicker mb-1">Before you join</p>
            <h2 className="font-display-serif text-2xl font-semibold">{circle.name} rules</h2>
            <ol className="mt-4 space-y-2">
              {circle.rules.map((rule, i) => (
                <li key={i} className="flex gap-3 text-sm text-ink-soft">
                  <span className="font-display-serif font-semibold text-gold">{i + 1}</span>
                  {rule}
                </li>
              ))}
            </ol>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRulesOpen(false)}>
                Cancel
              </Button>
              <Button
                loading={join.isPending}
                onClick={() =>
                  join.mutate(
                    { slug: circle.slug },
                    { onSuccess: () => setRulesOpen(false) },
                  )
                }
              >
                Agree & join
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
