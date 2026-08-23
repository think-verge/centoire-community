import { useState } from "react";
import { useResendVerification } from "../../lib/api/generated/auth/auth";
import { CoralButton } from "./CoralButton";

interface AuthDrawerCheckEmailStepProps {
  email: string;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visibleStart = local.slice(0, 2);
  const visibleEnd = local.length > 5 ? local.slice(-3) : "";
  return `${visibleStart}${"*".repeat(Math.max(local.length - visibleStart.length - visibleEnd.length, 3))}${visibleEnd}@${domain}`;
}

export function AuthDrawerCheckEmailStep({ email }: AuthDrawerCheckEmailStepProps) {
  const [resent, setResent] = useState(false);
  const resend = useResendVerification({
    mutation: { onSuccess: () => setResent(true) },
  });

  return (
    <div className="flex flex-col items-center text-center">
      <p className="kicker mb-2">Check your Email</p>
      <h2 className="font-display-serif text-3xl font-semibold text-charcoal">Check your Email</h2>
      <p className="mt-4 text-sm text-stone">
        We've sent a verification link to your email. Please open the link in the email to verify
        your account.
      </p>
      {email && <p className="mt-3 text-sm font-semibold text-charcoal">{maskEmail(email)}</p>}

      <div className="mt-10 w-full">
        <CoralButton type="button" className="w-full" onClick={() => window.location.assign("mailto:")}>
          Open Email App
        </CoralButton>
      </div>

      <p className="mt-6 text-sm text-stone">
        Didn't receive the email?{" "}
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="font-semibold text-charcoal underline disabled:opacity-50"
        >
          {resent ? "Sent" : "Resend"}
        </button>
      </p>
    </div>
  );
}
