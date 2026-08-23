import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loadGsiScript } from "../GoogleButton";
import { useGetGoogleConfig, useLoginWithGoogle } from "../../lib/api/generated/auth/auth";
import { useAuth } from "../../lib/auth-context";

interface AuthDrawerSocialRowProps {
  mode: "login" | "signup";
}

const pillClass =
  "flex w-full items-center justify-center gap-2.5 rounded-lg border border-hairline bg-white px-4 py-2.5 text-sm font-semibold text-charcoal";

export function AuthDrawerSocialRow({ mode }: AuthDrawerSocialRowProps) {
  const verb = mode === "signup" ? "Sign up" : "Sign in";

  return (
    <div className="space-y-4">
      <GoogleSocialButton mode={mode} />
      <button type="button" className={`${pillClass} cursor-default opacity-60`} disabled>
        <AppleGlyph />
        {verb} with Apple
      </button>
      <button type="button" className={`${pillClass} cursor-default opacity-60`} disabled>
        <LinkedInGlyph />
        {verb} with LinkedIn
      </button>
    </div>
  );
}

function GoogleSocialButton({ mode }: { mode: "login" | "signup" }) {
  const { data: config } = useGetGoogleConfig();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const googleLogin = useLoginWithGoogle({
    mutation: {
      onSuccess: async () => {
        await refresh();
        navigate("/feed");
      },
    },
  });

  useEffect(() => {
    if (!config?.enabled || !config.clientId || !containerRef.current) return;
    let cancelled = false;
    loadGsiScript().then(() => {
      if (cancelled || !window.google || !containerRef.current) return;
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: (response: { credential: string }) => {
          googleLogin.mutate({ data: { idToken: response.credential } });
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        shape: "pill",
        size: "large",
        width: 360,
        text: mode === "signup" ? "signup_with" : "signin_with",
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.enabled, config?.clientId, mode]);

  if (!config?.enabled) {
    const verb = mode === "signup" ? "Sign up" : "Sign in";
    return (
      <button type="button" className={`${pillClass} cursor-default opacity-60`} disabled>
        <GoogleGlyph />
        {verb} with Google
      </button>
    );
  }

  return <div ref={containerRef} className="flex justify-center [&>div]:w-full" />;
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.42-.22-2.05H12v3.9h6.63c-.13 1.1-.86 2.76-2.47 3.87l-.02.15 3.59 2.78.25.02c2.28-2.1 3.54-5.2 3.54-8.67Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.06 7.94-2.87l-3.79-2.94c-1.02.71-2.4 1.21-4.15 1.21-3.16 0-5.84-2.09-6.79-4.98l-.14.01-3.73 2.88-.05.13C3.28 21.3 7.29 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.21 14.42a7.63 7.63 0 0 1-.41-2.42c0-.84.15-1.65.4-2.42l-.01-.16-3.78-2.94-.12.06A11.94 11.94 0 0 0 0 12c0 1.93.47 3.76 1.29 5.36l3.92-2.94Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c2.26 0 3.78.97 4.65 1.79l3.39-3.31C17.94 1.19 15.24 0 12 0 7.29 0 3.28 2.7 1.29 6.64l3.91 2.94C6.16 6.84 8.84 4.75 12 4.75Z"
      />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-charcoal" aria-hidden>
      <path d="M16.36 1.5c.1 1.03-.28 2.02-.95 2.79-.7.8-1.75 1.36-2.78 1.28-.12-1 .32-2.05 1-2.79.72-.82 1.9-1.4 2.73-1.28ZM19.9 17.36c-.55 1.24-.82 1.8-1.53 2.9-.99 1.53-2.39 3.44-4.13 3.46-1.55.02-1.95-1-4.05-.99-2.09.01-2.54 1.02-4.1 1-1.74-.02-3.06-1.75-4.05-3.28C-.94 16.34-1.4 11.29.79 8.5c1.14-1.45 2.94-2.36 4.63-2.38 1.62-.02 2.63 1.1 4.03 1.1 1.35 0 2.13-1.12 4.05-1.1 1.11.02 2.83.53 3.9 2.03-.28.18-2.33 1.36-2.3 4.04.03 3.21 2.8 4.14 2.8 4.17Z" />
    </svg>
  );
}

function LinkedInGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M7.12 9.44H4.4v9.65h2.72V9.44Zm-1.36-4.37a1.58 1.58 0 1 0 0 3.15 1.58 1.58 0 0 0 0-3.15ZM19.6 13.66c0-2.66-1.42-3.9-3.32-3.9-1.53 0-2.21.85-2.6 1.45V9.44H11v9.65h2.72v-5.39c0-.29.02-.58.11-.79.24-.58.78-1.19 1.68-1.19 1.18 0 1.66.9 1.66 2.22v5.15h2.72l-.29-5.47Z"
      />
    </svg>
  );
}
