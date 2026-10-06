import { useEffect, type ReactNode } from "react";
import { useSession } from "@centoire/web-platform";
import { goToLogin } from "../lib/auth";
import { Spinner } from "./Feedback";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession();
  useEffect(() => {
    if (!isLoading && !user) goToLogin();
  }, [isLoading, user]);
  if (isLoading) return <Spinner label="Checking your session" />;
  if (!user) return <p className="py-16 text-center font-ui text-[14px] text-[var(--color-stone)]">Redirecting to sign in…</p>;
  return <>{children}</>;
}

export function RequirePermission({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  if (!allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-editorial text-[28px] font-bold italic text-[var(--color-charcoal)]">Not available</h1>
        <p className="mt-2 font-ui text-[14px] text-[var(--color-stone)]">Your account does not have access to this area.</p>
      </div>
    );
  }
  return <>{children}</>;
}
