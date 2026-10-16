import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { GoogleButton } from "../../components/GoogleButton";
import { useGetInvitePreview, useSignup } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";
import { customInstance } from "../../lib/api/http";
import {
  getPendingCircleInvite,
  savePendingCircleInvite,
  normalizeCircleSlug,
} from "../../lib/circleInviteStorage";

const ROLE_LABELS: Record<string, string> = {
  creator: "Creator",
  editor: "Editor",
  admin: "Admin",
};

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite") ?? "";
  const slugParam = normalizeCircleSlug(searchParams.get("slug"));

  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });

  // Only run the admin invite preview when there's no slug param.
  // If slugParam is present, it's a circle invite token — a different system.
  const { data: invitePreview } = useGetInvitePreview(inviteToken, {
    query: { enabled: Boolean(inviteToken) && !slugParam },
  });

  // If token and slug are in query params, save immediately
  useEffect(() => {
    if (inviteToken && slugParam) {
      savePendingCircleInvite(inviteToken, slugParam);
    }
  }, [inviteToken, slugParam]);

  // Prefill email from a valid invite or circle invite
  useEffect(() => {
    if (invitePreview?.valid && invitePreview.email) {
      setForm((prev) => ({ ...prev, email: invitePreview.email }));
    } else {
      const activeToken = inviteToken || getPendingCircleInvite()?.token;
      if (activeToken) {
        customInstance<{ email?: string; valid?: boolean; circleSlug?: string }>({
          url: `/circles/invites/${activeToken}/preview`,
          method: "GET",
        })
          .then((res) => {
            if (res?.email) {
              setForm((prev) => ({ ...prev, email: res.email || prev.email }));
            }
            const cleanSlug = normalizeCircleSlug(res?.circleSlug);
            if (cleanSlug) {
              savePendingCircleInvite(activeToken, cleanSlug);
            }
          })
          .catch(() => {
            // ignore
          });
      }
    }
  }, [invitePreview, inviteToken]);

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
        navigate(`/c/${targetSlug}`, { replace: true });
        return;
      }
      navigate("/feed", { replace: true });
    }
  }, [user, navigate, inviteToken, slugParam]);

  const signup = useSignup({
    mutation: {
      onSuccess: async () => {
        await refresh();
        // User must complete onboarding first. We leave centoire_pending_circle_invite
        // in storage and pass in URL so OnboardingPage can accept the invite and redirect.
        navigate(
          inviteToken && slugParam
            ? `/onboarding?invite=${inviteToken}&slug=${slugParam}`
            : "/onboarding",
        );
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    signup.mutate({
      data: {
        ...form,
        ...(inviteToken ? { inviteToken } : {}),
      },
    });
  }

  const inviteValid = invitePreview?.valid === true;
  const inviteRole = invitePreview?.role;

  return (
    <AuthLayout
      kicker="Join the community"
      title="Create your account"
      subtitle="Free forever — feed, circles, publishing, and reputation."
    >
      {inviteToken && inviteValid && inviteRole && (
        <div className="mb-4 rounded-lg border border-gold-tint bg-gold-tint px-4 py-3">
          <p className="text-sm font-semibold text-gold">
            You've been invited as a {ROLE_LABELS[inviteRole] ?? inviteRole}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            This role will be assigned to your account automatically.
          </p>
        </div>
      )}
      {inviteToken && invitePreview && !inviteValid && (
        <div className="mb-4 rounded-lg border border-crimson-tint bg-crimson-tint px-4 py-3">
          <p className="text-sm font-semibold text-crimson">This invite is no longer valid.</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            You can still sign up as a regular member.
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Name"
          placeholder="How should we introduce you?"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          required
          maxLength={60}
        />
        <Field
          label="Email"
          type="email"
          placeholder="you@studio.com"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          readOnly={inviteValid}
        />
        <Field
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          minLength={8}
        />
        {signup.error && <p className="text-sm text-crimson">{signup.error.message}</p>}
        <Button type="submit" loading={signup.isPending} className="w-full">
          Create account
        </Button>
      </form>
      <GoogleButton />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already a member?{" "}
        <Link
          to={inviteToken && slugParam ? `/login?invite=${inviteToken}&slug=${slugParam}` : "/login"}
          className="font-semibold text-crimson hover:text-crimson-deep"
        >
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
