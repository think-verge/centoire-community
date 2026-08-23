import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field } from "../Field";
import { useLogin } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";
import { AuthDrawerSocialRow } from "./AuthDrawerSocialRow";
import { CoralButton } from "./CoralButton";

interface AuthDrawerLoginStepProps {
  onClose: () => void;
  onSwitchToSignup: () => void;
}

export function AuthDrawerLoginStep({ onClose, onSwitchToSignup }: AuthDrawerLoginStepProps) {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });

  const login = useLogin({
    mutation: {
      onSuccess: async () => {
        await refresh();
        onClose();
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ data: form });
  }

  return (
    <div>
      <p className="kicker mb-2">Welcome back</p>
      <h2 className="font-display-serif text-3xl font-semibold text-charcoal">Log In</h2>
      <p className="mt-2 text-sm text-stone">Continue curating with the global fashion network.</p>

      <div className="mt-10">
        <AuthDrawerSocialRow mode="login" />

        <div className="my-8 flex items-center gap-3">
          <span className="h-px flex-1 bg-hairline" />
          <span className="text-xs text-taupe">OR</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
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
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {login.error && <p className="text-sm text-crimson">{login.error.message}</p>}
          <CoralButton type="submit" loading={login.isPending}>
            Log In
          </CoralButton>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link to="/forgot-password" onClick={onClose} className="text-stone hover:text-charcoal">
            Forgot password?
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-stone">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="font-semibold text-charcoal underline"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}
