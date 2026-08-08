import { Link, useLocation } from "react-router-dom";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../../lib/auth-context";
import { NAV_SECTIONS } from "./navConfig";
import { DisabledNavItem } from "./DisabledNavItem";
import { isNavItemActive } from "./navActive";

interface Props {
  onClose: () => void;
}

/** Full nav tree for mobile — the bottom bar only fits 4 fixed slots, everything
 *  else (Circles/Drafts/Moderation/Invites, all 5 verticals, Experts, Media) lives here. */
export function MoreSheet({ onClose }: Props) {
  const { user } = useAuth();
  const location = useLocation();

  const visibleSections = NAV_SECTIONS.filter(
    (section) => !section.permission || hasPermission(user?.role, section.permission),
  );

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="More navigation">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-paper px-4 pb-8 pt-3 shadow-card-hover">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="space-y-4">
          {visibleSections.map((section) => (
            <div key={section.key}>
              <div className="flex items-center gap-2 px-1 text-sm font-semibold text-ink">
                <section.icon className="size-4.5" />
                {section.label}
                {section.disabled && !section.children && (
                  <span className="rounded-full border border-line bg-cream px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                    Soon
                  </span>
                )}
              </div>
              {section.to && !section.children && (
                <Link
                  to={section.to}
                  onClick={onClose}
                  className="mt-1 block rounded-lg px-1 py-1 text-sm text-ink-soft hover:text-ink"
                >
                  Open {section.label}
                </Link>
              )}
              {section.children && (
                <div className="mt-1 space-y-0.5 pl-1">
                  {section.children.map((item) =>
                    item.disabled ? (
                      <DisabledNavItem key={item.key} label={item.label} indent />
                    ) : (
                      <Link
                        key={item.key}
                        to={item.to}
                        onClick={onClose}
                        className={`block rounded-lg px-3 py-1.5 text-sm ${
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
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
