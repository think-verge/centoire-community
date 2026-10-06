import type { ReactNode } from "react";

export interface AppFrameNavItem {
  key: string;
  label: string;
  href: string;
  active?: boolean;
  icon?: (props: { className?: string }) => ReactNode;
  /** Render as a plain anchor (full page load / other app) instead of via `renderLink`. */
  external?: boolean;
}

export interface AppFrameProps {
  /** App name shown next to the Centoire wordmark, e.g. "Jobs". */
  appName: string;
  homeHref: string;
  nav: AppFrameNavItem[];
  /** Search box / actions on the right of the top bar. */
  topbarCenter?: ReactNode;
  topbarRight?: ReactNode;
  /** Lets the host app plug in its router's Link. Defaults to a plain anchor. */
  renderLink?: (item: { href: string; className: string; children: ReactNode }) => ReactNode;
  children: ReactNode;
}

const itemBase = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
const itemClass = (active?: boolean) =>
  `${itemBase} ${
    active
      ? "bg-[var(--color-sand)] font-semibold text-[var(--color-coral)]"
      : "text-[var(--color-stone)] hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
  }`;

/** Top bar + left rail shared by mini apps; mirrors the main app's shell without its routes. */
export function AppFrame({
  appName,
  homeHref,
  nav,
  topbarCenter,
  topbarRight,
  renderLink,
  children,
}: AppFrameProps) {
  const link = (item: AppFrameNavItem) => {
    const className = itemClass(item.active);
    const content = (
      <>
        {item.icon?.({ className: "size-4 shrink-0" })}
        <span className="whitespace-nowrap">{item.label}</span>
      </>
    );
    if (renderLink && !item.external) {
      return renderLink({ href: item.href, className, children: content });
    }
    return (
      <a href={item.href} className={className} {...(item.external ? { target: "_blank", rel: "noopener" } : {})}>
        {content}
      </a>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-sand)]">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-[var(--color-hairline)] bg-white px-4">
        <a href={homeHref} className="flex shrink-0 items-baseline gap-2">
          <span className="font-editorial text-2xl font-bold tracking-tight text-[var(--color-charcoal)]">Centoire</span>
          <span className="font-ui text-xs font-bold uppercase tracking-widest text-[var(--color-coral)]">{appName}</span>
        </a>
        <div className="min-w-0 flex-1">{topbarCenter}</div>
        <div className="flex shrink-0 items-center gap-2">{topbarRight}</div>
      </header>
      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r border-[var(--color-hairline)] bg-white p-3 md:block">
          <ul className="space-y-1">
            {nav.map((item) => (
              <li key={item.key}>{link(item)}</li>
            ))}
          </ul>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
