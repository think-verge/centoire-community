import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { GoogleButton } from "../../components/GoogleButton";
import { useSignup } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";

export function SignupPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });

  useEffect(() => {
    if (user) navigate("/feed", { replace: true });
  }, [user, navigate]);
  const signup = useSignup({
    mutation: {
      onSuccess: async () => {
        await refresh();
        navigate("/feed");
      },
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    signup.mutate({ data: form });
  }

  return (
    <AuthLayout
      kicker="Join the community"
      title="Create your account"
      subtitle="Free forever — feed, circles, publishing, and reputation."
    >
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
        <Link to="/login" className="font-semibold text-crimson hover:text-crimson-deep">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
