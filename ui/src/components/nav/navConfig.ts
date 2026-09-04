import type { ComponentType } from "react";
import type { Permission } from "../../lib/permissions";
import {
  AiToolsIcon,
  ArtIcon,
  BriefcaseIcon,
  BookmarkIcon,
  CertIcon,
  CirclesIcon,
  DraftIcon,
  FactoryIcon,
  FashionIcon,
  GridIcon,
  HomeIcon,
  LifestyleIcon,
  ResearchIcon,
  RocketIcon,
  SupportIcon,
  UserPlusIcon,
  UsersIcon,
} from "./icons";

export type IconComponent = ComponentType<{ className?: string }>;

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon?: IconComponent;
  disabled?: boolean;
  permission?: Permission;
  /** If true, renders as a sub-item (indented) under a parent accordion */
  isChild?: boolean;
}

export interface NavGroup {
  key: string;
  /** Section heading shown above the group */
  label: string;
  items: NavItem[];
}

/** Categories accordion children — no subcategories, just top-level categories */
export const CATEGORY_NAV_ITEMS: NavItem[] = [
  { key: "cat:fashion", label: "Fashion", to: "/category/fashion", icon: FashionIcon, isChild: true },
  { key: "cat:art", label: "Art", to: "/category/art", icon: ArtIcon, isChild: true },
  { key: "cat:lifestyle", label: "Lifestyle", to: "/category/lifestyle", icon: LifestyleIcon, isChild: true },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "explore",
    label: "Explore",
    items: [
      { key: "home", label: "Home", to: "/feed", icon: HomeIcon },
      { key: "following", label: "Following", to: "/following", icon: UsersIcon },
      // Categories is handled specially in DesktopSidebar as an accordion
      { key: "categories", label: "Categories", to: "", icon: GridIcon },
      { key: "circles", label: "Circles", to: "/circles", icon: CirclesIcon },
    ],
  },
  {
    key: "exclusive",
    label: "Centoire Exclusive",
    items: [
      { key: "excl:ai-tools", label: "AI & Industry Tools", to: "/exclusive/ai-tools", icon: AiToolsIcon },
      { key: "excl:jobs", label: "Jobs", to: "/exclusive/jobs", icon: BriefcaseIcon },
      { key: "excl:cert", label: "Certification", to: "/exclusive/certification", icon: CertIcon },
      { key: "excl:startups", label: "Startup / Investors", to: "/exclusive/startups", icon: RocketIcon },
      { key: "excl:research", label: "Research", to: "/exclusive/research", icon: ResearchIcon },
      { key: "excl:buyers", label: "Buyer / Manufactures", to: "/exclusive/buyers", icon: FactoryIcon },
    ],
  },
  {
    key: "actions",
    label: "Actions",
    items: [
      { key: "drafts", label: "Drafts", to: "/drafts", icon: DraftIcon },
      { key: "bookmarks", label: "Bookmarks", to: "/bookmarks", icon: BookmarkIcon },
      { key: "invites", label: "Invite Member", to: "/admin/invites", icon: UserPlusIcon, permission: "user.invite" },
      { key: "support", label: "Support", to: "/support", icon: SupportIcon },
    ],
  },
];
