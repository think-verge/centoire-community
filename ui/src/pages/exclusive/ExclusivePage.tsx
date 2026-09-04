export function ExclusivePage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[var(--color-coral)]">
        Centoire Exclusive
      </p>
      <h1 className="font-editorial mt-3 text-4xl italic text-[var(--color-charcoal)]">{title}</h1>
      <p className="mx-auto mt-4 max-w-sm font-ui text-base text-[var(--color-stone)]">
        {description}
      </p>
      <span className="mt-6 rounded-full border border-[var(--color-hairline)] px-4 py-1.5 font-ui text-xs text-[var(--color-taupe)]">
        Coming Soon
      </span>
    </main>
  );
}
