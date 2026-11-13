import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PostDrawer } from "../../components/PostDrawer";
import { customInstance } from "../../lib/api/http";
import {
  getListBookmarkFoldersQueryKey,
  useCreateBookmarkFolder,
  useDeleteBookmarkFolder,
  useListBookmarkFolders,
  useListBookmarks,
} from "../../lib/api/generated/engagement/engagement";
import type { PostCard as PostCardType } from "../../lib/api/generated/model";
import { BookmarkIcon } from "../../components/nav/icons";

type FilterTab = "all" | "posts" | "circles" | "creators" | "jobs";
type SortOption = "recent" | "title" | "popular";

export interface BookmarkFeedItem extends PostCardType {
  cardType?: "curated" | "everyday" | "post-job";
  badge?: "hot" | "pick";
  photoPill?: string;
  badgeLabel?: "POST" | "JOB" | "STORY" | "Everyday style";
  hasSavedBookmark?: boolean;
  metaTop?: string;
  collectionName?: string;
  savedTimeAgo?: string;
  authorText?: string;
  authorInitial?: string;
}

function createSamplePost(
  partial: Partial<BookmarkFeedItem> & {
    id: string;
    title: string;
    slug: string;
    coverImageUrl: string;
  },
): BookmarkFeedItem {
  return {
    origin: "native",
    status: "published",
    excerpt: "",
    externalUrl: null,
    author: null,
    source: null,
    circle: null,
    category: "fashion",
    subcategory: null,
    hashtags: ["fashion", "runway"],
    upvoteCount: 1200,
    commentCount: 48,
    bookmarkCount: 96,
    readTimeMinutes: 4,
    publishedAt: "2024-09-12T10:00:00Z",
    updatedAt: "2024-09-12T10:00:00Z",
    viewer: { bookmarked: true, voted: null },
    authorIsCreator: true,
    cardType: "curated",
    ...partial,
  };
}

// 9 Curated static posts matching the 3 Figma rows exactly (node 1637-3616)
const SAMPLE_BOOKMARK_POSTS: BookmarkFeedItem[] = [
  // ── ROW 1: Curated feed posts ──────────────────────────
  createSamplePost({
    id: "sample-bm-1",
    title: "The New Minimalist Runway: 5 Trends to Know Now",
    slug: "new-minimalist-runway-5-trends",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "curated",
    badge: "hot",
    authorInitial: "E",
    author: {
      id: "u-camille",
      displayName: "Camille Laurent",
      handle: "camille",
      avatarUrl: null,
    },
    publishedAt: "2024-09-12T10:00:00Z",
    readTimeMinutes: 4,
    upvoteCount: 1200,
    commentCount: 48,
  }),
  createSamplePost({
    id: "sample-bm-2",
    title: "Street Style: The 3 Handbag Trends Taking Over Paris",
    slug: "street-style-3-handbag-trends-paris",
    coverImageUrl:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "curated",
    photoPill: "Street Style",
    authorInitial: "🌐",
    author: {
      id: "u-sofia",
      displayName: "Sofia Rossi",
      handle: "sofiarossi",
      avatarUrl: null,
    },
    publishedAt: "2024-09-10T14:30:00Z",
    readTimeMinutes: 5,
    upvoteCount: 1200,
    commentCount: 48,
  }),
  createSamplePost({
    id: "sample-bm-3",
    title: "Knitwear 2.0: Why Layering Is the Season's Smartest Move",
    slug: "knitwear-2-why-layering-smartest-move",
    coverImageUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "curated",
    badge: "pick",
    photoPill: "Knitwear",
    authorInitial: "🌐",
    author: {
      id: "u-elena",
      displayName: "Elena Vance",
      handle: "elenavance",
      avatarUrl: null,
    },
    publishedAt: "2024-09-08T09:15:00Z",
    readTimeMinutes: 7,
    upvoteCount: 1200,
    commentCount: 48,
  }),

  // ── ROW 2: Everyday style collection posts ─────────────
  createSamplePost({
    id: "sample-bm-4",
    title: "The New Minimalist Runway: 5 Trends to Know Now",
    slug: "new-minimalist-runway-5-trends-everyday-1",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "everyday",
    badgeLabel: "Everyday style",
    collectionName: "Everyday style",
    authorInitial: "E",
    author: {
      id: "u-camille",
      displayName: "Camille Laurent",
      handle: "camille",
      avatarUrl: null,
    },
    publishedAt: "2024-09-12T10:00:00Z",
    readTimeMinutes: 4,
    upvoteCount: 1200,
    commentCount: 48,
  }),
  createSamplePost({
    id: "sample-bm-5",
    title: "The New Minimalist Runway: 5 Trends to Know Now",
    slug: "new-minimalist-runway-5-trends-everyday-2",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "everyday",
    badgeLabel: "Everyday style",
    collectionName: "Everyday style",
    authorInitial: "E",
    author: {
      id: "u-camille",
      displayName: "Camille Laurent",
      handle: "camille",
      avatarUrl: null,
    },
    publishedAt: "2024-09-12T10:00:00Z",
    readTimeMinutes: 4,
    upvoteCount: 1200,
    commentCount: 48,
  }),
  createSamplePost({
    id: "sample-bm-6",
    title: "The New Minimalist Runway: 5 Trends to Know Now",
    slug: "new-minimalist-runway-5-trends-everyday-3",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "everyday",
    badgeLabel: "Everyday style",
    collectionName: "Everyday style",
    authorInitial: "E",
    author: {
      id: "u-camille",
      displayName: "Camille Laurent",
      handle: "camille",
      avatarUrl: null,
    },
    publishedAt: "2024-09-12T10:00:00Z",
    readTimeMinutes: 4,
    upvoteCount: 1200,
    commentCount: 48,
  }),

  // ── ROW 3: Post or Job cards as provided in Figma ──────
  createSamplePost({
    id: "sample-bm-7",
    title: "A closer look at Shanghai's emerging designers",
    slug: "closer-look-shanghai-emerging-designers",
    coverImageUrl:
      "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    metaTop: "3 photos · Fashion",
    authorText: "By Lena Wu",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved yesterday",
  }),
  createSamplePost({
    id: "sample-bm-8",
    title: "Senior Fashion Editor",
    slug: "senior-fashion-editor-position",
    coverImageUrl:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
    category: "art",
    cardType: "post-job",
    badgeLabel: "JOB",
    hasSavedBookmark: true,
    metaTop: "Shanghai · Full-time",
    authorText: "By Centoire Careers",
    collectionName: "Career next steps",
    savedTimeAgo: "Saved 2 days ago",
  }),
  createSamplePost({
    id: "sample-bm-9",
    title: "The art of a perfectly tailored everyday wardrobe",
    slug: "art-perfect-tailored-everyday-wardrobe",
    coverImageUrl:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
    category: "lifestyle",
    cardType: "post-job",
    badgeLabel: "POST",
    hasSavedBookmark: true,
    metaTop: "Style notes · 6 photos",
    authorText: "By Sofia Kim",
    collectionName: "Everyday style",
    savedTimeAgo: "Saved 3 days ago",
  }),
];

