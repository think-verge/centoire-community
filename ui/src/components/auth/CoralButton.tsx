import type { ButtonHTMLAttributes } from "react";

interface CoralButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function CoralButton({ loading = false, disabled, children, className = "", ...rest }: CoralButtonProps) {
  return (
    <button
      className={`font-ui inline-flex items-center justify-center gap-2 rounded bg-coral px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90 disabled:opacity-50 ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
