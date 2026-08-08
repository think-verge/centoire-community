import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useLogout } from "../lib/api/generated/auth/auth";
import { useAuth } from "../lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "../lib/permissions";
import { DesktopSidebar } from "./nav/DesktopSidebar";
import { MobileNav } from "./nav/MobileNav";
import { SearchIcon } from "./nav/icons";

export function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        navigate("/login");
      },
    },
  });

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
          <Link to="/feed" className="font-display-serif text-xl font-bold tracking-tight">
            Centoire
          </Link>
          <button
            type="button"
            onClick={() => navigate("/search")}
            className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-full border border-line bg-paper px-4 py-2 text-sm text-ink-faint hover:border-ink-soft sm:flex"
          >
            <SearchIcon className="size-4" />
            Search posts, people, circles…
          </button>
          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            <Link
              to="/compose"
              className="hidden rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse transition-colors hover:bg-crimson-deep sm:block"
            >
              Write
            </Link>
            <div className="relative">
              <button
                type="button"
                aria-label="Account menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="block rounded-full ring-crimson focus:outline-none focus-visible:ring-2"
              >
                <AvatarBubble name={user?.displayName ?? "?"} url={user?.avatarUrl ?? null} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-line bg-paper py-1 shadow-card-hover"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  {user?.handle && (
                    <MenuLink to={`/u/${user.handle}`} onClick={() => setMenuOpen(false)}>
                      Profile
                    </MenuLink>
                  )}
                  <MenuLink to="/settings" onClick={() => setMenuOpen(false)}>
                    Settings
                  </MenuLink>
                  {user?.role === "admin" && (
                    <MenuLink to="/admin/sources" onClick={() => setMenuOpen(false)}>
                      Sources admin
                    </MenuLink>
                  )}
                  {hasPermission(user?.role, "moderation.review") && (
                    <MenuLink to="/moderation" onClick={() => setMenuOpen(false)}>
                      Moderation
                    </MenuLink>
                  )}
                  {hasPermission(user?.role, "user.invite") && (
                    <MenuLink to="/admin/invites" onClick={() => setMenuOpen(false)}>
                      Invites
                    </MenuLink>
                  )}
                  <button
                    type="button"
                    onClick={() => logout.mutate()}
                    className="block w-full px-4 py-2 text-left text-sm text-ink-soft hover:bg-cream hover:text-ink"
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

        <main className="min-h-[calc(100vh-3.5rem)] w-full min-w-0 pb-20 md:pb-6">
          <Outlet />
        </main>
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
      className="block px-4 py-2 text-sm text-ink-soft hover:bg-cream hover:text-ink"
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
      className={`flex ${size} items-center justify-center rounded-full bg-gold-tint font-display-serif font-semibold text-gold`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
