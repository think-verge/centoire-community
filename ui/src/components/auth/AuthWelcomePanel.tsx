import { CoralButton } from "./CoralButton";

interface AuthWelcomePanelProps {
  onGetStarted: () => void;
}

export function AuthWelcomePanel({ onGetStarted }: AuthWelcomePanelProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <VerifiedBadge className="size-20 text-coral" />
      <h2 className="font-display-serif mt-8 text-3xl font-semibold text-charcoal">
        Welcome to Centoire
      </h2>
      <p className="mt-4 max-w-xs text-sm text-stone">
        Your profile is verified. Step into the global fashion curating network to discover and
        save ultimate collections.
      </p>

      <div className="mt-10 w-full">
        <CoralButton type="button" onClick={onGetStarted}>
          Get Started
        </CoralButton>
      </div>

      <p className="mt-6 text-xs text-taupe">Terms of Service &amp; Privacy Policy apply</p>
    </div>
  );
}

function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      <path
        fill="currentColor"
        fillOpacity="0.18"
        d="M24 2 29 12 39.6 8.4 36 19 46 24 36 29 39.6 39.6 29 36 24 46 19 36 8.4 39.6 12 29 2 24 12 19 8.4 8.4 19 12 Z"
      />
      <path
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m17 24 5 5 9-11"
      />
    </svg>
  );
}
