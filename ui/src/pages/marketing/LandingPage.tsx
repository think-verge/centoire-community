import { useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthDrawer } from "../../components/auth/AuthDrawer";
import { useAuth } from "../../lib/auth-context";
import { Navbar } from "./sections/Navbar";
import { Hero } from "./sections/Hero";
import { ValuePropsStrip } from "./sections/ValuePropsStrip";
import { EditorialPicks } from "./sections/EditorialPicks";
import { MustReads } from "./sections/MustReads";
import { LatestShowcases } from "./sections/LatestShowcases";
import { TwoColumnGrid } from "./sections/TwoColumnGrid";
import { InfluencerDiaries } from "./sections/InfluencerDiaries";
import { FromGQ } from "./sections/FromGQ";
import { NewsletterSignup } from "./sections/NewsletterSignup";
import { Footer } from "./sections/Footer";

export function LandingPage() {
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
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <span className="font-display-serif text-2xl text-ink-faint">Centoire</span>
      </div>
    );
  }
  if (user) return <Navigate to="/feed" replace />;

  return (
    <main className="min-h-screen bg-white">
      <Navbar onOpenAuth={openAuth} />
      <Hero onOpenAuth={openAuth} />
      <ValuePropsStrip />
      <EditorialPicks />
      <MustReads />
      <LatestShowcases />
      <TwoColumnGrid />
      <InfluencerDiaries />
      <FromGQ />
      <NewsletterSignup />
      <Footer />
      <AuthDrawer
        open={authDrawer.open}
        initialStep={authDrawer.step}
        onClose={() => setAuthDrawer((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}
