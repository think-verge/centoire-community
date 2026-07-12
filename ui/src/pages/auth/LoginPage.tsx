import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { GoogleButton } from "../../components/GoogleButton";
import { useLogin } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";

export function LoginPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (user) navigate("/feed", { replace: true });
  }, [user, navigate]);
  const login = useLogin({
    mutation: {
      onSuccess: async () => {
        await refresh();
        navigate("/feed");
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
        <Link to="/signup" className="font-semibold text-crimson hover:text-crimson-deep">
          Create account
        </Link>
      </div>
    </AuthLayout>
  );
}
