import {
  BookmarkIcon,
  BriefcaseIcon,
  DraftIcon,
  FactoryIcon,
  GridIcon,
  ShieldIcon,
  UsersIcon,
  type AppFrameNavItem,
} from "@centoire/ui";
import { CORE_URL } from "./env";

export interface NavFlags {
  employer: boolean;
  moderator: boolean;
  companyAdmin: boolean;
}

export type NavEntry = Omit<AppFrameNavItem, "active"> & { match: (pathname: string) => boolean };

const starts = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`);

export function buildNav(flags: NavFlags): NavEntry[] {
  const items: NavEntry[] = [
    { key: "browse", label: "Browse jobs", href: "/", icon: BriefcaseIcon, match: (p) => p === "/" || starts("/jobs")(p) || starts("/companies")(p) },
  ];
  items.push(
    { key: "saved", label: "Saved", href: "/me/saved", icon: BookmarkIcon, match: starts("/me/saved") },
    { key: "applications", label: "My applications", href: "/me/applications", icon: DraftIcon, match: starts("/me/applications") },
    { key: "profile", label: "My profile", href: "/me/profile", icon: UsersIcon, match: (p) => starts("/me/profile")(p) || starts("/candidates")(p) },
  );
  if (flags.employer) items.push({ key: "employer", label: "Employer", href: "/employer", icon: FactoryIcon, match: starts("/employer") });
  if (flags.moderator) items.push({ key: "review", label: "Review queue", href: "/admin/review", icon: ShieldIcon, match: starts("/admin/review") });
  if (flags.companyAdmin) items.push({ key: "companies-admin", label: "Companies admin", href: "/admin/companies", icon: GridIcon, match: starts("/admin/companies") });
  items.push({ key: "centoire", label: "Back to Centoire", href: CORE_URL, external: true, icon: undefined, match: () => false });
  return items;
}
