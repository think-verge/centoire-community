export interface MiniAppBannerProps {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}

/** Promo card for a mini app, shown in the main feed. Opens the app in a new tab. */
export function MiniAppBanner({ eyebrow, title, body, cta, href }: MiniAppBannerProps) {
  return (
    <div className="my-8 flex items-center justify-between gap-6 rounded-2xl bg-[#111] px-8 py-6">
      <div className="min-w-0">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-white/50">{eyebrow}</p>
        <h2 className="font-editorial mt-1 text-3xl italic text-white">{title}</h2>
        <p className="mt-1 font-ui text-sm text-white/60">{body}</p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="shrink-0 rounded-lg bg-[var(--color-coral)] px-6 py-2.5 font-ui text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        {cta} →
      </a>
    </div>
  );
}
