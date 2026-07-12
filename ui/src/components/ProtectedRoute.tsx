import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

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
    return <Navigate to="/feed" replace />;
  }
  return <Outlet />;
}
