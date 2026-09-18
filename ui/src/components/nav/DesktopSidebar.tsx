import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../../lib/auth-context";
import { CATEGORY_NAV_ITEMS, NAV_GROUPS } from "./navConfig";
import { ChevronDownIcon, PanelLeftIcon } from "./icons";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem("sidebar_collapsed") === "true";
  } catch {
    return false;
  }
}

export function DesktopSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [categoriesOpen, setCategoriesOpen] = useState(() =>
    location.pathname.startsWith("/category/"),
  );
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar_collapsed", String(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <nav
      aria-label="Primary"
      className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col overflow-y-auto border-r border-[var(--color-hairline)] bg-white px-3 py-5 transition-all duration-200 md:flex ${collapsed ? "w-14" : "w-60"}`}
    >
      {NAV_GROUPS.map((group, gi) => {
        const visibleItems = group.items.filter(
          (item) => !item.permission || hasPermission(user?.role, item.permission),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={group.key} className={gi > 0 ? "mt-5" : ""}>
            {/* Section label + collapse toggle on the first group */}
            <div className="mb-1.5 flex items-center justify-between px-3">
              {!collapsed && (
                <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
                  {group.label}
                </p>
              )}
              {gi === 0 && (
                <button
                  type="button"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  onClick={toggleCollapsed}
                  className={`rounded-md p-1 text-[var(--color-taupe)] hover:bg-[var(--color-sand)] hover:text-[var(--color-stone)] ${collapsed ? "mx-auto" : "ml-auto"}`}
                >
                  <PanelLeftIcon className="size-4" />
                </button>
              )}
            </div>

            {gi > 0 && gi === 1 && !collapsed && (
              <div className="mb-3 h-px bg-[var(--color-hairline)]" />
            )}

            <ul className="flex flex-col gap-0.5">
              {visibleItems.map((item) => {
                if (item.key === "categories") {
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        title={collapsed ? item.label : undefined}
                        onClick={() => {
                          if (collapsed) toggleCollapsed();
                          else setCategoriesOpen((o) => !o);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-stone)] transition-colors hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
                      >
                        {item.icon && <item.icon className="size-4 shrink-0" />}
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <ChevronDownIcon
                              className={`size-3.5 shrink-0 transition-transform ${categoriesOpen ? "rotate-180" : ""}`}
                            />
                          </>
                        )}
                      </button>
                      {categoriesOpen && !collapsed && (
                        <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
                          {CATEGORY_NAV_ITEMS.map((cat) => (
                            <li key={cat.key}>
                              <NavLink
                                to={cat.to}
                                className={({ isActive }) =>
                                  `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                    isActive
                                      ? "font-semibold text-[var(--color-coral)]"
                                      : "text-[var(--color-stone)] hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
                                  }`
                                }
                              >
                                {cat.icon && <cat.icon className="size-3.5 shrink-0" />}
                                {cat.label}
                              </NavLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.to}
                      end={item.to === "/feed"}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-[var(--color-sand)] font-semibold text-[var(--color-coral)]"
                            : "text-[var(--color-stone)] hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
                        }`
                      }
                    >
                      {item.icon && <item.icon className="size-4 shrink-0" />}
                      {!collapsed && item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
