import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useLogout } from "../lib/api/generated/auth/auth";
import { useAuth } from "../lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";

const NAV_ITEMS = [
  { to: "/feed", label: "For You", icon: HomeIcon },
  { to: "/following", label: "Following", icon: UsersIcon },
  { to: "/discover", label: "Discover", icon: CompassIcon },
  { to: "/circles", label: "Circles", icon: CirclesIcon },
  { to: "/bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { to: "/drafts", label: "Drafts", icon: DraftIcon },
];

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
        <nav
          aria-label="Primary"
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-52 shrink-0 flex-col gap-1 border-r border-line px-3 py-6 md:flex"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-paper text-crimson shadow-card"
                    : "text-ink-soft hover:bg-paper hover:text-ink"
                }`
              }
            >
              <Icon className="size-4.5" />
              {label}
            </NavLink>
          ))}
        </nav>

        <main className="min-h-[calc(100vh-3.5rem)] w-full min-w-0 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper md:hidden"
      >
        {[NAV_ITEMS[0], NAV_ITEMS[2], { to: "/compose", label: "Write", icon: PenIcon }, NAV_ITEMS[3], NAV_ITEMS[4]].map(
          ({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
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
          ),
        )}
      </nav>
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

type IconProps = { className?: string };
function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V21H3z" strokeLinejoin="round" />
    </svg>
  );
}
function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" strokeLinecap="round" />
      <path d="M16 8.5a3 3 0 1 0 .01-5.99" />
      <path d="M17.5 15.2c2 .5 3.4 1.9 4 4" strokeLinecap="round" />
    </svg>
  );
}
function CompassIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" strokeLinejoin="round" />
    </svg>
  );
}
function CirclesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="9" cy="9" r="5.5" />
      <circle cx="15.5" cy="15.5" r="5.5" />
    </svg>
  );
}
function BookmarkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" strokeLinejoin="round" />
    </svg>
  );
}
function DraftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M5 3h9l5 5v13H5z" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinejoin="round" />
    </svg>
  );
}
function PenIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" strokeLinejoin="round" />
    </svg>
  );
}
function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
