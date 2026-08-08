import type { ComponentType } from "react";
import type { Permission } from "../../lib/permissions";
import { CATEGORY_LABELS, CATEGORY_SUBCATEGORIES, POST_CATEGORIES } from "../../lib/categoryTaxonomy";
import {
  BeautyIcon,
  BookmarkIcon,
  BusinessIcon,
  CirclesIcon,
  CompassIcon,
  DraftIcon,
  ExpertsIcon,
  FashionIcon,
  LifestyleIcon,
  MediaIcon,
  ShieldIcon,
  TechIcon,
  UserPlusIcon,
} from "./icons";

export type IconComponent = ComponentType<{ className?: string }>;

export interface NavItem {
  key: string;
  to: string;
  label: string;
  disabled?: boolean;
}

export interface NavSection {
  key: string;
  label: string;
  icon: IconComponent;
  /** Present on childless sections — rendered as a plain link, no accordion. */
  to?: string;
  children?: NavItem[];
  /** Top-level placeholder (Experts, Media) — visible, non-interactive, "Soon" badge. */
  disabled?: boolean;
  permission?: Permission;
}

function categoryChildren(category: (typeof POST_CATEGORIES)[number]): NavItem[] {
  return [
    { key: `${category}:all`, to: `/category/${category}`, label: `All ${CATEGORY_LABELS[category]}` },
    ...CATEGORY_SUBCATEGORIES[category].map((sub) => ({
      key: `${category}:${sub}`,
      to: `/category/${category}?subcategory=${encodeURIComponent(sub)}`,
      label: sub,
    })),
  ];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "discover",
    label: "Discover",
    icon: CompassIcon,
    children: [
      { key: "discover:for-you", to: "/feed", label: "For You" },
      { key: "discover:following", to: "/following", label: "Following" },
      { key: "discover:trending", to: "/discover?sort=trending", label: "Trending" },
      { key: "discover:latest", to: "/discover?sort=new", label: "Latest" },
      { key: "discover:top-stories", to: "/discover", label: "Top Stories", disabled: true },
      { key: "discover:expert-voices", to: "/discover", label: "Expert Voices", disabled: true },
      { key: "discover:trend-radar", to: "/discover", label: "Trend Radar", disabled: true },
      { key: "discover:industry-pulse", to: "/discover", label: "Industry Pulse", disabled: true },
      { key: "discover:recommended", to: "/discover", label: "Recommended", disabled: true },
    ],
  },
  { key: "fashion", label: "Fashion", icon: FashionIcon, children: categoryChildren("fashion") },
  { key: "beauty", label: "Beauty", icon: BeautyIcon, children: categoryChildren("beauty") },
  { key: "lifestyle", label: "Lifestyle", icon: LifestyleIcon, children: categoryChildren("lifestyle") },
  {
    key: "ai_technology",
    label: "AI & Technology",
    icon: TechIcon,
    children: categoryChildren("ai_technology"),
  },
  {
    key: "business_intelligence",
    label: "Business & Intelligence",
    icon: BusinessIcon,
    children: categoryChildren("business_intelligence"),
  },
  { key: "experts", label: "Experts", icon: ExpertsIcon, disabled: true },
  { key: "media", label: "Media", icon: MediaIcon, disabled: true },
  { key: "circles", label: "Circles", icon: CirclesIcon, to: "/circles" },
  { key: "bookmarks", label: "Bookmarks", icon: BookmarkIcon, to: "/bookmarks" },
  { key: "drafts", label: "Drafts", icon: DraftIcon, to: "/drafts" },
  {
    key: "moderation",
    label: "Moderation",
    icon: ShieldIcon,
    to: "/moderation",
    permission: "moderation.review",
  },
  {
    key: "invites",
    label: "Invites",
    icon: UserPlusIcon,
    to: "/admin/invites",
    permission: "user.invite",
  },
];
