import { NavLink } from "react-router-dom";
import type { NavEntry } from "../lib/nav";

/** AppFrame hides its side rail below md, so small screens get this bottom bar. */
export function MobileNav({ items, pathname }: { items: NavEntry[]; pathname: string }) {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-hairline)] bg-white md:hidden">
      <ul className="flex overflow-x-auto">
        {items.map((item) => {
          const active = item.match(pathname);
          const cls = `flex min-w-20 flex-1 flex-col items-center gap-0.5 px-3 py-2 font-ui text-[10px] font-semibold uppercase tracking-wider ${
            active ? "text-[var(--color-coral)]" : "text-[var(--color-stone)]"
          }`;
          const content = (
            <>
              {item.icon?.({ className: "size-5" })}
              <span className="whitespace-nowrap">{item.label.replace("Back to ", "")}</span>
            </>
          );
          return (
            <li key={item.key} className="flex flex-1">
              {item.external ? (
                <a href={item.href} className={`${cls} w-full`}>
                  {content}
                </a>
              ) : (
                <NavLink to={item.href} end={item.href === "/"} className={`${cls} w-full`} aria-current={active ? "page" : undefined}>
                  {content}
                </NavLink>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
