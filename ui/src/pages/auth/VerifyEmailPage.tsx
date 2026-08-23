import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { AuthWelcomePanel } from "../../components/auth/AuthWelcomePanel";
import {
  useResendVerification,
  useVerifyEmail,
} from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [verified, setVerified] = useState(false);
  const verify = useVerifyEmail({
    mutation: {
      onSuccess: async () => {
        await refresh();
        setVerified(true);
      },
    },
  });
  const resend = useResendVerification();

  useEffect(() => {
    if (token) {
      verify.mutate({ data: { token } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (verified || user?.emailVerified) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-12">
        <Link to="/" className="font-display-serif mb-10 text-3xl font-bold tracking-tight">
          Centoire
        </Link>
        <div className="w-full max-w-md rounded-xl bg-blush p-8 shadow-card sm:p-10">
          <AuthWelcomePanel onGetStarted={() => navigate("/onboarding")} />
        </div>
      </main>
    );
  }

  if (token) {
    return (
      <AuthLayout kicker="One moment" title="Verifying your email">
        {verify.isPending && <p className="text-sm text-ink-soft">Checking your link…</p>}
        {verify.error && (
          <div className="space-y-4">
            <p className="text-sm text-crimson">{verify.error.message}</p>
            <Link to="/verify-email" className="text-sm font-semibold text-crimson">
              Request a new link
            </Link>
          </div>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      kicker="Check your inbox"
      title="Verify your email"
      subtitle={
        user
          ? `We sent a verification link to ${user.email}. Verifying unlocks posting and commenting.`
          : "Open the verification link we emailed you to unlock posting and commenting."
      }
    >
      {user && (
        <div className="space-y-3">
          <Button
            variant="secondary"
            className="w-full"
            loading={resend.isPending}
            onClick={() => resend.mutate()}
          >
            {resend.isSuccess ? "Sent — check your inbox" : "Resend verification email"}
          </Button>
          <Link to="/feed" className="block text-center text-sm text-ink-soft hover:text-ink">
            Continue to your feed
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
