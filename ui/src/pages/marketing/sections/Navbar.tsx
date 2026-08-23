import { useState } from "react";
import { Link } from "react-router-dom";
import logoDark from "../../../assets/landing/logo-dark.svg";

const NAV_LINKS = ["Curation", "Essays", "Showcases", "Diaries", "Archive"];

interface NavbarProps {
  onOpenAuth: (step: "login" | "signup") => void;
}

export function Navbar({ onOpenAuth }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative flex items-center justify-between border-b border-hairline bg-white px-6 py-6 sm:px-20">
      <button
        type="button"
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        className="flex h-6 w-[34px] shrink-0 flex-col items-center justify-center gap-1 md:hidden"
      >
        <span className="h-[2px] w-[18px] bg-charcoal" />
        <span className="h-[2px] w-[18px] bg-charcoal" />
        <span className="h-[2px] w-[18px] bg-charcoal" />
      </button>

      <Link to="/" className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
        <img src={logoDark} alt="Centoire" className="h-10 w-auto" />
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
        {NAV_LINKS.map((label) => (
          <span key={label} className="font-ui cursor-default text-sm font-semibold text-stone">
            {label}
          </span>
        ))}
      </nav>

      <div className="hidden items-center gap-6 md:flex">
        <button
          type="button"
          onClick={() => onOpenAuth("login")}
          className="font-ui text-sm font-semibold text-charcoal underline"
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => onOpenAuth("signup")}
          className="font-ui rounded bg-coral px-6 py-2.5 text-[13px] font-bold uppercase text-white transition-opacity hover:opacity-90"
        >
          Subscribe
        </button>
      </div>

      {menuOpen && (
        <div className="absolute inset-x-0 top-full z-10 flex flex-col gap-4 border-b border-hairline bg-white px-6 py-6 md:hidden">
          {NAV_LINKS.map((label) => (
            <span key={label} className="font-ui text-sm font-semibold text-stone">
              {label}
            </span>
          ))}
          <div className="mt-2 flex items-center gap-6">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenAuth("login");
              }}
              className="font-ui text-sm font-semibold text-charcoal underline"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenAuth("signup");
              }}
              className="font-ui rounded bg-coral px-6 py-2.5 text-[13px] font-bold uppercase text-white"
            >
              Subscribe
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