// 8 Curated posts for Runway Inspiration collection detail view (Figma node 1637-4268)
const RUNWAY_COLLECTION_POSTS: BookmarkFeedItem[] = [
  createSamplePost({
    id: "runway-bm-1",
    title: "A closer look at Shanghai's emerging designers",
    slug: "closer-look-shanghai-emerging-designers",
    coverImageUrl:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    hasSavedBookmark: false,
    metaTop: "3 photos · Fashion",
    authorText: "By Lena Wu",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved yesterday",
  }),
  createSamplePost({
    id: "runway-bm-2",
    title: "The art of a perfectly tailored everyday wardrobe",
    slug: "art-perfect-tailored-everyday-wardrobe",
    coverImageUrl:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    hasSavedBookmark: false,
    metaTop: "Style notes · 4 photos",
    authorText: "By Sofia Kim",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved 3 days ago",
  }),
  createSamplePost({
    id: "runway-bm-3",
    title: "The Return of Quiet Luxury",
    slug: "the-return-of-quiet-luxury",
    coverImageUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    hasSavedBookmark: true,
    metaTop: "3 photos · Fashion",
    authorText: "By Camille Rose",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved 4 days ago",
  }),
  createSamplePost({
    id: "runway-bm-4",
    title: "Milan SS26: What We Loved",
    slug: "milan-ss26-what-we-loved",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    metaTop: "5 photos · Runway",
    authorText: "By Marco Vanni",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved 5 days ago",
  }),
  createSamplePost({
    id: "runway-bm-5",
    title: "Why Archival Fashion is the New Investment",
    slug: "why-archival-fashion-new-investment",
    coverImageUrl:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    metaTop: "Fashion analysis · 4 min read",
    authorText: "By Lena Grant",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved 6 days ago",
  }),
  createSamplePost({
    id: "runway-bm-6",
    title: "The New Minimalist Runway: 5 Trends to Know Now",
    slug: "new-minimalist-runway-5-trends",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    metaTop: "12 Sep 24 · 4 min read",
    authorText: "By Camille Laurent",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved 1 week ago",
  }),
  createSamplePost({
    id: "runway-bm-7",
    title: "Street Style: The 3 Handbag Trends Taking Over Paris",
    slug: "street-style-3-handbag-trends-paris",
    coverImageUrl:
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    metaTop: "10 Sep 24 · 5 min read",
    authorText: "By Sofia Rossi",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved 1 week ago",
  }),
  createSamplePost({
    id: "runway-bm-8",
    title: "Knitwear 2.0: Why Layering Is the Season's Smartest Move",
    slug: "knitwear-2-why-layering-smartest-move",
    coverImageUrl:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    metaTop: "08 Sep 24 · 7 min read",
    authorText: "By Chen Wei",
    collectionName: "Runway inspiration",
    savedTimeAgo: "Saved 2 weeks ago",
  }),
];

// 6 Curated sample items for New Collection page (Figma node 1637-3653 / 289-84178)
const CREATE_COLLECTION_SAMPLE_ITEMS: BookmarkFeedItem[] = [
  createSamplePost({
    id: "create-bm-1",
    title: "The New Minimalist Runway: 5 Trends to Know Now",
    slug: "new-minimalist-runway-5-trends",
    coverImageUrl:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "curated",
    badgeLabel: "STORY",
    authorText: "By Lena Wu · 4 min read",
    collectionName: "Runway inspiration",
  }),
  createSamplePost({
    id: "create-bm-2",
    title: "Street Style: The 3 Handbag Trends Taking Over Paris",
    slug: "street-style-3-handbag-trends-paris",
    coverImageUrl:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "curated",
    badgeLabel: "STORY",
    authorText: "By Camille Rose · 5 min read",
    collectionName: "Everyday style",
  }),
  createSamplePost({
    id: "create-bm-3",
    title: "Knitwear 2.0: Why Layering Is the Season's Smartest Move",
    slug: "knitwear-2-why-layering-smartest-move",
    coverImageUrl:
      "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "curated",
    badgeLabel: "STORY",
    authorText: "By Marcus Chen · 7 min read",
    collectionName: "Everyday style",
  }),
  createSamplePost({
    id: "create-bm-4",
    title: "A closer look at Shanghai's emerging designers",
    slug: "closer-look-shanghai-emerging-designers",
    coverImageUrl:
      "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    authorText: "By Lena Wu · 3 photos",
    collectionName: "Runway inspiration",
  }),
  createSamplePost({
    id: "create-bm-5",
    title: "Senior Fashion Editor",
    slug: "senior-fashion-editor-position",
    coverImageUrl:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
    category: "art",
    cardType: "post-job",
    badgeLabel: "JOB",
    authorText: "Shanghai · Full-time",
    collectionName: "Career next steps",
  }),
  createSamplePost({
    id: "create-bm-6",
    title: "The art of a perfectly tailored everyday wardrobe",
    slug: "art-perfect-tailored-everyday-wardrobe",
    coverImageUrl:
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80",
    category: "fashion",
    cardType: "post-job",
    badgeLabel: "POST",
    authorText: "By Sofia Kim · 6 photos",
    collectionName: "Everyday style",
  }),
];

// Curated collection covers from Figma
const DEFAULT_COLLECTIONS = [
  {
    id: "def-runway",
    name: "Runway inspiration",
    count: 8,
    coverUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "def-everyday",
    name: "Everyday style",
    count: 10,
    coverUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "def-career",
    name: "Career next steps",
    count: 6,
    coverUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
  },
];

