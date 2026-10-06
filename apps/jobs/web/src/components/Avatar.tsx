import { initials } from "../lib/format";

export function Avatar({ name, url, size = 32 }: { name: string; url: string | null | undefined; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (url) return <img src={url} alt="" loading="lazy" style={style} className="shrink-0 rounded-full object-cover" />;
  return (
    <span aria-hidden style={style} className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-blush)] font-ui font-bold text-[var(--color-charcoal)]">
      {initials(name)}
    </span>
  );
}
