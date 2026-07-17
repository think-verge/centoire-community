import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";

export function LandingPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <span className="font-display-serif text-2xl text-ink-faint">Centoire</span>
      </div>
    );
  }
  if (user) return <Navigate to="/feed" replace />;

  return (
    <main className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-display-serif text-2xl font-bold tracking-tight">Centoire</span>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="px-3 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
          >
            Join free
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <p className="kicker">Community × intelligence for fashion</p>
        <h1 className="font-display-serif mt-4 text-5xl font-bold leading-[1.08] sm:text-6xl">
          The home for everyone
          <br />
          in fashion
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft">
          Discover what's next, find your people, and create in public. One personalized feed
          for all of fashion — aggregated, ranked, ad-light.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/signup"
            className="rounded-lg bg-crimson px-6 py-3 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
          >
            Start reading — it's free
          </Link>
          <Link
            to="/login"
            className="rounded-lg border border-line bg-paper px-6 py-3 text-sm font-semibold hover:border-ink-soft"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {[
          {
            title: "Discover Us",
            body: "A personalized feed of fashion's best — editorial, blogs, lookbooks, and member posts in one clean stream.",
          },
          {
            title: "Belong",
            body: "Circles, follows, and reputation around the niches you care about — from Japanese denim to bridal couture.",
          },
          {
            title: "Create",
            body: "Publish lookbooks, breakdowns, and essays to an audience that gets it. Contribution compounds into standing you carry.",
          },
        ].map((card) => (
          <div key={card.title} className="rounded-xl border border-line bg-paper p-6 shadow-card">
            <h2 className="font-display-serif text-2xl font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line px-6 py-8 text-center text-xs text-ink-faint">
        Centoire — community first, forever free to read.
      </footer>
    </main>
  );
}
