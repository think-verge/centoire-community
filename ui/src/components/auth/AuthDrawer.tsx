import { useEffect, useState } from "react";
import logoDark from "../../assets/landing/logo-dark.svg";
import { AuthDrawerCheckEmailStep } from "./AuthDrawerCheckEmailStep";
import { AuthDrawerLoginStep } from "./AuthDrawerLoginStep";
import { AuthDrawerSignupStep } from "./AuthDrawerSignupStep";

export type AuthDrawerStep = "login" | "signup" | "check-email";

interface AuthDrawerProps {
  open: boolean;
  initialStep: "login" | "signup";
  onClose: () => void;
}

export function AuthDrawer({ open, initialStep, onClose }: AuthDrawerProps) {
  const [step, setStep] = useState<AuthDrawerStep>(initialStep);
  const [signupEmail, setSignupEmail] = useState("");

  // Reset to the entry step whenever the drawer is (re)opened from a fresh trigger.
  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={step === "login" ? "Log in" : "Create your account"}
        className="relative ml-auto flex h-full w-full max-w-[640px] flex-col overflow-y-auto bg-blush px-8 py-10 shadow-2xl sm:px-14"
      >
        <div className="flex items-center justify-between">
          <img src={logoDark} alt="Centoire" className="h-8 w-auto" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-charcoal hover:opacity-70"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="mt-12 flex-1">
          {step === "login" && (
            <AuthDrawerLoginStep onClose={onClose} onSwitchToSignup={() => setStep("signup")} />
          )}
          {step === "signup" && (
            <AuthDrawerSignupStep
              onSwitchToLogin={() => setStep("login")}
              onSignedUp={(email) => {
                setSignupEmail(email);
                setStep("check-email");
              }}
            />
          )}
          {step === "check-email" && <AuthDrawerCheckEmailStep email={signupEmail} />}
        </div>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
