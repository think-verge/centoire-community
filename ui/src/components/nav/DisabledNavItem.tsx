import type { IconComponent } from "./navConfig";

interface Props {
  label: string;
  icon?: IconComponent;
  indent?: boolean;
}

/** Non-interactive placeholder for sections/items whose mini-app isn't built yet
 *  (Experts, Media, unbuilt Discover sub-items) — visible for IA completeness. */
export function DisabledNavItem({ label, icon: Icon, indent }: Props) {
  return (
    <span
      aria-disabled="true"
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-faint ${
        indent ? "py-1.5 pl-3 text-sm font-normal" : ""
      }`}
    >
      {Icon && <Icon className="size-4.5" />}
      <span className="flex-1">{label}</span>
      <span className="rounded-full border border-line bg-cream px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
        Soon
      </span>
    </span>
  );
}