function BookmarkGridCard({
  post,
  onOpen,
}: {
  post: BookmarkFeedItem;
  onOpen: () => void;
}) {
  const isEverydayRow = post.cardType === "everyday";
  const isPostJobRow = post.cardType === "post-job";
  const isFirstRow = !isEverydayRow && !isPostJobRow;
  const [imgSrc, setImgSrc] = useState(post.coverImageUrl ?? "");

  return (
    <article
      onClick={onOpen}
      className={`group relative break-inside-avoid rounded-[16px] bg-white flex flex-col w-full transition-shadow duration-300 hover:shadow-[0px_6px_18px_rgba(17,17,17,0.18)] hover:-translate-y-0.5 overflow-hidden cursor-pointer ${
        isEverydayRow ? "min-h-[381px]" : "min-h-[342px]"
      }`}
      style={{ boxShadow: "0px 4px 10px 1px rgba(17, 17, 17, 0.10)" }}
    >
      {/* ── PHOTO CONTAINER (Feed Page: 158px height) ───────────────── */}
      <div className="relative h-[158px] w-full shrink-0 overflow-hidden bg-[#F2EDE4]">
        <img
          src={imgSrc}
          alt=""
          onError={() => {
            setImgSrc(
              "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
            );
          }}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* ROW 1 BADGES (Exact from Feed Page PostCard.tsx) */}
        {isFirstRow && (
          <>
            {post.badge === "hot" && (
              <div className="absolute top-2 right-2 bg-[#00C365] text-white rounded-full px-2.5 py-0.5 text-[11px] font-medium font-ui flex items-center gap-1 shadow-sm">
                <svg
                  className="size-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
                <span>Hot</span>
              </div>
            )}
            {post.badge === "pick" && (
              <div className="absolute top-2 right-2 bg-[#00C365] text-white rounded-full px-2.5 py-0.5 text-[11px] font-medium font-ui flex items-center gap-1 shadow-sm">
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                <span>Centoire Pick</span>
              </div>
            )}
            {post.photoPill && (
              <div className="absolute bottom-2.5 left-2.5 bg-[#111111]/40 backdrop-blur-md text-white rounded-full px-2.5 py-[2px] text-[11px] font-medium font-ui flex items-center gap-1.5 shadow-sm">
                <span className="size-1.5 rounded-full bg-[#3CCBFF]" />
                <span>{post.photoPill}</span>
              </div>
            )}
          </>
        )}

        {/* ROW 2: Everyday style Content badge */}
        {isEverydayRow && (
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white text-[#111111] text-[11px] font-ui font-medium shadow-[0_0_5px_rgba(0,0,0,0.15)] flex items-center gap-1">
            <span>Everyday style</span>
          </div>
        )}

        {/* ROW 3: POST / JOB Badge with rounded-full edges & optional top-right bookmark-check */}
        {isPostJobRow && (
          <>
            <div className="absolute top-2.5 left-2.5 px-3 py-1 rounded-full bg-white text-[#111111] font-ui text-[11px] font-bold uppercase tracking-wider shadow-xs">
              {post.badgeLabel ?? "POST"}
            </div>
            {post.hasSavedBookmark && (
              <div className="absolute top-2.5 right-2.5 size-[30px] rounded-[8px] bg-white shadow-xs flex items-center justify-center">
                <svg
                  className="w-[12px] h-[15px] text-[#E4572E]"
                  viewBox="0 0 12 15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 1.5A1 1 0 012 .5h8a1 1 0 011 1v13l-5-2.5L1 14.5v-13z" />
                  <path d="M4 6.5l1.5 1.5 3-3" />
                </svg>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── CARD BODY (Figma item details: padding 12px, gap 10px) ───── */}
      <div className="p-3 flex flex-col flex-1">
        {/* TOP CONTENT: Date & Title */}
        <div>
          <p className="font-ui text-[12px] text-[#737373] leading-none">
            {post.metaTop ??
              `${post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "2-digit",
              }) : "12 Sep 24"} · ${post.readTimeMinutes ?? 4} min read`}
          </p>

          <h3 className={`font-editorial text-[20px] font-medium leading-[26px] text-[#111111] mt-1.5 line-clamp-3 ${
            isPostJobRow ? "min-h-[52px]" : "h-[78px]"
          } group-hover:text-[#E4572E] transition-colors`}>
            {post.title}
          </h3>
        </div>

        {/* BOTTOM CONTENT */}
        {isPostJobRow ? (
          /* ROW 3: By Lena Wu -> HR line -> Runway inspiration -> Saved yesterday */
          <div className="mt-auto flex flex-col">
            {post.authorText && (
              <p className="font-ui text-[12px] text-[#737373] leading-none mb-2">
                {post.authorText}
              </p>
            )}
            <hr className="border-0 h-px bg-[#111111]/10 my-2" />
            <div className="flex items-center gap-1.5 font-ui text-[12px] text-[#777777] leading-none">
              <svg className="w-[14px] h-[12px] text-[#777777] shrink-0" fill="none" viewBox="0 0 16 14" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 3.5A1.5 1.5 0 013 2h3.2a1.5 1.5 0 011.06.44l1.1 1.1A1.5 1.5 0 009.42 4H13A1.5 1.5 0 0114.5 5.5v6A1.5 1.5 0 0113 13H3A1.5 1.5 0 011.5 11.5v-8z" />
              </svg>
              <span>{post.collectionName ?? "Runway inspiration"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-ui text-[11px] text-[#737373]">
                {post.savedTimeAgo ?? "Saved recently"}
              </span>
              <svg
                onClick={(e) => e.stopPropagation()}
                className="size-4 text-[#737373] hover:text-[#111111] cursor-pointer transition-colors"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            </div>
          </div>
        ) : isEverydayRow ? (
          /* ROW 2: Everyday style sticked to bottom with hr above and hr below + filled bookmark */
          <div className="mt-auto flex flex-col">
            <hr className="border-0 h-px bg-[#111111]/10 my-2" />
            <div className="flex items-center gap-1.5 font-ui text-[12px] text-[#777777] leading-none px-0.5">
              <svg className="w-[14px] h-[12px] text-[#777777] shrink-0" fill="none" viewBox="0 0 16 14" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 3.5A1.5 1.5 0 013 2h3.2a1.5 1.5 0 011.06.44l1.1 1.1A1.5 1.5 0 009.42 4H13A1.5 1.5 0 0114.5 5.5v6A1.5 1.5 0 0113 13H3A1.5 1.5 0 011.5 11.5v-8z" />
              </svg>
              <span>{post.collectionName ?? "Everyday style"}</span>
            </div>
            <hr className="border-0 h-px bg-[#111111]/10 my-2" />
            <div className="flex items-center justify-between">
              {/* Left side actions from feed */}
              <div className="flex items-center gap-2.5">
                <div className="size-6 rounded-full bg-[#206095] text-white flex items-center justify-center font-ui text-[11px] font-bold">
                  {post.authorInitial ?? "E"}
                </div>
                <div className="flex items-center gap-1 font-ui text-[13px] font-semibold text-[#111111]/60">
                  <svg className="size-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 11l7-7m0 0l7 7m-7-7v16" />
                  </svg>
                  <span>1.2k</span>
                </div>
                <div className="flex items-center gap-1 font-ui text-[13px] font-semibold text-[#111111]/60">
                  <svg className="size-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span>48</span>
                </div>
              </div>

              {/* Right side: Three dot & FILLED bookmark icon matching Figma node 1637-4149 */}
              <div className="relative ml-auto flex items-center gap-2 text-[#111111]/60">
                <div className="relative flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Why am I seeing this post?"
                    title="Why am I seeing this?"
                    onClick={(e) => e.stopPropagation()}
                    className="size-6 rounded-full flex items-center justify-center text-[#737373] hover:text-[#111111] hover:bg-black/5 transition-colors cursor-pointer"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <svg
                    onClick={(e) => e.stopPropagation()}
                    className="size-4 cursor-pointer hover:text-[#111111] transition-colors"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </div>
                <div className="border border-[#EAEAEA] rounded-[8px] p-1 cursor-pointer hover:bg-black/5 transition-colors">
                  <button
                    type="button"
                    title="Saved"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center transition-colors text-[#111111]/60 hover:text-[#111111]"
                  >
                    <svg className="size-4 fill-current" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ROW 1: Exact layout, padding & icons from Feed Page PostCard.tsx */
          <div className="mt-auto pt-3 flex items-center justify-between border-t border-[#EAEAEA] border-opacity-60">
            {/* Left side actions from feed */}
            <div className="flex items-center gap-2.5">
              {post.authorInitial === "🌐" ? (
                <div className="size-6 shrink-0 rounded-full bg-[#EAEAEA] text-[#111111]/60 flex items-center justify-center">
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
              ) : (
                <div className="size-6 rounded-full bg-[#206095] text-white flex items-center justify-center font-ui text-[11px] font-bold">
                  {post.authorInitial ?? "E"}
                </div>
              )}
              <div className="flex items-center gap-1 font-ui text-[13px] font-semibold text-[#111111]/60">
                <svg className="size-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 11l7-7m0 0l7 7m-7-7v16" />
                </svg>
                <span>1.2k</span>
              </div>
              <div className="flex items-center gap-1 font-ui text-[13px] font-semibold text-[#111111]/60">
                <svg className="size-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>48</span>
              </div>
            </div>

            {/* Right side: Three dot & bookmark section copied exactly from feed with grey color kept */}
            <div className="relative ml-auto flex items-center gap-2 text-[#111111]/60">
              <div className="relative flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Why am I seeing this post?"
                  title="Why am I seeing this?"
                  onClick={(e) => e.stopPropagation()}
                  className="size-6 rounded-full flex items-center justify-center text-[#737373] hover:text-[#111111] hover:bg-black/5 transition-colors cursor-pointer"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <svg
                  onClick={(e) => e.stopPropagation()}
                  className="size-4 cursor-pointer hover:text-[#111111] transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              </div>
              <div className="border border-[#EAEAEA] rounded-[8px] p-1 cursor-pointer hover:bg-black/5 transition-colors">
                <button
                  type="button"
                  title="Saved"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center transition-colors text-[#111111]/60 hover:text-[#111111]"
                >
                  <svg className="size-4 fill-current" viewBox="0 0 24 24">
                    <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function BookmarksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Determine if URL is /bookmarks/new
  const isNewUrl = location.pathname === "/bookmarks/new";

  // Navigation & view states
  const [isCreatingNewCollection, setIsCreatingNewCollection] = useState(isNewUrl);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [visibleCount, setVisibleCount] = useState(9);

  // Dropdown states
  const [collectionsDropdownOpen, setCollectionsDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // New collection page form states
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [modalSearch, setModalSearch] = useState("");
  const [modalTab, setModalTab] = useState<"all" | "posts" | "circles" | "jobs">("all");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    new Set(["create-bm-1", "create-bm-2", "create-bm-6"]),
  );
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);

  // References for dropdown click-outside
  const collectionsDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Keep route synced with view
  useEffect(() => {
    if (location.pathname === "/bookmarks/new") {
      setIsCreatingNewCollection(true);
    } else {
      setIsCreatingNewCollection(false);
    }
  }, [location.pathname]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        collectionsDropdownRef.current &&
        !collectionsDropdownRef.current.contains(e.target as Node)
      ) {
        setCollectionsDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch folders and bookmarks from backend
  const { data: folderData } = useListBookmarkFolders();
  const { data: rawBookmarks, isLoading: isLoadingBookmarks } = useListBookmarks(
    activeFolderId && !activeFolderId.startsWith("def-") ? { folderId: activeFolderId } : undefined,
  );
  const { data: allBookmarksRaw } = useListBookmarks(undefined);

  // Combine real folders from DB with Figma default collections
  const userFolders = folderData?.folders ?? [];
  const folders = useMemo(() => {
    const list = [...DEFAULT_COLLECTIONS];
    for (const uf of userFolders) {
      if (!list.some((d) => d.name.toLowerCase() === uf.name.toLowerCase())) {
        list.push({
          id: uf.id,
          name: uf.name,
          count: uf.count,
          coverUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80",
        });
      }
    }
    return list;
  }, [userFolders]);

  const activeFolder = useMemo(
    () => (activeFolderId ? folders.find((f) => f.id === activeFolderId) ?? null : null),
    [activeFolderId, folders],
  );

  // Combine real bookmarks with curated sample bookmarks
  const allBookmarks = useMemo(() => {
    const real = allBookmarksRaw ?? [];
    if (real.length === 0) return SAMPLE_BOOKMARK_POSTS;
    // Prepend real bookmarks and fill with sample bookmarks
    const combined = [...real];
    for (const s of SAMPLE_BOOKMARK_POSTS) {
      if (!combined.some((p) => p.id === s.id || p.slug === s.slug)) {
        combined.push(s);
      }
    }
    return combined;
  }, [allBookmarksRaw]);

  const activeBookmarksList = useMemo(() => {
    const real = rawBookmarks ?? [];
    if (activeFolderId === "def-everyday") return [];
    if (activeFolderId === "def-career") {
      return allBookmarks.filter((p) => p.category === "art" || p.source?.name?.includes("Career"));
    }
    if (activeFolderId === "def-runway") {
      return RUNWAY_COLLECTION_POSTS;
    }
    if (real.length === 0 && !activeFolderId) return allBookmarks;
    if (real.length === 0 && activeFolderId) return [];
    return real;
  }, [rawBookmarks, activeFolderId, allBookmarks]);

  // Refresh queries helper
  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: getListBookmarkFoldersQueryKey() });
    void queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("/bookmarks"),
    });
  }

  // Folder mutations
  const createFolder = useCreateBookmarkFolder();
  const deleteFolder = useDeleteBookmarkFolder({
    mutation: {
      onSuccess: () => {
        setActiveFolderId(null);
        refreshAll();
      },
    },
  });

  // Handle creating new collection from the full page
  async function handleCreateCollection(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (!trimmed || isSubmittingCollection) return;

    setIsSubmittingCollection(true);
    try {
      const created = await createFolder.mutateAsync({ data: { name: trimmed } });
      const newFolderId = created.id;

      // Assign selected items to this folder
      if (selectedItemIds.size > 0 && newFolderId) {
        const promises = Array.from(selectedItemIds)
          .filter((id) => !id.startsWith("sample-"))
          .map((postId) =>
            customInstance({
              url: `/posts/${postId}/bookmark`,
              method: "POST",
              data: { folderId: newFolderId },
            }),
          );
        await Promise.allSettled(promises);
      }

      // Reset form
      setNewCollectionName("");
      setNewCollectionDesc("");
      setSelectedItemIds(new Set());
      setModalSearch("");
      setIsCreatingNewCollection(false);
      navigate("/bookmarks");

      refreshAll();
      if (newFolderId) {
        setActiveFolderId(newFolderId);
      }
    } catch {
      // Allow retry
    } finally {
      setIsSubmittingCollection(false);
    }
  }

  // Filter & Search bookmarks
  const filteredBookmarks = useMemo(() => {
    let list = [...activeBookmarksList];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const title = (p.title ?? "").toLowerCase();
        const excerpt = (p.excerpt ?? "").toLowerCase();
        const author = (p.author?.displayName ?? "").toLowerCase();
        const source = (p.source?.name ?? "").toLowerCase();
        return title.includes(q) || excerpt.includes(q) || author.includes(q) || source.includes(q);
      });
    }

    // Tab filter (only applies to All Bookmarks overview, not within a collection)
    if (!activeFolder) {
      if (activeTab === "posts") {
        list = list.filter((p) => p.category !== "art" && !p.source?.name?.includes("Career"));
      } else if (activeTab === "jobs") {
        list = list.filter((p) => p.source?.name?.includes("Career"));
      } else if (activeTab === "creators") {
        list = list.filter((p) => Boolean(p.author));
      } else if (activeTab === "circles") {
        list = [];
      }
    }

    // Sort order
    if (sortBy === "title") {
      list.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    } else if (sortBy === "popular") {
      list.sort((a, b) => (b.upvoteCount ?? 0) - (a.upvoteCount ?? 0));
    }

    return list;
  }, [activeBookmarksList, searchQuery, activeTab, sortBy, activeFolder]);

  // Items for the New Collection Page selectable grid
  const selectableItems = useMemo(() => {
    let list = [...CREATE_COLLECTION_SAMPLE_ITEMS];
    if (modalSearch.trim()) {
      const q = modalSearch.toLowerCase().trim();
      list = list.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(q) ||
          (p.authorText ?? "").toLowerCase().includes(q),
      );
    }
    if (modalTab === "posts") {
      list = list.filter((p) => p.badgeLabel === "POST" || p.badgeLabel === "STORY");
    } else if (modalTab === "jobs") {
      list = list.filter((p) => p.badgeLabel === "JOB");
    } else if (modalTab === "circles") {
      list = [];
    }
    return list;
  }, [modalSearch, modalTab]);

  const totalBookmarksCount = allBookmarks.length;

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW 1: NEW COLLECTION FULL PAGE (Figma Screenshot 3 / node 1637-3621)
  // ═════════════════════════════════════════════════════════════════════════
  if (isCreatingNewCollection) {
    return (
      <div className="w-full min-h-[calc(100vh-3.5rem)] bg-[#EFEFEF]">
        {/* Full width responsive workspace extending on big screens */}
        <div className="w-full px-4 py-7 sm:px-6 min-h-[calc(100vh-3.5rem)] flex flex-col justify-between">
          <div>
            {/* Back button (Figma node 1637-3620 / 1637-3621: 9.33px arrow, text 12px #777777) */}
            <button
              type="button"
              onClick={() => {
                setIsCreatingNewCollection(false);
                navigate("/bookmarks");
              }}
              className="mb-3 inline-flex items-center gap-2 font-ui text-[12px] font-normal text-[#777777] hover:text-[#111111] leading-none transition-colors cursor-pointer"
            >
              <svg
                className="size-4 text-[#777777] shrink-0"
                fill="none"
                viewBox="0 0 16 16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 8H3M7 4L3 8L7 12" />
              </svg>
              <span>Back to Bookmarks</span>
            </button>

            {/* Page Header (Figma node 1637-3623 & 1637-3624) */}
            <div className="mb-6">
              <h1 className="font-editorial text-[32px] font-normal text-[#111111] leading-[40px] tracking-normal">
                New collection
              </h1>
              <p className="mt-2 font-ui text-[14px] font-normal text-[#111111] leading-[22px] tracking-normal">
                A place for the stories, posts, and opportunities you want to come back to.
              </p>
            </div>

            {/* CARD 1: COLLECTION DETAILS (Extended width on big screens) */}
            <div className="w-full rounded-[16px] border border-[#E5E5E5] bg-white p-[24px] shadow-2xs mb-6">
              <p className="font-ui text-[14px] font-semibold text-[#111111] leading-none mb-5">
                COLLECTION DETAILS
              </p>

              <div className="space-y-4">
                {/* Collection Name (Figma node 1637-3629, 1637-3630, 1637-3631: red asterisk) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-ui text-[14px] font-semibold text-[#111111] leading-none">
                      Collection name <span className="text-[#E4572E]">*</span>
                    </label>
                    <span className="font-ui text-[12px] font-normal text-[#777777] leading-none">
                      {newCollectionName.length} / 60
                    </span>
                  </div>
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={60}
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Modern wardrobe"
                    className="w-full h-[46px] rounded-[8px] border border-[#111111]/20 bg-white px-[16px] py-[13px] font-ui text-[14px] text-[#111111] placeholder:text-[#777777] focus:border-[#E4572E] focus:outline-none transition-colors"
                  />
                </div>

                {/* Description (Figma node 1637-3637) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-ui text-[14px] font-semibold text-[#111111] leading-none">
                      Description <span className="text-[#777777] font-normal">(optional)</span>
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={160}
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Fresh perspectives on minimalism, thoughtful details, and everyday dressing."
                    className="w-full h-[86px] rounded-[8px] border border-[#111111]/20 bg-white p-[16px] font-ui text-[14px] leading-[22px] text-[#111111] placeholder:text-[#777777] focus:border-[#E4572E] focus:outline-none transition-colors resize-none"
                  />
                </div>

                {/* Privacy note - No tick button, informational note only (Figma node 1637-3642: lock-keyhole icon) */}
                <div className="flex items-center gap-1.5 font-ui text-[12px] font-normal leading-[18px] text-[#777777] pt-0.5">
                  <svg
                    className="w-[14px] h-[14px] text-[#777777] shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="16" r="1" />
                    <rect x="3" y="10" width="18" height="12" rx="2" />
                    <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                  </svg>
                  <span>Private collection. Only you can see what’s inside.</span>
                </div>
              </div>
            </div>

            {/* CARD 2: ADD SAVED ITEMS (Extended width on big screens) */}
            <div className="w-full rounded-[16px] border border-[#E5E5E5] bg-white p-[24px] shadow-2xs mb-6">
              <div className="flex items-center justify-between mb-1">
                <p className="font-ui text-[14px] font-semibold text-[#111111] leading-none">
                  ADD SAVED ITEMS
                </p>
                {selectedItemIds.size > 0 && (
                  <span className="font-ui text-[12px] font-medium text-[#E4572E] bg-[#E4572E]/10 rounded-full px-3 py-1 leading-none">
                    {selectedItemIds.size} selected
                  </span>
                )}
              </div>

              <p className="font-ui text-[12px] text-[#777777] mb-4">
                Choose from your bookmarks, or add items later.
              </p>

              {/* Search in saved items (Figma node 1637-3650, 1637-3652, 1637-3653: 44px, rounded-full, 13.5px icon, 14px text) */}
              <div className="relative mb-4 w-full h-[44px]">
                <svg
                  className="absolute left-[16px] top-1/2 -translate-y-1/2 w-[13.5px] h-[13.5px] text-[#777777] pointer-events-none"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11l3.5 3.5" />
                </svg>
                <input
                  type="search"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder="Search your bookmarks"
                  className="w-full h-[44px] rounded-full border border-[#111111]/20 bg-white pl-[42px] pr-4 font-ui text-[14px] text-[#111111] placeholder:text-[#777777] focus:border-[#E4572E] focus:outline-none transition-colors"
                />
              </div>

              {/* Pill tabs row (Figma node 1637-3657 & 1637-3664) */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalTab("all")}
                    className={`inline-flex items-center justify-center h-[31px] px-[14px] py-[8px] rounded-full font-ui text-[12px] font-semibold leading-none cursor-pointer transition-all ${
                      modalTab === "all"
                        ? "bg-[#E4572E] text-white border border-[#E4572E]"
                        : "border border-[#111111]/20 bg-white text-[#777777] hover:border-[#111111]/40"
                    }`}
                  >
                    ALL 24
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("posts")}
                    className={`inline-flex items-center justify-center h-[31px] px-[14px] py-[8px] rounded-full font-ui text-[12px] font-semibold leading-none cursor-pointer transition-all ${
                      modalTab === "posts"
                        ? "bg-[#E4572E] text-white border border-[#E4572E]"
                        : "border border-[#111111]/20 bg-white text-[#777777] hover:border-[#111111]/40"
                    }`}
                  >
                    POSTS 12
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("circles")}
                    className={`inline-flex items-center justify-center h-[31px] px-[14px] py-[8px] rounded-full font-ui text-[12px] font-semibold leading-none cursor-pointer transition-all ${
                      modalTab === "circles"
                        ? "bg-[#E4572E] text-white border border-[#E4572E]"
                        : "border border-[#111111]/20 bg-white text-[#777777] hover:border-[#111111]/40"
                    }`}
                  >
                    CIRCLES 8
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab("jobs")}
                    className={`inline-flex items-center justify-center h-[31px] px-[14px] py-[8px] rounded-full font-ui text-[12px] font-semibold leading-none cursor-pointer transition-all ${
                      modalTab === "jobs"
                        ? "bg-[#E4572E] text-white border border-[#E4572E]"
                        : "border border-[#111111]/20 bg-white text-[#777777] hover:border-[#111111]/40"
                    }`}
                  >
                    JOBS 4
                  </button>
                </div>

                {selectedItemIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds(new Set())}
                    className="font-ui text-[12px] font-medium text-[#E4572E] hover:underline cursor-pointer leading-none"
                  >
                    Clear selection
                  </button>
                )}
              </div>

              {/* Selectable Cards Grid: responsive auto-fill so boxes don't expand and below boxes flow above */}
              <div
                className="grid gap-5 py-1"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(271px, 1fr))" }}
              >
                {selectableItems.map((rawPost, idx) => {
                  const post = rawPost as BookmarkFeedItem;
                  const isChecked = selectedItemIds.has(post.id);
                  const isJob = post.badgeLabel === "JOB" || post.source?.name?.includes("Career");
                  const badgeText = post.badgeLabel ?? (isJob ? "JOB" : idx < 3 ? "STORY" : "POST");
                  const author = post.authorText ?? post.author?.displayName ?? "Lena Wu";
                  const folder = post.collectionName ?? (idx % 2 === 0 ? "Runway inspiration" : "Everyday style");

                  return (
                    <div
                      key={post.id}
                      onClick={() => {
                        setSelectedItemIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(post.id)) next.delete(post.id);
                          else next.add(post.id);
                          return next;
                        });
                      }}
                      className={`group relative flex flex-col justify-between rounded-[12px] border-[1.5px] bg-white overflow-hidden transition-all cursor-pointer select-none ${
                        isChecked
                          ? "border-[#E4572E] shadow-2xs"
                          : "border-[#111111]/15 hover:border-[#111111]/30"
                      }`}
                    >
                      {/* Item cover (Figma node 1637-3669: 271px x 118px) */}
                      <div className="relative w-full h-[118px] shrink-0 overflow-hidden bg-[#F2EDE4]">
                        {post.coverImageUrl ? (
                          <img
                            src={post.coverImageUrl}
                            alt=""
                            className="size-full object-cover transition-transform duration-300 group-hover:scale-102"
                          />
                        ) : null}

                        {/* Top-left Content badge (Figma node 1637-3670: 50x23, rounded-full, px 8, py 5, text 10px bold #111111) */}
                        <div className="absolute top-[10px] left-[10px]">
                          <span className="inline-flex items-center justify-center h-[23px] px-[8px] py-[5px] rounded-full bg-white font-ui text-[10px] font-bold leading-none tracking-normal text-[#111111] uppercase">
                            {badgeText}
                          </span>
                        </div>

                        {/* Top-right Selection checkbox (Figma node 1637-3672 / 1637-3702: 24x24, 6px radius, 1px border) */}
                        <div className="absolute top-[10px] right-[10px]">
                          {isChecked ? (
                            <div className="size-[24px] rounded-[6px] bg-[#E4572E] border border-[#E4572E] text-white flex items-center justify-center">
                              <svg className="size-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="size-[24px] rounded-[6px] border border-[#111111]/20 bg-white" />
                          )}
                        </div>
                      </div>

                      {/* Item details (Figma node 1637-3675: padding 12px, gap 8px) */}
                      <div className="p-[12px] flex flex-col gap-[8px] flex-1 justify-between">
                        <div className="flex flex-col gap-[8px]">
                          {/* Title (Figma node 1637-3676: Playfair Display 18px/22px, min-h 66px) */}
                          <h3 className="font-editorial text-[18px] font-normal text-[#111111] leading-[22px] min-h-[66px] line-clamp-3 group-hover:text-[#E4572E] transition-colors">
                            {post.title}
                          </h3>
                          {/* Byline (Figma node: 12px #777777) */}
                          <p className="font-ui text-[12px] text-[#777777] leading-none">
                            {author}
                          </p>
                        </div>

                        {/* Existing collection (Figma node: folder icon + 12px #777777) */}
                        <div className="flex items-center gap-1.5 font-ui text-[12px] text-[#777777] leading-none pt-1">
                          <svg className="w-[14px] h-[12px] text-[#777777] shrink-0" fill="none" viewBox="0 0 16 14" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 3.5A1.5 1.5 0 013 2h3.2a1.5 1.5 0 011.06.44l1.1 1.1A1.5 1.5 0 009.42 4H13A1.5 1.5 0 0114.5 5.5v6A1.5 1.5 0 0113 13H3A1.5 1.5 0 011.5 11.5v-8z" />
                          </svg>
                          <span>{folder}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* More bookmarks row (Figma node 1637-3754 & 1637-3755 / 289-84178) */}
              <div className="mt-6 flex items-center justify-between">
                <p className="font-ui text-[12px] text-[#777777] leading-none">
                  Showing 6 of 24 bookmarks
                </p>
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-[44px] px-[20px] py-[12px] rounded-full border border-[#111111]/20 bg-white hover:border-[#111111]/40 font-ui text-[14px] font-semibold text-[#111111] leading-none transition-colors cursor-pointer"
                >
                  Load more bookmarks
                </button>
              </div>
            </div>

            {/* CREATE COLLECTION ACTIONS (Figma node 289-84178) */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-ui text-[14px] font-semibold text-[#111111] leading-none">
                  {selectedItemIds.size} items selected
                </p>
                <p className="font-ui text-[12px] text-[#777777] leading-none mt-1.5">
                  You can add or remove items anytime.
                </p>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewCollection(false);
                    navigate("/bookmarks");
                  }}
                  className="inline-flex items-center justify-center h-[44px] px-[24px] rounded-full border border-[#111111]/20 bg-white hover:border-[#111111]/40 font-ui text-[14px] font-semibold text-[#111111] leading-none transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!newCollectionName.trim() || isSubmittingCollection}
                  onClick={() => void handleCreateCollection()}
                  className="inline-flex items-center justify-center h-[44px] px-[24px] rounded-full bg-[#E4572E] hover:bg-[#d04b24] font-ui text-[14px] font-semibold text-white leading-none transition-colors disabled:opacity-50 cursor-pointer shadow-none"
                >
                  {isSubmittingCollection ? "Creating..." : "Create collection"}
                </button>
              </div>
            </div>
          </div>

          {/* DIVIDER & FOOTER (Figma node 289-84178) */}
          <div className="mt-10">
            <div className="border-t border-[#111111]/10" />
            <div className="pt-6 pb-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[#777777]">
              <p className="font-ui text-[12px] leading-none">
                Only you can see your bookmarks.
              </p>
              <div className="flex items-center gap-6 font-ui text-[11px] font-medium tracking-wider">
                <Link to="/discover" className="hover:text-[#111111] transition-colors">
                  ABOUT
                </Link>
                <Link to="/support" className="hover:text-[#111111] transition-colors">
                  CONTACT
                </Link>
                <a href="#privacy" className="hover:text-[#111111] transition-colors">
                  PRIVACY
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VIEW 2: BOOKMARK LIBRARY & COLLECTION DETAIL VIEW (Figma Screenshot 1)
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-[#EFEFEF]">
      {/* Full width responsive workspace extending on big screens */}
      <div className="w-full px-4 py-7 sm:px-6 min-h-[calc(100vh-3.5rem)] flex flex-col justify-between">
        <div>
          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* VIEW A: COLLECTION DETAIL VIEW (Figma node 1637-4268)              */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {activeFolder ? (
            <div className="w-full">
              {/* Breadcrumb: Bookmarks / Collection Name (Figma node 1637-3254) */}
              <nav className="mb-4 flex items-center gap-2 font-ui text-[14px] leading-none">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFolderId(null);
                    setSearchQuery("");
                  }}
                  className="font-semibold text-[#111111]/60 hover:text-[#111111] transition-colors cursor-pointer"
                >
                  Bookmarks
                </button>
                <span className="text-[#111111]/60">/</span>
                <span className="text-[#111111] font-semibold">{activeFolder.name}</span>
              </nav>

              {/* Collection Header: Title + Subtitle + Action (Figma node 1637-3260 & 1637-3262) */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="font-editorial text-[32px] font-normal text-[#111111] leading-none tracking-normal">
                    {activeFolder.name}
                  </h1>
                  <p className="mt-2 font-ui text-[14px] font-medium text-[#111111] leading-none tracking-normal">
                    {activeFolder.count} saved posts · Your personal edit
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCollectionName(activeFolder.name);
                      setIsCreatingNewCollection(true);
                      navigate("/bookmarks/new");
                    }}
                    className="inline-flex items-center justify-center h-[40px] px-6 rounded-full bg-[#E4572E] hover:bg-[#d04b24] text-white font-ui text-[14px] font-semibold transition-colors shrink-0 cursor-pointer shadow-none"
                  >
                    Edit collection
                  </button>

                  {!activeFolder.id.startsWith("def-") && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete collection "${activeFolder.name}"? Saved posts will remain in All Bookmarks.`,
                          )
                        ) {
                          deleteFolder.mutate({ id: activeFolder.id });
                        }
                      }}
                      disabled={deleteFolder.isPending}
                      className="flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-3.5 py-1.5 font-ui text-xs font-medium text-[#737373] hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar: Full width within 892px */}
              <div className="relative mb-5 w-full h-[44px]">
                <svg
                  className="absolute left-[16px] top-1/2 -translate-y-1/2 w-[13.5px] h-[13.5px] text-[#777777] pointer-events-none"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11l3.5 3.5" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search this collection"
                  className="w-full h-[44px] rounded-full border border-[#111111]/15 bg-white pl-[40px] pr-[18px] font-ui text-[14px] font-normal text-[#111111] placeholder:text-[#777777] shadow-2xs focus:border-[#E4572E] focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-black/5 flex items-center justify-center text-xs text-[#737373] hover:text-[#111111]"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Filter & Sort Bar: POSTS · 8 on left, RECENTLY SAVED ⌄ on right (Figma node 1637-3273) */}
              <div className="mb-6 flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex items-center justify-center h-[34px] px-[16px] rounded-full bg-[#E4572E] text-white font-ui text-[14px] font-bold uppercase tracking-[0.05em] shrink-0"
                >
                  POSTS · {activeFolder.count}
                </button>

                <div className="relative" ref={sortDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setSortDropdownOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 h-[34px] px-4 rounded-full border border-[#111111]/15 bg-white hover:border-[#111111]/40 font-ui text-[14px] font-semibold text-[#777777] uppercase tracking-[0.05em] transition-all cursor-pointer shadow-2xs"
                  >
                    <span>
                      {sortBy === "recent"
                        ? "RECENTLY SAVED"
                        : sortBy === "title"
                        ? "TITLE (A-Z)"
                        : "MOST UPVOTED"}
                    </span>
                    <svg
                      className="w-[10px] h-[6px] text-[#777777] shrink-0 ml-1"
                      fill="none"
                      viewBox="0 0 10 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 1l4 4 4-4" />
                    </svg>
                  </button>

                  {sortDropdownOpen && (
                    <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-2xl border border-[#E5E5E5] bg-white py-1.5 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy("recent");
                          setSortDropdownOpen(false);
                        }}
                        className={`block w-full px-4 py-2 text-left font-ui text-xs cursor-pointer ${
                          sortBy === "recent" ? "font-semibold text-[#E4572E]" : "text-[#111111] hover:bg-black/5"
                        }`}
                      >
                        Recently saved
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy("title");
                          setSortDropdownOpen(false);
                        }}
                        className={`block w-full px-4 py-2 text-left font-ui text-xs cursor-pointer ${
                          sortBy === "title" ? "font-semibold text-[#E4572E]" : "text-[#111111] hover:bg-black/5"
                        }`}
                      >
                        Title (A–Z)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy("popular");
                          setSortDropdownOpen(false);
                        }}
                        className={`block w-full px-4 py-2 text-left font-ui text-xs cursor-pointer ${
                          sortBy === "popular" ? "font-semibold text-[#E4572E]" : "text-[#111111] hover:bg-black/5"
                        }`}
                      >
                        Most upvoted
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Grid: auto-fill matching Feed Page so boxes don't expand and below boxes flow above */}
              {isLoadingBookmarks ? (
                <div
                  className="grid gap-6"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-[16px] bg-black/5 min-h-[342px] h-full w-full" />
                  ))}
                </div>
              ) : filteredBookmarks.length > 0 ? (
                <div
                  className="grid gap-6"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                >
                  {filteredBookmarks.map((post) => (
                    <BookmarkGridCard
                      key={post.id}
                      post={post as BookmarkFeedItem}
                      onOpen={() => setSelectedSlug(post.slug)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white p-12 text-center my-6">
                  <div className="mx-auto size-12 rounded-full bg-[#E4572E]/10 flex items-center justify-center text-[#E4572E] mb-3">
                    <BookmarkIcon className="size-6 text-[#E4572E]" />
                  </div>
                  <p className="font-editorial text-2xl font-bold text-[#111111]">
                    {searchQuery.trim() ? "No matching bookmarks" : "Nothing in this collection yet"}
                  </p>
                  <p className="mx-auto mt-2 max-w-md font-ui text-sm text-[#737373]">
                    {searchQuery.trim()
                      ? "Try searching for a different keyword."
                      : `No posts have been added to "${activeFolder.name}" yet.`}
                  </p>
                </div>
              )}

              {/* Collection Footer */}
              <div className="mt-14 flex flex-col items-center text-center">
                <p className="font-ui text-[12px] text-[#737373] mb-6">
                  Showing {filteredBookmarks.length} of {activeFolder.count} bookmarks
                </p>

                <div className="w-full pt-6 border-t border-[#111111]/[0.102] flex flex-col sm:flex-row items-center justify-between gap-4 text-[#8c8882]">
                  <p className="font-ui text-[12px]">Only you can see your bookmarks.</p>
                  <div className="flex items-center gap-6 font-ui text-[11px] font-medium tracking-wider">
                    <Link to="/discover" className="hover:text-[#111111] transition-colors">
                      ABOUT
                    </Link>
                    <Link to="/support" className="hover:text-[#111111] transition-colors">
                      CONTACT
                    </Link>
                    <a href="#privacy" className="hover:text-[#111111] transition-colors">
                      PRIVACY
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ══════════════════════════════════════════════════════════════════ */
            /* VIEW B: ALL BOOKMARKS OVERVIEW (Figma node 1637-3972 / 1637-4029)  */
            /* ══════════════════════════════════════════════════════════════════ */
            <div className="w-full">
              {/* Page Title & New Collection Action */}
              <div className="mb-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="font-editorial text-[32px] font-normal text-[#111111] leading-none tracking-normal">
                    Bookmarks
                  </h1>
                  <p className="mt-2 font-ui text-[14px] font-medium text-[#111111] leading-none tracking-normal">
                    Your saved stories, posts, and opportunities. All in one place.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewCollection(true);
                    navigate("/bookmarks/new");
                  }}
                  className="inline-flex items-center gap-[8px] h-[40px] px-[18px] py-[11px] rounded-full bg-[#E4572E] hover:bg-[#d04b24] text-white transition-colors shrink-0 cursor-pointer shadow-none"
                >
                  <svg
                    className="w-[9.33px] h-[9.33px] shrink-0"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M5 0.75v8.5M0.75 5h8.5" />
                  </svg>
                  <span className="font-ui text-[14px] font-semibold text-white leading-none tracking-normal">
                    New collection
                  </span>
                </button>
              </div>

              {/* ── "YOUR COLLECTIONS" SECTION (Figma MVP_Centoire) ─────────── */}
              <div className="mb-6">
                <div className="mb-3.5 flex items-center justify-between">
                  <h2 className="font-ui text-[14px] font-semibold text-[#111111] leading-none tracking-normal">
                    YOUR COLLECTIONS
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(null)}
                    className="font-ui text-[12px] font-normal text-[#777777] hover:text-[#111111] leading-none tracking-normal cursor-pointer transition-colors"
                  >
                    View all
                  </button>
                </div>

                <div
                  className="grid gap-3.5"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                >
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setActiveFolderId(folder.id)}
                      className="group relative flex h-[80px] p-[8px] gap-[12px] rounded-[16px] bg-white border border-[#E5E5E5]/60 hover:border-[#111111]/30 transition-all cursor-pointer items-center shadow-2xs"
                    >
                      <img
                        src={folder.coverUrl}
                        alt={folder.name}
                        className="w-[64px] h-[64px] rounded-[8px] object-cover bg-[#F2EDE4] shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-editorial text-[18px] font-normal text-[#111111] leading-none tracking-normal group-hover:text-[#E4572E] transition-colors">
                          {folder.name}
                        </p>
                        <p className="mt-1.5 font-ui text-[12px] font-normal text-[#777777] leading-none tracking-normal">
                          {folder.count} saved
                        </p>
                      </div>

                      {/* Figma inspect Vector: width 4px, height 8px, border 1.5px #777777 */}
                      <svg
                        className="w-[6px] h-[10px] text-[#777777] shrink-0 ml-auto mr-1"
                        fill="none"
                        viewBox="0 0 6 10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 1l4 4-4 4" />
                      </svg>

                      {!folder.id.startsWith("def-") && (
                        <button
                          type="button"
                          aria-label={`Delete collection ${folder.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete collection "${folder.name}"?`)) {
                              deleteFolder.mutate({ id: folder.id });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 size-5 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-[#737373] hover:text-[#111111] text-xs transition-opacity"
                          title="Delete folder"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── DIVIDER (Figma MVP_Centoire) ──────────────────────────────── */}
              <div className="w-full h-px bg-[#111111]/[0.102] my-6" />

              {/* ── PILL TABS & ALL COLLECTIONS DROPDOWN (Figma node 1637-3996) ── */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                {/* Pill tabs: ALL · 32 | POSTS · 32 CIRCLES · 3 CREATORS · 4 JOBS · 4 */}
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { key: "all" as const, label: "ALL", count: 32 },
                    { key: "posts" as const, label: "POSTS", count: 32 },
                    { key: "circles" as const, label: "CIRCLES", count: 3 },
                    { key: "creators" as const, label: "CREATORS", count: 4 },
                    { key: "jobs" as const, label: "JOBS", count: 4 },
                  ].map((tab, idx) => {
                    const isActive = activeTab === tab.key;
                    return (
                      <Fragment key={tab.key}>
                        {idx === 1 && <div className="h-5 w-px bg-[#111111]/20 mx-1 shrink-0" />}
                        <button
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={`inline-flex items-center justify-center h-[34px] px-[16px] py-[8px] rounded-full font-ui text-[14px] leading-none uppercase tracking-wide transition-all cursor-pointer shrink-0 ${
                            isActive
                              ? "bg-[#E4572E] border border-[#E4572E] text-white font-bold"
                              : "border border-[#111111]/15 bg-white hover:border-[#111111]/40 text-[#777777] hover:text-[#111111] font-semibold"
                          }`}
                        >
                          <span>{tab.label}</span>
                          <span className="mx-1">·</span>
                          <span className={`font-bold ${isActive ? "text-white" : "text-[#111111]"}`}>
                            {tab.count}
                          </span>
                        </button>
                      </Fragment>
                    );
                  })}
                </div>

                {/* Right side: ALL COLLECTIONS ⌄ dropdown */}
                <div className="relative" ref={collectionsDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setCollectionsDropdownOpen((o) => !o)}
                    className="inline-flex items-center gap-2 h-[34px] px-[16px] py-[8px] rounded-full border border-[#111111]/15 bg-white hover:border-[#111111]/40 font-ui text-[14px] font-semibold text-[#777777] hover:text-[#111111] leading-none uppercase tracking-wide transition-all cursor-pointer shrink-0 shadow-2xs"
                  >
                    <span>ALL COLLECTIONS</span>
                    <svg
                      className="w-[10px] h-[6px] text-[#777777] shrink-0 ml-1"
                      fill="none"
                      viewBox="0 0 10 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 1l4 4 4-4" />
                    </svg>
                  </button>

                  {collectionsDropdownOpen && (
                    <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-2xl border border-[#E5E5E5] bg-white py-1.5 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFolderId(null);
                          setCollectionsDropdownOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-2 font-ui text-xs font-semibold text-[#111111] hover:bg-black/5 cursor-pointer text-left"
                      >
                        <span>All bookmarks</span>
                        <span className="text-[#737373] font-normal">{totalBookmarksCount}</span>
                      </button>

                      <div className="my-1 border-t border-[#E5E5E5]" />

                      {folders.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setActiveFolderId(f.id);
                            setCollectionsDropdownOpen(false);
                          }}
                          className="flex w-full items-center justify-between px-4 py-2 font-ui text-xs text-[#111111] hover:bg-black/5 cursor-pointer text-left"
                        >
                          <span className="truncate">{f.name}</span>
                          <span className="text-[#737373] ml-2 font-mono text-[11px]">{f.count}</span>
                        </button>
                      ))}

                      <div className="my-1 border-t border-[#E5E5E5]" />

                      <button
                        type="button"
                        onClick={() => {
                          setCollectionsDropdownOpen(false);
                          setIsCreatingNewCollection(true);
                          navigate("/bookmarks/new");
                        }}
                        className="block w-full px-4 py-2 text-left font-ui text-xs font-semibold text-[#E4572E] hover:bg-[#E4572E]/5 cursor-pointer"
                      >
                        + New collection
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── SEARCH BAR (Figma MVP_Centoire) ─────────────────────────── */}
              <div className="relative mb-6 w-full h-[44px]">
                <svg
                  className="absolute left-[16px] top-1/2 -translate-y-1/2 w-[13.5px] h-[13.5px] text-[#777777] pointer-events-none"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="M11 11l3.5 3.5" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your bookmarks"
                  className="w-full h-[44px] rounded-full border border-[#111111]/15 bg-white pl-[40px] pr-[18px] font-ui text-[14px] font-normal text-[#111111] placeholder:text-[#777777] shadow-2xs focus:border-[#E4572E] focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-black/5 flex items-center justify-center text-xs text-[#737373] hover:text-[#111111]"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* ── SOURCES SECTION HEADER (Figma node 1637-4018) ───────────── */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
                <h2 className="font-ui text-[20px] font-bold uppercase tracking-normal text-[#111111] flex flex-wrap items-baseline gap-3">
                  {searchQuery.trim()
                    ? `RESULTS FOR "${searchQuery}" (${filteredBookmarks.length})`
                    : "SOURCES"}
                  {!searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFolderId(null);
                        setActiveTab("all");
                      }}
                      className="font-ui text-[14px] font-medium text-[#111111]/60 hover:text-[#111111] underline underline-offset-[2px] decoration-[#111111]/30 hover:decoration-[#111111] normal-case whitespace-nowrap relative -top-[3px] cursor-pointer"
                    >
                      View all
                    </button>
                  )}
                </h2>

                {/* Carousel navigation arrows */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Previous"
                    className="size-[36px] shrink-0 rounded-full bg-white border border-[#111111]/10 text-[#111111] hover:bg-black/5 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Next"
                    className="size-[36px] shrink-0 rounded-full bg-white border border-[#111111]/10 text-[#111111] hover:bg-black/5 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ── BOOKMARK GRID (auto-fill matching Feed Page so boxes don't expand and below boxes flow above) ── */}
              {isLoadingBookmarks ? (
                <div
                  className="grid gap-6"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                >
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-[16px] bg-black/5 min-h-[342px] h-full w-full" />
                  ))}
                </div>
              ) : filteredBookmarks.length > 0 ? (
                <div
                  className="grid gap-6"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
                >
                  {filteredBookmarks.slice(0, visibleCount).map((post) => (
                    <BookmarkGridCard
                      key={post.id}
                      post={post as BookmarkFeedItem}
                      onOpen={() => setSelectedSlug(post.slug)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#E5E5E5] bg-white p-12 text-center my-6">
                  <div className="mx-auto size-12 rounded-full bg-[#E4572E]/10 flex items-center justify-center text-[#E4572E] mb-3">
                    <BookmarkIcon className="size-6 text-[#E4572E]" />
                  </div>
                  <p className="font-editorial text-2xl font-bold text-[#111111]">
                    {searchQuery.trim() ? "No matching bookmarks" : "Nothing saved yet"}
                  </p>
                  <p className="mx-auto mt-2 max-w-md font-ui text-sm text-[#737373]">
                    {searchQuery.trim()
                      ? "Try searching for a different topic, author, or keyword."
                      : "Tap the bookmark icon on any post in your feed to save it here for later reading."}
                  </p>
                  {searchQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="mt-5 inline-flex items-center rounded-full bg-[#111111] px-4 py-2 font-ui text-xs font-semibold text-white hover:bg-black/80 transition-all cursor-pointer"
                    >
                      Clear search
                    </button>
                  ) : (
                    <Link
                      to="/feed"
                      className="mt-5 inline-flex items-center rounded-full bg-[#E4572E] px-5 py-2 font-ui text-xs font-semibold text-white hover:bg-[#d04b24] transition-all"
                    >
                      Explore Feed
                    </Link>
                  )}
                </div>
              )}

              {/* ── PAGINATION & FOOTER SECTION (Figma node 1637-4273) ───────── */}
              {filteredBookmarks.length > 0 && (
                <div className="mt-14 flex flex-col items-center text-center">
                  <p className="font-ui text-[12px] text-[#737373] mb-3">
                    Showing 6 of 24 bookmarks
                  </p>

                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => Math.min(c + 3, filteredBookmarks.length))}
                    className="inline-flex items-center gap-2 h-[40px] px-6 py-2.5 rounded-full border border-[#111111]/15 bg-white font-ui text-[13px] font-semibold text-[#111111] hover:border-[#111111]/40 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Load more bookmarks</span>
                    <svg
                      className="w-[10px] h-[6px] text-[#777777] shrink-0 ml-1"
                      fill="none"
                      viewBox="0 0 10 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 1l4 4 4-4" />
                    </svg>
                  </button>

                  <div className="w-full mt-14 pt-6 border-t border-[#111111]/[0.102] flex flex-col sm:flex-row items-center justify-between gap-4 text-[#8c8882]">
                    <p className="font-ui text-[12px]">
                      Only you can see your bookmarks.
                    </p>
                    <div className="flex items-center gap-6 font-ui text-[11px] font-medium tracking-wider">
                      <Link to="/discover" className="hover:text-[#111111] transition-colors">
                        ABOUT
                      </Link>
                      <Link to="/support" className="hover:text-[#111111] transition-colors">
                        CONTACT
                      </Link>
                      <a href="#privacy" className="hover:text-[#111111] transition-colors">
                        PRIVACY
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── POST DETAIL DRAWER (Same as FeedPage) ───────────────────────── */}
      {selectedSlug && (
        <PostDrawer slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}
    </div>
  );
}
