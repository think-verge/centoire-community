import { initials } from "../lib/format";

export function CompanyLogo({ name, logoUrl, size = 48 }: { name: string; logoUrl: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (logoUrl) {
    return <img src={logoUrl} alt="" loading="lazy" style={style} className="shrink-0 rounded-xl border border-[#EAEAEA] bg-white object-contain" />;
  }
  return (
    <span
      aria-hidden
      style={{ ...style, fontSize: size * 0.36 }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-blush)] font-editorial font-bold text-[var(--color-charcoal)]"
    >
      {initials(name)}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span title="Verified company" className="inline-flex items-center gap-1 rounded-full bg-[var(--color-coral)]/10 px-2 py-0.5 font-ui text-[10px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
      <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12l5 5L20 7" />
      </svg>
      Verified
    </span>
  );
}
