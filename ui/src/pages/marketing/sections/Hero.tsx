import { Link } from "react-router-dom";
import heroBg from "../../../assets/landing/hero-bg.jpg";
import logoLight from "../../../assets/landing/logo-light.svg";

export function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center gap-8 overflow-hidden px-6 py-20 sm:px-20 sm:py-24">
      <div aria-hidden className="absolute inset-0">
        <img src={heroBg} alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-[rgba(10,10,10,0.45)]" />
      </div>

      <div className="relative flex flex-col items-center gap-4 text-center">
        <img src={logoLight} alt="Centoire" className="h-16 w-auto sm:h-20" />
        <p className="font-editorial max-w-2xl text-3xl italic text-white sm:text-4xl">
          Your Personal Edit of the World's Best Style
        </p>
        <p className="font-ui max-w-xl text-base leading-[1.6] text-white/90">
          Centoire curates the finest stories from Vogue, GQ, Harper's Bazaar, and more — tailored
          to your taste. Sign in to unlock your personalized feed.
        </p>
      </div>

      <div className="relative flex flex-col items-center gap-4">
        <Link
          to="/login"
          className="font-ui rounded bg-coral px-9 py-4 text-sm font-bold uppercase text-white transition-opacity hover:opacity-90"
        >
          Log In to Personalize
        </Link>
        {/* No route is genuinely guest-accessible today — everything under
            AppShell requires auth (see ProtectedRoute). This links to Discover
            so an unauthenticated visitor lands on /login and returns to
            Discover after signing in, rather than a dead/misleading link. */}
        <Link to="/discover" className="font-ui text-sm font-semibold text-white underline">
          Browse as Guest
        </Link>
      </div>
    </section>
  );
}
