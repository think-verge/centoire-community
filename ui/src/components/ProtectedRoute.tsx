import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";
import { getPendingCircleInvite, savePendingCircleInvite, normalizeCircleSlug } from "../lib/circleInviteStorage";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <span className="font-display-serif text-2xl text-ink-faint">Centoire</span>
      </div>
    );
  }
  if (!user) {
    const searchParams = new URLSearchParams(location.search);
    const inviteToken = searchParams.get("invite");
    if (inviteToken) {
      return <Navigate to={`/invite/${inviteToken}`} replace />;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function OnboardingGate() {
  const { user } = useAuth();
  const location = useLocation();

  if (user && !user.onboardingCompleted && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  if (user?.onboardingCompleted && location.pathname === "/onboarding") {
    const searchParams = new URLSearchParams(location.search);
    const inviteParam = searchParams.get("invite");
    const slugParam = searchParams.get("slug");
    if (inviteParam && slugParam) {
      savePendingCircleInvite(inviteParam, slugParam);
    }
    const pending = getPendingCircleInvite();
    const targetSlug = normalizeCircleSlug(pending?.slug || slugParam) || null;
    if (targetSlug) {
      const token = pending?.token || inviteParam || "";
      const destination = token ? `/c/${targetSlug}?invite=${token}` : `/c/${targetSlug}`;
      return <Navigate to={destination} replace />;
    }
    return <Navigate to="/feed" replace />;
  }
  return <Outlet />;
}
