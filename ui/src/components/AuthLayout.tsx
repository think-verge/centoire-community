import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function AuthLayout({ kicker, title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12">
      <Link to="/" className="font-display-serif mb-10 text-3xl font-bold tracking-tight">
        Centoire
      </Link>
      <div className="w-full max-w-md rounded-xl border border-line bg-paper p-8 shadow-card sm:p-10">
        <p className="kicker mb-2">{kicker}</p>
        <h1 className="font-display-serif text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
