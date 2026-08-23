import { useState, type FormEvent } from "react";
import { Field } from "../Field";
import { useSignup } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";
import { AuthDrawerSocialRow } from "./AuthDrawerSocialRow";
import { CoralButton } from "./CoralButton";

interface AuthDrawerSignupStepProps {
  onSwitchToLogin: () => void;
  onSignedUp: (email: string) => void;
}

export function AuthDrawerSignupStep({ onSwitchToLogin, onSignedUp }: AuthDrawerSignupStepProps) {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });

  const signup = useSignup({
    mutation: {
      onSuccess: async () => {
        await refresh();
        onSignedUp(form.email);
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    signup.mutate({ data: form });
  }

  return (
    <div>
      <p className="kicker mb-2">Create your Account</p>
      <h2 className="font-display-serif text-3xl font-semibold text-charcoal">
        Create your Account
      </h2>
      <p className="mt-2 text-sm text-stone">Start curating with the global fashion network.</p>

      <div className="mt-10">
        <AuthDrawerSocialRow mode="signup" />

        <div className="my-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-xs text-taupe">OR</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            label="Name"
            placeholder="How should we introduce you?"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            required
            maxLength={60}
          />
          <Field
            label="Email address"
            type="email"
            placeholder="Enter your email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
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
          <CoralButton type="submit" loading={signup.isPending}>
            Sign Up
          </CoralButton>
        </form>

        <p className="mt-8 text-center text-sm text-stone">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold text-charcoal underline"
          >
            Log In
          </button>
        </p>
      </div>
    </div>
  );
}
