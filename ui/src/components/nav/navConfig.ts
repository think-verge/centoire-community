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
import { miniAppHref, miniApps } from "../../lib/miniApps";

const EXCLUSIVE_ICONS: Record<string, IconComponent> = {
  "ai-tools": AiToolsIcon,
  jobs: BriefcaseIcon,
  certification: CertIcon,
  startups: RocketIcon,
  research: ResearchIcon,
  buyers: FactoryIcon,
};

export type IconComponent = ComponentType<{ className?: string }>;

export interface NavItem {
  key: string;
  label: string;
  to: string;
  /** Absolute URL of another Centoire app; renders as a new-tab link instead of a router link. */
  href?: string;
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

/** "Centoire Exclusive" entries come from the mini-app registry: live apps open in a new tab. */
const EXCLUSIVE_ITEMS: NavItem[] = miniApps.map((app) => {
  const href = miniAppHref(app, "sidebar");
  return {
    key: `excl:${app.id}`,
    label: app.label,
    to: app.comingSoonPath,
    ...(href ? { href } : {}),
    icon: EXCLUSIVE_ICONS[app.id],
  };
});

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
      ...EXCLUSIVE_ITEMS,
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
