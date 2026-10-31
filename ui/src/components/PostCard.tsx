import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { useFollowUser, useUnfollowUser } from "../lib/api/generated/users/users";
import { useAuth } from "../lib/auth-context";
import { PostActions } from "./PostActions";
import { CATEGORY_LABELS, isPostCategory } from "../lib/categoryTaxonomy";
import { customInstance } from "../lib/api/http";
import { readPostUrl } from "../lib/readPost";

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
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [authorTooltipOpen, setAuthorTooltipOpen] = useState(false);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const authorCloseTimer = useRef<NodeJS.Timeout | null>(null);
  const provenanceCloseTimer = useRef<NodeJS.Timeout | null>(null);

  function openPost() {
    if (onOpenPost) {
      onOpenPost(post);
    } else if (external) {
      window.open(readPostUrl(post.id), "_blank", "noopener");
    } else {
      navigate(`/p/${post.slug}`);
    }
  }

  const [authorPlacement, setAuthorPlacement] = useState<"bottom" | "top">("bottom");
  const [provenancePlacement, setProvenancePlacement] = useState<"bottom" | "top">("bottom");
  const [lastOpened, setLastOpened] = useState<"author" | "options" | "provenance" | null>(null);
  const authorAnchorRef = useRef<HTMLDivElement>(null);
  const provenanceAnchorRef = useRef<HTMLDivElement>(null);

  function checkAuthorPlacement() {
    if (authorAnchorRef.current) {
      const rect = authorAnchorRef.current.getBoundingClientRect();
      const docHeight = document.documentElement.scrollHeight;
      const cardBottomInDoc = window.scrollY + rect.bottom;
      const spaceBelowInDoc = docHeight - cardBottomInDoc;
      // Only flip to top for cards at the very bottom/last row of the feed where document space is scarce (< 280px)
      if (spaceBelowInDoc < 280 && rect.top > 200) {
        setAuthorPlacement("top");
      } else {
        setAuthorPlacement("bottom");
      }
    }
  }

  function checkProvenancePlacement() {
    if (provenanceAnchorRef.current) {
      const rect = provenanceAnchorRef.current.getBoundingClientRect();
      const docHeight = document.documentElement.scrollHeight;
      const cardBottomInDoc = window.scrollY + rect.bottom;
      const spaceBelowInDoc = docHeight - cardBottomInDoc;
      if (spaceBelowInDoc < 280 && rect.top > 200) {
        setProvenancePlacement("top");
      } else {
        setProvenancePlacement("bottom");
      }
    }
  }

  function handleAuthorEnter() {
    if (authorCloseTimer.current) {
      clearTimeout(authorCloseTimer.current);
      authorCloseTimer.current = null;
    }
    checkAuthorPlacement();
    setLastOpened("author");
    setAuthorTooltipOpen(true);
  }

  function handleAuthorLeave() {
    authorCloseTimer.current = setTimeout(() => {
      setAuthorTooltipOpen(false);
    }, 250);
  }

  function handleProvenanceEnter() {
    if (provenanceCloseTimer.current) {
      clearTimeout(provenanceCloseTimer.current);
      provenanceCloseTimer.current = null;
    }
    checkProvenancePlacement();
    setLastOpened("provenance");
    setProvenanceOpen(true);
  }

  function handleProvenanceLeave() {
    provenanceCloseTimer.current = setTimeout(() => {
      setProvenanceOpen(false);
    }, 250);
  }

  const categoryLabel =
    post.subcategory ??
    (post.category && isPostCategory(post.category) ? CATEGORY_LABELS[post.category] : null);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const initialFollowed = Boolean((post.viewer as unknown as { authorFollowed?: boolean })?.authorFollowed);
  const [following, setFollowing] = useState(initialFollowed);
  const initialFollowerCount = (post.author as unknown as { followerCount?: number })?.followerCount ?? 0;
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);

  const isPostHiddenLocally = (id: string) => {
    try {
      const list = JSON.parse(localStorage.getItem("centoire_hidden_posts") || "[]");
      return Array.isArray(list) && list.includes(id);
    } catch {
      return false;
    }
  };
  const [dismissed, setDismissed] = useState(() => isPostHiddenLocally(post.id));

  const handleHidePost = () => {
    setDismissed(true);
    try {
      const list = JSON.parse(localStorage.getItem("centoire_hidden_posts") || "[]");
      if (Array.isArray(list) && !list.includes(post.id)) {
        list.push(post.id);
        localStorage.setItem("centoire_hidden_posts", JSON.stringify(list));
      }
    } catch {
      // ignore
    }
  };

  const initialSourceFollowed = Boolean((post.viewer as unknown as { sourceFollowed?: boolean })?.sourceFollowed);
  const [sourceFollowing, setSourceFollowing] = useState(initialSourceFollowed);
  const [sourceFollowPending, setSourceFollowPending] = useState(false);

  useEffect(() => {
    const isSourceFollowed = (post.viewer as unknown as { sourceFollowed?: boolean })?.sourceFollowed;
    if (typeof isSourceFollowed === "boolean") {
      setSourceFollowing(isSourceFollowed);
    }
  }, [(post.viewer as unknown as { sourceFollowed?: boolean })?.sourceFollowed]);

  const handleSourceFollowClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate("/login");
      return;
    }
    const sourceId = post.source?.id;
    const nextState = !sourceFollowing;
    setSourceFollowing(nextState);
    setSourceFollowPending(true);

    try {
      if (sourceId) {
        if (nextState) {
          await customInstance({ url: `/sources/${sourceId}/follow`, method: "POST" });
        } else {
          await customInstance({ url: `/sources/${sourceId}/follow`, method: "DELETE" });
        }
      } else {
        if (nextState) {
          await customInstance({ url: `/posts/${post.id}/follow-source`, method: "POST" });
        } else {
          await customInstance({ url: `/posts/${post.id}/follow-source`, method: "DELETE" });
        }
      }
      void queryClient.invalidateQueries();
    } catch (err) {
      console.error("Source follow error:", err);
      setSourceFollowing(!nextState);
    } finally {
      setSourceFollowPending(false);
    }
  };

  useEffect(() => {
    const isFollowed = (post.viewer as unknown as { authorFollowed?: boolean })?.authorFollowed;
    if (typeof isFollowed === "boolean") {
      setFollowing(isFollowed);
    }
  }, [(post.viewer as unknown as { authorFollowed?: boolean })?.authorFollowed]);

  useEffect(() => {
    const count = (post.author as unknown as { followerCount?: number })?.followerCount;
    if (typeof count === "number") {
      setFollowerCount(count);
    }
  }, [post.author]);

  const followMutation = useFollowUser({
    mutation: {
      onSuccess: () => {
        setFollowing(true);
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        console.error("Follow error:", err);
        setFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      },
    },
  });

  const unfollowMutation = useUnfollowUser({
    mutation: {
      onSuccess: () => {
        setFollowing(false);
        void queryClient.invalidateQueries();
      },
      onError: (err) => {
        console.error("Unfollow error:", err);
        setFollowing(true);
        setFollowerCount((c) => c + 1);
      },
    },
  });

  const isCreatorPost = post.origin === "native" && Boolean(post.author);
  const isEditorialAuthor =
    !post.author?.displayName?.trim() ||
    post.author.displayName.toLowerCase().includes("centoire") ||
    post.author.handle === "centoire_team1" ||
    post.author.displayName.toLowerCase().includes("editor");

  const authorInitial = isEditorialAuthor
    ? "E"
    : post.author!.displayName.trim().charAt(0).toUpperCase();

  const hasAvatar = Boolean(post.author?.avatarUrl && !avatarFailed);

  const sourceName = post.source?.name || (post.origin === "aggregated" ? "Open Web" : "Centoire");
  const sourceUrl = post.source?.siteUrl;
  const publishedDateStr = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Recently";

  const isProvTop = provenancePlacement === "top";
  const isAuthorTop = authorPlacement === "top";

  if (dismissed) return null;

  return (
    <article
      className={`group relative break-inside-avoid rounded-[16px] bg-white flex flex-col flex-1 min-h-[320px] h-full transition-shadow duration-300 ${
        authorTooltipOpen || provenanceOpen || lastOpened === "options" ? "z-30" : "hover:z-20"
      }`}
      style={{ boxShadow: '0px 4px 14px rgba(17, 17, 17, 0.14)' }}
    >
      {post.coverImageUrl ? (
        <button type="button" onClick={openPost} className="relative h-[158px] w-full shrink-0 cursor-pointer overflow-hidden rounded-t-[16px]">
          {!imageLoaded && (
            <div className="h-full w-full animate-pulse bg-[var(--color-sand)]" aria-hidden />
          )}
          <img
            src={post.coverImageUrl}
            alt=""
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "absolute inset-0 opacity-0"
            }`}
          />
          {/* Badge */}
          {(post.authorIsCreator || post.upvoteCount > 100) ? (
            <div className="absolute top-2 right-2 bg-[#00C365] text-white rounded-full px-2 py-0.5 text-[12px] font-medium font-ui flex items-center gap-1 shadow-sm">
              {post.authorIsCreator ? (
                <>
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  Centoire Pick
                </>
              ) : (
                <>
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
                  Hot
                </>
              )}
            </div>
          ) : null}
          {/* Category overlay */}
          {imageLoaded && categoryLabel && (
            <div className="absolute bottom-2 left-2 bg-[#111111]/40 backdrop-blur-md text-white rounded-full px-2.5 py-[2px] text-[12px] font-medium font-ui flex items-center gap-1.5 shadow-sm">
              <span className="size-1.5 rounded-full bg-[#3CCBFF]"></span>
              {categoryLabel}
            </div>
          )}
        </button>
      ) : (
        <button type="button" onClick={openPost} className="relative h-[158px] w-full shrink-0 cursor-pointer bg-[#F9F9F9] overflow-hidden rounded-t-[16px]">
          {/* Grey space matching image height perfectly to maintain card size parity */}
        </button>
      )}

      <div className="p-3 flex flex-col flex-1 gap-1">
        <p className="text-[12px] font-ui text-[#737373] flex items-center">
          {new Date(post.publishedAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          <span className="w-[3px] h-[3px] rounded-full bg-[#111111]/30 mx-2 block"></span> 
          {post.readTimeMinutes || 4} min read
        </p>

        <button type="button" onClick={openPost} className="block cursor-pointer text-left mt-2">
          <h3 className="font-editorial text-[20px] font-medium leading-tight text-[#111111] line-clamp-3 group-hover:text-[#E4572E]">
            {post.title}
          </h3>
        </button>

        {/* Footer actions row */}
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-[#EAEAEA] border-opacity-60">
          <PostActions
            post={post}
            onOpenModal={onOpenPost ? () => onOpenPost(post) : undefined}
            onOptionsToggle={(open) => {
              if (open) setLastOpened("options");
            }}
            optionsZIndex={lastOpened === "options" ? 70 : 50}
            onHide={handleHidePost}
            prependNode={
              <div className="flex items-center">
                {!isCreatorPost ? (
                  <div
                    ref={provenanceAnchorRef}
                    className="relative cursor-pointer"
                    onMouseEnter={handleProvenanceEnter}
                    onMouseLeave={handleProvenanceLeave}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        checkProvenancePlacement();
                        setLastOpened("provenance");
                        setProvenanceOpen((prev) => !prev);
                      }}
                      className="size-8 shrink-0 rounded-full bg-[#EAEAEA] text-[#111111]/60 flex items-center justify-center hover:bg-[#E0E0E0] transition-colors"
                    >
                      <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    </div>
                    {/* Provenance Tooltip */}
                    <div
                      onMouseEnter={handleProvenanceEnter}
                      onMouseLeave={handleProvenanceLeave}
                      style={{ zIndex: lastOpened === "provenance" ? 70 : 50 }}
                      className={`absolute ${
                        isProvTop
                          ? "bottom-full mb-2 after:-bottom-2 after:h-2"
                          : "top-full mt-2 after:-top-2 after:h-2"
                      } left-[-18px] w-[250px] rounded-[16px] bg-white border border-[#EAEAEA] shadow-[0px_4px_14px_rgba(17,17,17,0.14)] ${
                        provenanceOpen ? "flex" : "hidden"
                      } flex-col cursor-default after:content-[''] after:absolute after:left-0 after:w-full`}
                    >
                      {/* Tooltip Tail */}
                      {isProvTop ? (
                        <div className="absolute -bottom-[8px] left-[24px] size-[16px] bg-white border-b border-r border-[#EAEAEA] rotate-45 pointer-events-none"></div>
                      ) : (
                        <div className="absolute -top-[8px] left-[24px] size-[16px] bg-white border-t border-l border-[#EAEAEA] rotate-45 pointer-events-none"></div>
                      )}
                      <div className="relative z-10 bg-white rounded-[16px] p-[12px] flex flex-col">
                        <div className="flex items-center gap-1.5 text-[#E5552D]">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                          <span className="font-ui text-[10px] font-bold uppercase tracking-wider">OPEN PROVENANCE</span>
                        </div>
                        <p className="font-editorial text-[13px] font-medium leading-tight mt-2 text-[#111111]">
                          This post was openly sourced from {sourceName}.
                        </p>
                        <p className="font-ui text-[11px] text-[#737373] leading-relaxed mt-2">
                          Added on {publishedDateStr}. Indexed by Centoire to help the fashion community discover and explore conversations from across the web.
                        </p>
                        <div className="border-t border-[#EAEAEA] my-2.5"></div>
                        <div className="font-ui font-semibold flex justify-between items-center text-[10px]">
                          {sourceUrl ? (
                            <a
                              href={sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#111111] flex items-center gap-1 hover:text-[#E5552D] transition-colors cursor-pointer"
                            >
                              View source feed
                              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          ) : (
                            <span className="text-[#737373]">Source indexed</span>
                          )}
                          <Link
                            to="/discover"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#E5552D] cursor-pointer hover:underline"
                          >
                            Learn more
                          </Link>
                        </div>
                        <button
                          type="button"
                          disabled={sourceFollowPending}
                          onClick={handleSourceFollowClick}
                          className={`rounded-[10px] py-2 mt-3 w-full font-ui text-[13px] font-semibold transition-colors cursor-pointer flex items-center justify-center ${
                            sourceFollowing
                              ? "border border-[#EAEAEA] text-[#737373] hover:border-red-300 hover:text-red-500 bg-white"
                              : "bg-[#E5552D] text-white hover:bg-[#D4441C]"
                          }`}
                        >
                          {sourceFollowing ? "Following" : "Follow"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    ref={authorAnchorRef}
                    className="relative cursor-pointer"
                    onMouseEnter={handleAuthorEnter}
                    onMouseLeave={handleAuthorLeave}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        checkAuthorPlacement();
                        setLastOpened("author");
                        setAuthorTooltipOpen((prev) => !prev);
                      }}
                      className={`size-8 shrink-0 rounded-full flex items-center justify-center font-ui font-bold text-[14px] overflow-hidden hover:opacity-90 transition-opacity ${
                        hasAvatar ? "bg-transparent" : "bg-[#3A76C4] text-white"
                      }`}
                    >
                      {hasAvatar ? (
                        <img
                          src={post.author!.avatarUrl!}
                          alt=""
                          className="size-full object-contain"
                          onError={() => setAvatarFailed(true)}
                        />
                      ) : (
                        authorInitial
                      )}
                    </div>
                    {/* Author Tooltip */}
                    <div
                      onMouseEnter={handleAuthorEnter}
                      onMouseLeave={handleAuthorLeave}
                      style={{ zIndex: lastOpened === "author" ? 70 : 50 }}
                      className={`absolute ${
                        isAuthorTop
                          ? "bottom-full mb-[6px] after:-bottom-[6px] after:h-[6px]"
                          : "top-full mt-[10px] after:-top-[10px] after:h-[10px]"
                      } left-[-18px] w-[240px] rounded-[16px] bg-white border border-[#EAEAEA] shadow-[0px_4px_14px_rgba(17,17,17,0.14)] ${
                        authorTooltipOpen ? "flex" : "hidden"
                      } flex-col cursor-default after:content-[''] after:absolute after:left-0 after:w-full`}
                    >
                      {/* Tooltip Tail */}
                      {isAuthorTop ? (
                        <div className="absolute -bottom-[8px] left-[24px] size-[16px] bg-white border-b border-r border-[#EAEAEA] rotate-45 pointer-events-none"></div>
                      ) : (
                        <div className="absolute -top-[8px] left-[24px] size-[16px] bg-white border-t border-l border-[#EAEAEA] rotate-45 pointer-events-none"></div>
                      )}
                      <div className="relative z-10 bg-white rounded-[16px] p-[12px] flex flex-col">
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-10 shrink-0 rounded-full flex items-center justify-center font-ui font-bold text-[16px] overflow-hidden ${
                              hasAvatar ? "bg-transparent" : "bg-[#3A76C4] text-white"
                            }`}
                          >
                            {hasAvatar ? (
                              <img
                                src={post.author!.avatarUrl!}
                                alt=""
                                className="size-full object-contain"
                                onError={() => setAvatarFailed(true)}
                              />
                            ) : (
                              authorInitial
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-editorial text-[14px] font-bold leading-none text-[#000000] truncate">
                              {post.author?.displayName?.trim() || "Editor"}
                            </span>
                            <span className="font-ui text-[10px] text-[#E5552D] leading-none mt-1">
                              {post.authorIsCreator ? "Featured Creator" : (post.circle?.name ?? "Community Member")}
                            </span>
                          </div>
                        </div>
                        <div className="border-t border-[#EAEAEA] mt-3 pt-3 flex items-center justify-between px-2">
                          <div className="flex flex-col items-center">
                            <span className="font-ui text-[12px] font-bold text-[#111111]">
                              {followerCount >= 1000 ? `${(followerCount / 1000).toFixed(1)}k` : followerCount}
                            </span>
                            <span className="font-ui text-[9px] font-bold uppercase tracking-wider text-[#737373]">FOLLOWERS</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-ui text-[12px] font-bold text-[#111111]">{post.upvoteCount}</span>
                            <span className="font-ui text-[9px] font-bold uppercase tracking-wider text-[#737373]">UPVOTES</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="font-ui text-[12px] font-bold text-[#111111]">{post.commentCount}</span>
                            <span className="font-ui text-[9px] font-bold uppercase tracking-wider text-[#737373]">COMMENTS</span>
                          </div>
                        </div>
                        {user?.id === post.author?.id ? (
                          <div className="bg-[#F0F0F0] text-[#737373] text-center rounded-[8px] py-2 mt-3 w-full font-ui text-[12px] font-bold">
                            You
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={followMutation.isPending || unfollowMutation.isPending}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!user) {
                                navigate("/login");
                                return;
                              }
                              if (!post.author?.id) return;
                              if (following) {
                                setFollowing(false);
                                setFollowerCount((c) => Math.max(0, c - 1));
                                unfollowMutation.mutate({ id: post.author.id }, {
                                  onError: () => {
                                    setFollowing(true);
                                    setFollowerCount((c) => c + 1);
                                  },
                                });
                              } else {
                                setFollowing(true);
                                setFollowerCount((c) => c + 1);
                                followMutation.mutate({ id: post.author.id }, {
                                  onError: () => {
                                    setFollowing(false);
                                    setFollowerCount((c) => Math.max(0, c - 1));
                                  },
                                });
                              }
                            }}
                            className={`rounded-[8px] py-2 mt-3 w-full font-ui text-[12px] font-bold transition-colors cursor-pointer ${
                              following
                                ? "border border-[#EAEAEA] text-[#737373] hover:border-red-300 hover:text-red-500 bg-white"
                                : "bg-[#E5552D] text-white hover:bg-[#D4441C]"
                            }`}
                          >
                            {following ? "Following" : "Follow"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </div>
      </div>
    </article>
  );
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
