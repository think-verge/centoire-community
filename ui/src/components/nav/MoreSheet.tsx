import { Link, useLocation } from "react-router-dom";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../../lib/auth-context";
import { CATEGORY_NAV_ITEMS, NAV_GROUPS } from "./navConfig";

interface Props {
  onClose: () => void;
}

export function MoreSheet({ onClose }: Props) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-8 pt-3 shadow-xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-hairline)]" />
        <div className="space-y-5">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.permission || hasPermission(user?.role, item.permission),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.key}>
                <p className="mb-1.5 px-1 font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    if (item.key === "categories") {
                      return (
                        <div key={item.key}>
                          <p className="px-1 py-1 text-sm font-semibold text-[var(--color-stone)]">
                            Categories
                          </p>
                          <div className="space-y-0.5 pl-2">
                            {CATEGORY_NAV_ITEMS.map((cat) => (
                              <Link
                                key={cat.key}
                                to={cat.to}
                                onClick={onClose}
                                className={`block rounded-lg px-3 py-1.5 text-sm ${
                                  location.pathname === cat.to
                                    ? "font-semibold text-[var(--color-coral)]"
                                    : "text-[var(--color-stone)] hover:text-[var(--color-charcoal)]"
                                }`}
                              >
                                {cat.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={item.key}
                        to={item.to}
                        onClick={onClose}
                        className={`block rounded-lg px-3 py-1.5 text-sm ${
                          location.pathname === item.to
                            ? "font-semibold text-[var(--color-coral)]"
                            : "text-[var(--color-stone)] hover:text-[var(--color-charcoal)]"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
