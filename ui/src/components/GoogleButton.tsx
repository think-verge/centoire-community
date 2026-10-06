import { useEffect, useRef } from "react";
import { useGetGoogleConfig, useLoginWithGoogle } from "../lib/api/generated/auth/auth";
import { useAuth } from "../lib/auth-context";
import { usePostAuthRedirect } from "../lib/postAuth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: object) => void;
          renderButton: (el: HTMLElement, options: object) => void;
        };
      };
    };
  }
}

let gsiScriptPromise: Promise<void> | null = null;

export function loadGsiScript(): Promise<void> {
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google sign-in"));
      document.head.appendChild(script);
    });
  }
  return gsiScriptPromise;
}

export function GoogleButton() {
  const { data: config } = useGetGoogleConfig();
  const { refresh } = useAuth();
  const goAfterAuth = usePostAuthRedirect();
  const containerRef = useRef<HTMLDivElement>(null);
  const googleLogin = useLoginWithGoogle({
    mutation: {
      onSuccess: async () => {
        await refresh();
        goAfterAuth();
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
        size: "large",
        width: 360,
        text: "continue_with",
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.enabled, config?.clientId]);

  if (!config?.enabled) return null;

  return (
    <div>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={containerRef} className="flex justify-center" />
    </div>
  );
}
