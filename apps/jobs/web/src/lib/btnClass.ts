export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-ui font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-coral)]";
const variants: Record<Variant, string> = {
  primary: "bg-[var(--color-coral)] text-white hover:opacity-90",
  secondary: "border border-[var(--color-charcoal)] bg-white text-[var(--color-charcoal)] hover:bg-[var(--color-charcoal)] hover:text-white",
  ghost: "text-[var(--color-stone)] hover:bg-[var(--color-sand-warm)] hover:text-[var(--color-charcoal)]",
  danger: "border border-red-300 bg-white text-red-600 hover:bg-red-50",
};
const sizes: Record<Size, string> = { md: "px-6 py-2.5 text-[13px]", sm: "px-4 py-1.5 text-[11px]" };

export function btnClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

