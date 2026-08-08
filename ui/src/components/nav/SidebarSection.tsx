import { Link, NavLink, useLocation } from "react-router-dom";
import type { NavSection } from "./navConfig";
import { ChevronDownIcon } from "./icons";
import { DisabledNavItem } from "./DisabledNavItem";
import { isNavItemActive } from "./navActive";

const LINK_CLASS = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
const ACTIVE_CLASS = "bg-paper text-crimson shadow-card";
const INACTIVE_CLASS = "text-ink-soft hover:bg-paper hover:text-ink";

interface Props {
  section: NavSection;
  isOpen: boolean;
  onToggle: () => void;
}

export function SidebarSection({ section, isOpen, onToggle }: Props) {
  const location = useLocation();
  const { icon: Icon, label, to, children, disabled, key } = section;

  if (disabled && !children) {
    return <DisabledNavItem icon={Icon} label={label} />;
  }

  if (to && !children) {
    return (
      <NavLink to={to} className={({ isActive }) => `${LINK_CLASS} ${isActive ? ACTIVE_CLASS : INACTIVE_CLASS}`}>
        <Icon className="size-4.5" />
        {label}
      </NavLink>
    );
  }

  const anyChildActive = (children ?? []).some(
    (item) => !item.disabled && isNavItemActive(item.to, location.pathname, location.search),
  );

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`nav-section-${key}`}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          anyChildActive ? "text-crimson" : "text-ink-soft hover:bg-paper hover:text-ink"
        }`}
      >
        <Icon className="size-4.5" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDownIcon className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <div
        id={`nav-section-${key}`}
        // eslint-disable-next-line react/no-unknown-property -- React 19 supports the native `inert` boolean attribute
        inert={!isOpen}
        className="grid overflow-hidden transition-[grid-template-rows] duration-200"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 space-y-0.5 py-1 pl-6">
          {(children ?? []).map((item) =>
            item.disabled ? (
              <DisabledNavItem key={item.key} label={item.label} indent />
            ) : (
              <Link
                key={item.key}
                to={item.to}
                aria-current={isNavItemActive(item.to, location.pathname, location.search) ? "page" : undefined}
                className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  isNavItemActive(item.to, location.pathname, location.search)
                    ? "font-semibold text-crimson"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
