import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { useResetPassword } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState("");
  const reset = useResetPassword({
    mutation: {
      onSuccess: async () => {
        await refresh();
        navigate("/feed");
      },
    },
  });

  if (!token) {
    return (
      <AuthLayout kicker="Account recovery" title="Link missing">
        <p className="text-sm text-ink-soft">
          This page needs a reset link from your email.{" "}
          <Link to="/forgot-password" className="font-semibold text-crimson">
            Request one
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout kicker="Account recovery" title="Choose a new password">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          reset.mutate({ data: { token, password } });
        }}
        className="space-y-4"
      >
        <Field
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {reset.error && <p className="text-sm text-crimson">{reset.error.message}</p>}
        <Button type="submit" loading={reset.isPending} className="w-full">
          Set new password
        </Button>
      </form>
    </AuthLayout>
  );
}
