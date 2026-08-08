import { useState } from "react";
import { useLocation } from "react-router-dom";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../../lib/auth-context";
import { NAV_SECTIONS } from "./navConfig";
import { SidebarSection } from "./SidebarSection";
import { isNavItemActive } from "./navActive";

function findInitialOpenKey(pathname: string, search: string): string | null {
  for (const section of NAV_SECTIONS) {
    if (!section.children) continue;
    const matches = section.children.some(
      (item) => !item.disabled && isNavItemActive(item.to, pathname, search),
    );
    if (matches) return section.key;
  }
  return null;
}

export function DesktopSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  // Seeded once from the URL on mount, like Acuvity's sidebar — doesn't re-seed on
  // later client-side navigation, only on first load/refresh into a section.
  const [openKey, setOpenKey] = useState<string | null>(() =>
    findInitialOpenKey(location.pathname, location.search),
  );

  const visibleSections = NAV_SECTIONS.filter(
    (section) => !section.permission || hasPermission(user?.role, section.permission),
  );

  return (
    <nav
      aria-label="Primary"
      className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-line px-3 py-6 md:flex"
    >
      {visibleSections.map((section) => (
        <SidebarSection
          key={section.key}
          section={section}
          isOpen={openKey === section.key}
          onToggle={() => setOpenKey((prev) => (prev === section.key ? null : section.key))}
        />
      ))}
    </nav>
  );
}
