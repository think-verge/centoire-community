import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthDrawer } from "../../components/auth/AuthDrawer";
import { useAuth } from "../../lib/auth-context";
import heroBg from "../../assets/landing/hero-bg.jpg";
import logoLight from "../../assets/landing/logo-light.svg";

export function ComingSoonPage() {
  const { user, isLoading } = useAuth();
  const [authDrawer, setAuthDrawer] = useState<{ open: boolean; step: "login" | "signup" }>({
    open: false,
    step: "login",
  });

  function openAuth(step: "login" | "signup") {
    setAuthDrawer({ open: true, step });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <span className="font-editorial text-2xl text-white/60">Centoire</span>
      </div>
    );
  }
  if (user) return <Navigate to="/feed" replace />;

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Background image + overlays */}
      <div aria-hidden className="absolute inset-0">
        <img
          src={heroBg}
          alt=""
          className="size-full object-cover object-top"
          style={{ animation: "fadein 1.4s ease-out both" }}
        />
        {/* dark base overlay */}
        <div className="absolute inset-0 bg-black/55" />
        {/* bottom vignette for depth */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" />
        {/* top vignette */}
        <div className="absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-black/30 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Logo — slides down */}
        <img
          src={logoLight}
          alt="Centoire"
          className="mb-2 h-10 w-auto"
          style={{ animation: "fadeSlideDown 0.9s cubic-bezier(0.22,1,0.36,1) 0.1s both" }}
        />

        {/* Overline */}
        <p
          className="font-ui text-xl font-extrabold tracking-[0.35em] uppercase text-[var(--color-coral)]"
          style={{ animation: "fadeSlideUp 0.8s cubic-bezier(0.22,1,0.36,1) 0.35s both" }}
        >
          Coming Soon
        </p>

        {/* Headline */}
        <h1
          className="font-editorial text-5xl italic text-white sm:text-6xl md:text-7xl"
          style={{ animation: "fadeSlideUp 0.9s cubic-bezier(0.22,1,0.36,1) 0.5s both" }}
        >
          The community for fashion & art.
        </h1>

        {/* Tagline */}
        <p
          className="font-ui mt-1 max-w-md text-base leading-relaxed text-white/75"
          style={{ animation: "fadeSlideUp 0.9s cubic-bezier(0.22,1,0.36,1) 0.7s both" }}
        >
          A curated space for style, culture, and the stories that shape them.
        </p>

        {/* Subtle bottom label — divider acts as easter egg trigger for team login */}
        <button
          type="button"
          onClick={() => openAuth("login")}
          className="mt-4 flex cursor-default flex-col items-center gap-3 focus:outline-none"
          aria-hidden="true"
          tabIndex={-1}
          style={{ animation: "fadein 1s ease-out 1s both" }}
        >
          <div className="h-px w-12 bg-white/20" />
          <span className="font-ui text-xs text-white/35 tracking-wide">Centoire · 2026</span>
        </button>
      </div>

      <AuthDrawer
        open={authDrawer.open}
        initialStep={authDrawer.step}
        onClose={() => setAuthDrawer((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}
