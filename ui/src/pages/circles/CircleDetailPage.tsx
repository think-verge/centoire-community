import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CircleRulesModal } from "../../components/CircleRulesModal";
import { PostCard } from "../../components/PostCard";
import {
  useGetCircle,
  useJoinCircle,
  useLeaveCircle,
  useListCircleMembers,
  useListCirclePostsInfinite,
  useListCircles,
} from "../../lib/api/generated/circles/circles";

export function CircleDetailPage() {
  const { slug } = useParams();
  const [rulesOpen, setRulesOpen] = useState(false);
  const { data: circle, isLoading, refetch } = useGetCircle(slug ?? "");
  const {
    data: postPages,
    isLoading: postsLoading,
    isError: postsError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useListCirclePostsInfinite(
    slug ?? "",
    {},
    {
      query: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    },
  );
  const posts = postPages?.pages.flatMap((page) => page.items) ?? [];

  const { data: members } = useListCircleMembers(slug ?? "");
  const firstHashtag = circle?.hashtags[0];
  const { data: relatedPool } = useListCircles(
    firstHashtag ? { hashtag: firstHashtag, limit: 8 } : undefined,
    { query: { enabled: Boolean(firstHashtag) } },
  );

  const join = useJoinCircle({ mutation: { onSuccess: () => refetch() } });
  const leave = useLeaveCircle({ mutation: { onSuccess: () => refetch() } });

  if (isLoading) return <div className="p-10 text-ink-faint font-ui">Loading...</div>;
  if (!circle) {
    return (
      <div className="p-10 text-center">
        <p className="kicker mb-2">Not found</p>
        <p className="text-ink-soft font-ui">This circle does not exist.</p>
      </div>
    );
  }

  const joined = Boolean(circle.viewerRole);

  const moderators = (members ?? []).filter((m) => m.role !== "member").slice(0, 3);
  const related = (relatedPool ?? []).filter((c) => c.id !== circle.id).slice(0, 5);

  function handleJoinClick() {
    if (!circle) return;
    if (joined) {
      if (circle.viewerRole === "owner") return;
      if (window.confirm(`Leave ${circle.name}?`)) leave.mutate({ slug: circle.slug });
    } else if (circle.rules.length > 0) {
      setRulesOpen(true);
    } else {
      join.mutate({ slug: circle.slug });
    }
  }

  return (
    <div className="flex flex-col lg:flex-row bg-[#F0F0F0]">

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 pb-12">
        {/* Banner area */}
        <div className="relative">
          <div className="h-[100px] sm:h-[120px] w-full bg-[#E5E5E5] overflow-hidden">
            {circle.coverImageUrl ? (
              <img src={circle.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#EAEAEA] to-[#F5F5F5]" />
            )}
          </div>
          <div className="absolute bottom-0 left-0 w-full translate-y-[45%] px-6 sm:px-10 flex justify-between items-end">
            <div className="size-[90px] sm:size-[110px] rounded-full border-[4px] border-[#FAFAFA] bg-white overflow-hidden shadow-sm">
              {circle.avatarUrl ? (
                <img src={circle.avatarUrl} alt={circle.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#111111] flex items-center justify-center font-editorial text-[40px] font-bold text-white">
                  {circle.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleJoinClick}
                disabled={join.isPending || leave.isPending || circle.viewerRole === "owner"}
                className="rounded-[20px] border border-[#111111] bg-transparent px-5 sm:px-6 py-1.5 sm:py-2 font-ui text-[13px] font-bold text-[#111111] transition-colors hover:bg-black hover:text-white disabled:opacity-50"
              >
                {joined ? (circle.viewerRole === "owner" ? "Owner" : "Joined") : "Join circle"}
              </button>
              {joined && (
                <Link
                  to={`/compose?circle=${circle.id}`}
                  className="rounded-[20px] bg-[#111111] px-5 sm:px-6 py-1.5 sm:py-2 font-ui text-[13px] font-bold text-white transition-colors hover:bg-black"
                >
                  Create post
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Title and Intro */}
        <div className="mt-[50px] sm:mt-[60px] px-6 sm:px-10">
          <h1 className="font-editorial text-[28px] sm:text-[32px] font-medium text-[#111111] leading-tight mb-1">
            {circle.name}
          </h1>
          <p className="font-ui text-[14px] sm:text-[15px] text-[#5A5A5A] leading-relaxed max-w-3xl">
            {circle.description}
          </p>
        </div>

        <hr className="my-5 mx-6 sm:mx-10 border-t border-[#D0D0D0]" />

        {/* Posts Feed Header */}
        <div className="mt-4 px-6 sm:px-10 flex items-center justify-between mb-3">
          <h2 className="font-ui text-[16px] font-bold text-[#111111]">Feed</h2>
        </div>

        {/* Vertical Feed */}
        <div className="px-6 sm:px-10 space-y-5">
          {postsLoading ? (
            <p className="font-ui text-[14px] text-[#8A8A8A]">Loading posts...</p>
          ) : postsError ? (
            <p className="font-ui text-[14px] text-crimson">Couldn't load posts. Please try again.</p>
          ) : posts.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#D0D0D0] bg-white p-10 text-center">
              <p className="font-editorial text-[22px] font-medium text-[#111111]">No posts yet</p>
              <p className="mt-1 font-ui text-[14px] text-[#5A5A5A]">
                {joined ? "Be the first to post in this circle." : "Join this circle to start the conversation."}
              </p>
            </div>
          ) : (
            <>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {hasNextPage && (
                <button
                  onClick={() => void fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="mx-auto block rounded-full border border-[#111111] px-6 py-2 font-ui text-[13px] font-bold text-[#111111] hover:bg-black hover:text-white disabled:opacity-50"
                >
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-full lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#EAEAEA] bg-white">
        <div className="lg:sticky lg:top-14 px-6 pt-4 pb-6 sm:px-8 sm:pt-4 sm:pb-8 lg:overflow-y-auto lg:h-[calc(100vh-56px)] space-y-5 no-scrollbar">

          {/* Top Section */}
          <div>
            <h2 className="font-editorial text-[26px] font-medium text-[#111111] mb-1">
              {circle.name}
            </h2>
            <p className="font-ui text-[13px] text-[#5A5A5A] leading-relaxed mb-4">
              {circle.description}
            </p>
            <div className="flex gap-2">
              <div className="bg-[#F5F5F5] rounded-[12px] px-3 py-2 min-w-[85px]">
                <p className="font-ui text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-1">MEMBERS</p>
                <p className="font-ui text-[16px] font-bold text-[#111111]">{circle.memberCount.toLocaleString()}</p>
              </div>
              <div className="bg-[#F5F5F5] rounded-[12px] px-3 py-2 min-w-[85px]">
                <p className="font-ui text-[10px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-1">POSTS</p>
                <p className="font-ui text-[16px] font-bold text-[#111111]">{circle.postCount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <hr className="border-t border-[#EAEAEA]" />

          {/* About */}
          <div>
            <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-3">ABOUT THE CIRCLE</h3>
            <p className="font-ui text-[13px] text-[#5A5A5A] leading-[1.6] mb-4">
              {circle.about || circle.description}
            </p>
            {circle.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {circle.hashtags.map((name) => (
                  <Link
                    key={name}
                    to={`/hashtag/${name}`}
                    className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] font-semibold text-[#111111] hover:border-[#111111]"
                  >
                    #{name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <hr className="border-t border-[#EAEAEA]" />

          {circle.rules.length > 0 && (
            <>
              <div>
                <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-2">RULES</h3>
                <ul className="space-y-3">
                  {circle.rules.map((rule, i) => (
                    <li key={i} className="flex gap-2.5 items-start">
                      <span className="mt-1.5 size-1.5 rounded-full bg-[#E5552D] shrink-0" />
                      <span className="font-ui text-[12px] text-[#5A5A5A] leading-[1.5]">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <hr className="border-t border-[#EAEAEA]" />
            </>
          )}

          {/* Membership */}
          <div>
            <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-2">MEMBERSHIP</h3>
            <div className="space-y-1.5 font-ui text-[12px]">
              <div className="flex justify-between items-center">
                <span className="text-[#8A8A8A]">Created</span>
                <span className="font-bold text-[#111111]">
                  {new Date(circle.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                </span>
              </div>
              {moderators.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[#8A8A8A]">Moderators</span>
                  <div className="flex items-center gap-1.5">
                    {moderators.map((mod) => (
                      <Link
                        key={mod.user.id}
                        to={mod.user.handle ? `/u/${mod.user.handle}` : "#"}
                        title={mod.user.displayName}
                        className="size-[22px] rounded-full overflow-hidden bg-[#111111] text-white flex items-center justify-center text-[10px] font-bold"
                      >
                        {mod.user.avatarUrl ? (
                          <img src={mod.user.avatarUrl} alt={mod.user.displayName} className="w-full h-full object-cover" />
                        ) : (
                          mod.user.displayName.charAt(0).toUpperCase()
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {related.length > 0 && (
            <div>
              <h3 className="font-ui text-[13px] font-bold text-[#8A8A8A] uppercase tracking-wider mb-3">RELATED CIRCLES</h3>
              <div className="flex flex-wrap gap-1.5">
                {related.map((c) => (
                  <Link
                    key={c.id}
                    to={`/c/${c.slug}`}
                    className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 font-ui text-[11px] text-[#111111] hover:border-[#111111]"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {rulesOpen && (
        <CircleRulesModal
          circle={circle}
          onCancel={() => setRulesOpen(false)}
          onAgree={() =>
            join.mutate(
              { slug: circle.slug },
              { onSuccess: () => setRulesOpen(false) },
            )
          }
          loading={join.isPending}
        />
      )}
    </div>
  );
}
