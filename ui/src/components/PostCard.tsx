import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
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
    <article className="group break-inside-avoid overflow-hidden rounded-[16px] bg-white flex flex-col flex-1 min-h-[320px] h-full transition-shadow duration-300" style={{ boxShadow: '0px 4px 14px rgba(17, 17, 17, 0.14)' }}>
      {post.coverImageUrl ? (
        <button type="button" onClick={openPost} className="relative h-[158px] w-full shrink-0 cursor-pointer">
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
            <div className="absolute top-3 right-3 bg-[#00C365] text-white rounded-full px-2 py-0.5 text-[12px] font-medium font-ui flex items-center gap-1 shadow-sm">
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
            <div className="absolute bottom-3 left-3 bg-[#111111]/40 backdrop-blur-md text-white rounded-full px-2.5 py-[2px] text-[12px] font-medium font-ui flex items-center gap-1.5 shadow-sm">
              <span className="size-1.5 rounded-full bg-[#3CCBFF]"></span>
              {categoryLabel}
            </div>
          )}
        </button>
      ) : (
        <button type="button" onClick={openPost} className="relative h-[158px] w-full shrink-0 cursor-pointer bg-[#F9F9F9]">
          {/* Grey space matching image height perfectly to maintain card size parity */}
        </button>
      )}

      <div className="p-4 flex flex-col flex-1 gap-1">
        <p className="text-[10px] font-ui text-[#737373] flex items-center">
          {new Date(post.publishedAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          <span className="w-[3px] h-[3px] rounded-full bg-[#111111]/30 mx-1.5 block"></span> 
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
            prependNode={
              <div className="flex items-center">
                {post.source || post.origin === "aggregated" ? (
                  <div className="size-6 shrink-0 rounded-full bg-[#EAEAEA] text-[#737373] flex items-center justify-center">
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  </div>
                ) : post.author ? (
                  <div className="size-6 shrink-0 rounded-full bg-[#3A76C4] text-white flex items-center justify-center font-ui font-bold text-[10px] overflow-hidden">
                    {post.author.avatarUrl ? (
                      <img src={post.author.avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      post.author.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                ) : null}
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
