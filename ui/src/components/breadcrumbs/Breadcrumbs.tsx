import { Link } from "react-router-dom";
import { useTrail } from "./useBreadcrumbs";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="size-3 shrink-0 text-[var(--color-taupe)]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

const linkClass = "rounded-sm text-[var(--color-stone)] transition-colors hover:text-[var(--color-coral)] focus-visible:text-[var(--color-coral)]";

/**
 * Breadcrumb trail for the current page, rendered once by AppShell. Hidden on top-level pages.
 * Desktop shows the whole trail; on phones it collapses to a single "back to parent" link.
 */
export function Breadcrumbs() {
  const trail = useTrail();
  if (trail.length < 2) return null;

  const current = trail[trail.length - 1];
  const parent = trail[trail.length - 2];

  return (
    <nav aria-label="Breadcrumb" className="px-4 pt-4 font-ui text-[12px] sm:px-6">
      {/* Small screens: one tap back to where you came from */}
      <Link to={parent.to ?? "/feed"} className={`inline-flex items-center gap-1 font-semibold md:hidden ${linkClass}`}>
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        {parent.label}
      </Link>

      <ol className="hidden min-w-0 items-center gap-1.5 md:flex">
        {trail.map((crumb, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${i}-${crumb.label}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && <Chevron />}
              {last || !crumb.to ? (
                <span aria-current={last ? "page" : undefined} title={crumb.label} className="max-w-[44ch] truncate font-semibold text-[var(--color-charcoal)]">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className={`max-w-[28ch] truncate ${linkClass}`}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <span className="sr-only">Current page: {current.label}</span>
    </nav>
  );
}
