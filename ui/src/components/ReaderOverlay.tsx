import {
  READER_FRAME_SOURCE,
  buildReaderFrameSrc,
  type ReaderErrorReason,
  type ReaderFrameEvent,
} from "@centoire/contracts";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../lib/api/http";
import { readPostUrl } from "../lib/readPost";

const LOAD_TIMEOUT_MS = 20_000; // the frame itself times out at 12s; this is the web app's backstop

const ERROR_TEXT: Record<ReaderErrorReason, string> = {
  "invalid-target": "This link can't be opened here.",
  "untrusted-parent": "The reader refused to run on this page.",
  "permission-denied": "The reader needs permission to load the article here.",
  "enable-failed": "The reader couldn't prepare this site.",
  "load-timeout": "The article took too long to load.",
};

interface ReaderOverlayProps {
  post: { id: string; title: string; externalUrl: string };
  extensionId: string;
  onClose: () => void;
  /** Positioning: absolute inside a drawer, or fixed for a standalone page. */
  className?: string;
}

type Phase = "loading" | "needs-permission" | "ready" | { error: ReaderErrorReason | "timeout" };

// Dev-only trace of what the extension frame reported, so a stuck reader can be diagnosed from the page itself.
function trace(entry: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  try {
    const log = JSON.parse(sessionStorage.getItem("reader-log") ?? "[]") as unknown[];
    log.push({ t: Date.now() % 1_000_000, ...entry });
    sessionStorage.setItem("reader-log", JSON.stringify(log.slice(-50)));
  } catch {
    // tracing must never break the reader
  }
}

export function ReaderOverlay({ post, extensionId, onClose, className = "absolute inset-0 z-10" }: ReaderOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const hostname = useMemo(() => new URL(post.externalUrl).hostname.replace(/^www\./, ""), [post.externalUrl]);
  const src = useMemo(
    () => buildReaderFrameSrc({ extensionId, target: post.externalUrl, parentOrigin: window.location.origin }),
    [extensionId, post.externalUrl],
  );

  // Count the read; no redirect happens in this path, so the redirect endpoint's counter would miss it.
  useEffect(() => {
    void apiClient.post(`/r/${post.id}`, { mode: "reader" }).catch(() => {});
  }, [post.id]);

  // Frame -> page events. Accept only the extension's own origin AND our iframe's window.
  useEffect(() => {
    trace({ ev: "mounted" });
    function onMessage(e: MessageEvent) {
      const fromExt = e.origin === `chrome-extension://${extensionId}`;
      if (fromExt || (e.data && (e.data as { source?: string }).source === READER_FRAME_SOURCE)) {
        trace({ ev: "message", origin: e.origin, fromOurIframe: e.source === iframeRef.current?.contentWindow, data: e.data });
      }
      if (e.origin !== `chrome-extension://${extensionId}`) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const msg = e.data as ReaderFrameEvent | undefined;
      if (!msg || msg.source !== READER_FRAME_SOURCE) return;
      if (msg.type === "needs-permission") setPhase("needs-permission");
      else if (msg.type === "loading") setPhase("loading");
      else if (msg.type === "loaded") setPhase("ready");
      else if (msg.type === "error") setPhase({ error: msg.reason });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [extensionId, src]);

  useEffect(() => {
    if (phase === "ready" || phase === "needs-permission" || typeof phase === "object") return;
    const t = setTimeout(() => {
      trace({ ev: "app-timeout", phase });
      setPhase({ error: "timeout" });
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Esc closes the reader first, not the drawer behind it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const failed = typeof phase === "object";
  const message = failed ? (phase.error === "timeout" ? ERROR_TEXT["load-timeout"] : ERROR_TEXT[phase.error]) : null;

  return (
    <div className={`${className} flex flex-col bg-paper`} role="region" aria-label={`Reading ${post.title}`}>
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-soft hover:text-ink"
        >
          ← Back to discussion
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{post.title}</p>
          <p className="truncate text-xs text-ink-faint">{hostname}</p>
        </div>
        <a
          href={readPostUrl(post.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-ink-soft hover:text-ink"
        >
          Open original ↗
        </a>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {!failed && (
          <iframe
            ref={iframeRef}
            src={src}
            title={post.title}
            className="absolute inset-0 h-full w-full border-0"
            allow="fullscreen; clipboard-write"
          />
        )}
        {(phase === "loading") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-paper/80 text-sm text-ink-faint">
            Loading {hostname}…
          </div>
        )}
        {failed && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="max-w-sm text-ink-soft">{message} You can still read it on {hostname}.</p>
            <a
              href={readPostUrl(post.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
            >
              Open original ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
