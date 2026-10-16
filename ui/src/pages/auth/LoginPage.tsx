import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { GoogleButton } from "../../components/GoogleButton";
import { useLogin } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";
import {
  getPendingCircleInvite,
  clearPendingCircleInvite,
  savePendingCircleInvite,
  normalizeCircleSlug,
} from "../../lib/circleInviteStorage";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const slugParam = normalizeCircleSlug(searchParams.get("slug"));
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });

  // Save invite to storage so post-login flow can accept it
  useEffect(() => {
    if (inviteToken && slugParam) {
      savePendingCircleInvite(inviteToken, slugParam);
    }
  }, [inviteToken, slugParam]);

  useEffect(() => {
    if (user) {
      if (!user.onboardingCompleted) {
        navigate(
          inviteToken && slugParam
            ? `/onboarding?invite=${inviteToken}&slug=${slugParam}`
            : "/onboarding",
          { replace: true },
        );
        return;
      }
      const pending = getPendingCircleInvite();
      const targetSlug = normalizeCircleSlug(pending?.slug || slugParam);
      if (targetSlug) {
        clearPendingCircleInvite();
        navigate(`/c/${targetSlug}`, { replace: true });
        return;
      }
      navigate("/feed", { replace: true });
    }
  }, [user, navigate, inviteToken, slugParam]);

  const login = useLogin({
    mutation: {
      onSuccess: async () => {
        await refresh();
        const pending = getPendingCircleInvite();
        const effectiveToken = pending?.token || inviteToken;
        const effectiveSlug = normalizeCircleSlug(pending?.slug || slugParam);

        // If user still needs onboarding, leave pending invite in storage and navigate to onboarding
        if (user && !user.onboardingCompleted) {
          navigate(
            effectiveToken && effectiveSlug
              ? `/onboarding?invite=${effectiveToken}&slug=${effectiveSlug}`
              : "/onboarding",
            { replace: true },
          );
          return;
        }

        if (effectiveSlug) {
          const destination = effectiveToken
            ? `/c/${effectiveSlug}?invite=${effectiveToken}`
            : `/c/${effectiveSlug}`;
          navigate(destination, { replace: true });
          return;
        }
        navigate("/feed", { replace: true });
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ data: form });
  }

  return (
    <AuthLayout kicker="Welcome back" title="Log in">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Email"
          type="email"
          placeholder="you@studio.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Field
          label="Password"
          type="password"
          placeholder="Your password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {login.error && <p className="text-sm text-crimson">{login.error.message}</p>}
        <Button type="submit" loading={login.isPending} className="w-full">
          Log in
        </Button>
      </form>
      <GoogleButton />
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="text-ink-soft hover:text-ink">
          Forgot password?
        </Link>
        <Link
          to={inviteToken && slugParam ? `/signup?invite=${inviteToken}&slug=${slugParam}` : "/signup"}
          className="font-semibold text-crimson hover:text-crimson-deep"
        >
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
}
