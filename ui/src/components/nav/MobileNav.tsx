import { useState } from "react";
import { NavLink } from "react-router-dom";
import { BookmarkIcon, CompassIcon, GridIcon, HomeIcon, PenIcon } from "./icons";
import type { IconComponent } from "./navConfig";
import { MoreSheet } from "./MoreSheet";

export function MobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper md:hidden"
      >
        <MobileNavLink to="/feed" label="For You" icon={HomeIcon} />
        <MobileNavLink to="/discover" label="Discover" icon={CompassIcon} />
        <MobileNavLink to="/compose" label="Write" icon={PenIcon} />
        <MobileNavLink to="/bookmarks" label="Bookmarks" icon={BookmarkIcon} />
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-ink-soft"
        >
          <GridIcon className="size-5" />
          More
        </button>
      </nav>
      {sheetOpen && <MoreSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}

function MobileNavLink({ to, label, icon: Icon }: { to: string; label: string; icon: IconComponent }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
          isActive ? "text-crimson" : "text-ink-soft"
        }`
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  );
}
