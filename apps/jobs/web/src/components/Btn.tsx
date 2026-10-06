import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";

import { btnClass, type Variant, type Size } from "../lib/btnClass";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Btn({ variant = "primary", size = "md", loading = false, disabled, className = "", children, type = "button", ...rest }: BtnProps) {
  return (
    <button type={type} disabled={disabled || loading} className={btnClass(variant, size, className)} {...rest}>
      {loading && <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

interface LinkBtnProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function LinkBtn({ variant = "primary", size = "md", className = "", ...rest }: LinkBtnProps) {
  return <Link className={btnClass(variant, size, className)} {...rest} />;
}

interface ExtBtnProps {
  href: string;
  variant?: Variant;
  size?: Size;
  newTab?: boolean;
  className?: string;
  children: ReactNode;
}

export function ExtBtn({ href, variant = "primary", size = "md", newTab = true, className = "", children }: ExtBtnProps) {
  return (
    <a href={href} className={btnClass(variant, size, className)} {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}
