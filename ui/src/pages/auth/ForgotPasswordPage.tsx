import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { useForgotPassword } from "../../lib/api/generated/auth/auth";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const forgot = useForgotPassword();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    forgot.mutate({ data: { email } });
  }

  return (
    <AuthLayout
      kicker="Account recovery"
      title="Reset your password"
      subtitle="Enter your email and we'll send a reset link."
    >
      {forgot.isSuccess ? (
        <p className="text-sm text-ink-soft">
          If an account exists for <span className="font-medium text-ink">{email}</span>, a
          reset link is on its way. The link expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Email"
            type="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {forgot.error && <p className="text-sm text-crimson">{forgot.error.message}</p>}
          <Button type="submit" loading={forgot.isPending} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-ink-soft hover:text-ink">
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}
