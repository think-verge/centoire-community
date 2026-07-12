import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AvatarBubble } from "../../components/AppShell";
import { Button } from "../../components/Button";
import { MasonryFeed } from "../../components/MasonryFeed";
import {
  getGetUserByHandleQueryKey,
  useFollowUser,
  useGetUserByHandle,
  useListUserPosts,
  useUnfollowUser,
} from "../../lib/api/generated/users/users";
import { useAuth } from "../../lib/auth-context";

export function ProfilePage() {
  const { handle } = useParams();
  const { user: viewer } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetUserByHandle(handle ?? "");
  const { data: posts, isLoading: postsLoading } = useListUserPosts(handle ?? "");

  function refresh() {
    void queryClient.invalidateQueries({
      queryKey: getGetUserByHandleQueryKey(handle ?? ""),
    });
  }
  const follow = useFollowUser({ mutation: { onSuccess: refresh } });
  const unfollow = useUnfollowUser({ mutation: { onSuccess: refresh } });

  if (isLoading) return <div className="p-10 text-ink-faint">Loading…</div>;
  if (!profile) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Not found</p>
        <p className="text-ink-soft">No member goes by @{handle}.</p>
      </div>
    );
  }

  const isSelf = viewer?.id === profile.id;

  return (
    <div className="px-4 py-8 sm:px-6">
      <header className="rounded-xl border border-line bg-paper p-6">
        <div className="flex flex-wrap items-center gap-5">
          <AvatarBubble name={profile.displayName} url={profile.avatarUrl} size="size-20 text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display-serif text-3xl font-semibold">{profile.displayName}</h1>
            <p className="text-sm text-ink-faint">@{profile.handle}</p>
            {profile.bio && <p className="mt-2 max-w-xl text-ink-soft">{profile.bio}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span>
                <strong className="font-display-serif text-gold">{profile.reputation}</strong>{" "}
                <span className="text-ink-soft">reputation</span>
              </span>
              <span>
                <strong>{profile.followerCount}</strong>{" "}
                <span className="text-ink-soft">followers</span>
              </span>
              <span>
                <strong>{profile.followingCount}</strong>{" "}
                <span className="text-ink-soft">following</span>
              </span>
              <span>
                <strong>{profile.postCount}</strong> <span className="text-ink-soft">posts</span>
              </span>
            </div>
          </div>
          {!isSelf && (
            <Button
              variant={profile.isFollowing ? "secondary" : "primary"}
              loading={follow.isPending || unfollow.isPending}
              onClick={() =>
                profile.isFollowing
                  ? unfollow.mutate({ id: profile.id })
                  : follow.mutate({ id: profile.id })
              }
            >
              {profile.isFollowing ? "Following" : "Follow"}
            </Button>
          )}
        </div>
      </header>

      <div className="mt-8">
        <p className="kicker mb-4">Published work</p>
        <MasonryFeed
          posts={posts ?? []}
          isLoading={postsLoading}
          hasNextPage={false}
          isFetchingNextPage={false}
          fetchNextPage={() => undefined}
          emptyState={
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-display-serif text-2xl font-semibold">
                Nothing published yet
              </p>
              <p className="mt-2 text-sm text-ink-soft">
                {isSelf ? "Your published posts will appear here." : "Check back soon."}
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}
