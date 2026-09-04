import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { RightSidebarContext } from "./nav/RightSidebar";
import { useLogout } from "../lib/api/generated/auth/auth";
import { useAuth } from "../lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "../lib/permissions";
import { DesktopSidebar } from "./nav/DesktopSidebar";
import { RightSidebar } from "./nav/RightSidebar";
import { MobileNav } from "./nav/MobileNav";
import { MenuIcon, MicIcon, SearchIcon } from "./nav/icons";
import { NotificationBell } from "./NotificationBell";

function getRightSidebarContext(pathname: string): RightSidebarContext | null {
  if (pathname === "/feed") return { type: "feed" };
  if (pathname === "/following") return { type: "following" };
  if (pathname === "/discover") return { type: "discover" };
  const m = pathname.match(/^\/category\/([^/]+)$/);
  if (m) return { type: "category", category: m[1] };
  return null;
}

export function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const rightCtx = getRightSidebarContext(location.pathname);
  const queryClient = useQueryClient();
  const [activeMenu, setActiveMenu] = useState<"account" | "bell" | null>(null);
  const menuOpen = activeMenu === "account";
  const logout = useLogout({
    mutation: {
      onSettled: () => {
        queryClient.clear();
        navigate("/");
      },
    },
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-[var(--color-hairline)] bg-white">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-5">
          {/* Hamburger stub */}
          <button
            type="button"
            aria-label="Toggle menu"
            className="rounded-lg p-1.5 text-[var(--color-stone)] hover:bg-[var(--color-sand)] md:hidden"
          >
            <MenuIcon className="size-5" />
          </button>

          {/* Logo */}
          <Link
            to="/feed"
            className="font-editorial text-xl italic font-bold tracking-tight text-[var(--color-charcoal)] shrink-0"
          >
            Centoire
          </Link>

          {/* Search bar */}
          <div className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-full border border-[var(--color-hairline)] bg-[var(--color-sand)] px-4 py-2 sm:flex">
            <SearchIcon className="size-4 shrink-0 text-[var(--color-taupe)]" />
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="flex-1 text-left text-sm text-[var(--color-stone)]"
            >
              Search…
            </button>
            <button
              type="button"
              aria-label="Voice search"
              className="shrink-0 text-[var(--color-taupe)] hover:text-[var(--color-stone)]"
            >
              <MicIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/search")}
              className="shrink-0 rounded-full bg-[var(--color-coral)] px-3 py-0.5 font-ui text-xs font-bold text-white"
            >
              Ask
            </button>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Link
              to="/compose"
              className="hidden rounded-full border border-[var(--color-coral)] bg-[var(--color-coral)] px-4 py-1.5 font-ui text-sm font-semibold text-white transition-colors hover:opacity-90 sm:block"
            >
              + Post
            </Link>
            <NotificationBell
              active={activeMenu === "bell"}
              onToggle={() => setActiveMenu((prev) => (prev === "bell" ? null : "bell"))}
              onClose={() => setActiveMenu(null)}
            />
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                onClick={() => setActiveMenu((prev) => (prev === "account" ? null : "account"))}
                className="block rounded-full ring-[var(--color-coral)] focus:outline-none focus-visible:ring-2"
              >
                <AvatarBubble name={user?.displayName ?? "?"} url={user?.avatarUrl ?? null} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-[var(--color-hairline)] bg-white py-1 shadow-lg"
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  {user?.handle && (
                    <MenuLink to={`/u/${user.handle}`} onClick={() => setActiveMenu(null)}>
                      Profile
                    </MenuLink>
                  )}
                  <MenuLink to="/settings" onClick={() => setActiveMenu(null)}>
                    Settings
                  </MenuLink>
                  {user?.role === "admin" && (
                    <MenuLink to="/admin/sources" onClick={() => setActiveMenu(null)}>
                      Sources admin
                    </MenuLink>
                  )}
                  {hasPermission(user?.role, "moderation.review") && (
                    <MenuLink to="/moderation" onClick={() => setActiveMenu(null)}>
                      Moderation
                    </MenuLink>
                  )}
                  {hasPermission(user?.role, "user.invite") && (
                    <MenuLink to="/admin/invites" onClick={() => setActiveMenu(null)}>
                      Invites
                    </MenuLink>
                  )}
                  <button
                    type="button"
                    onClick={() => logout.mutate()}
                    className="block w-full px-4 py-2 text-left text-sm text-[var(--color-stone)] hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex w-full">
        <DesktopSidebar />

        <main className="min-h-[calc(100vh-3.5rem)] min-w-0 flex-1 pb-20 md:pb-6">
          <Outlet />
        </main>

        {rightCtx && <RightSidebar context={rightCtx} />}
      </div>

      <MobileNav />
    </div>
  );
}

function MenuLink({
  to,
  onClick,
  children,
}: {
  to: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-[var(--color-stone)] hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
    >
      {children}
    </Link>
  );
}

export function AvatarBubble({
  name,
  url,
  size = "size-8",
}: {
  name: string;
  url: string | null;
  size?: string;
}) {
  if (url) {
    return <img src={url} alt={name} className={`${size} rounded-full object-cover`} />;
  }
  return (
    <span
      className={`flex ${size} items-center justify-center rounded-full bg-[var(--color-sand)] font-ui font-semibold text-[var(--color-stone)]`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
