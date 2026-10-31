import {
  READER_DEV_EXTENSION_ID,
  READER_PING,
  isHttpUrl,
  type ReaderPingResponse,
} from "@centoire/contracts";
import { useEffect, useState } from "react";

// Comma-separated ids: the Chrome Web Store id and the Edge Add-ons id differ. Dev builds default to the pinned dev id.
const IDS = (import.meta.env.VITE_READER_EXTENSION_IDS ?? (import.meta.env.DEV ? READER_DEV_EXTENSION_ID : ""))
  .split(",")
  .map((s: string) => s.trim())
  .filter(Boolean);

export const READER_ENABLED = import.meta.env.VITE_READER_EXTENSION !== "false" && IDS.length > 0;
export const READER_INSTALL_URL: string | undefined = import.meta.env.VITE_READER_EXTENSION_URL || undefined;

export interface ReaderExtension {
  status: "checking" | "available" | "unavailable";
  extensionId?: string;
  permissionGranted?: boolean;
}

interface ChromeRuntime {
  sendMessage(id: string, message: unknown, cb: (res?: ReaderPingResponse) => void): void;
  lastError?: unknown;
}

const UNAVAILABLE: ReaderExtension = { status: "unavailable" };
let detection: Promise<ReaderExtension> | undefined;

function detect(): Promise<ReaderExtension> {
  const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
  if (!READER_ENABLED || typeof runtime?.sendMessage !== "function") return Promise.resolve(UNAVAILABLE);

  return new Promise((resolve) => {
    let pending = IDS.length;
    let settled = false;
    const finish = (r: ReaderExtension) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish(UNAVAILABLE), 1500);
    const miss = () => {
      if (--pending === 0) finish(UNAVAILABLE);
    };
    for (const id of IDS) {
      try {
        runtime.sendMessage(id, { type: READER_PING }, (res) => {
          void runtime.lastError; // reading it silences "could not establish connection" for ids that are not installed
          if (res?.ok) finish({ status: "available", extensionId: id, permissionGranted: res.permissionGranted });
          else miss();
        });
      } catch {
        miss();
      }
    }
  });
}

/** Detects the Centoire Reader extension once per page load, and again when the tab regains focus after a miss. */
export function useReaderExtension(): ReaderExtension {
  const [state, setState] = useState<ReaderExtension>({ status: READER_ENABLED ? "checking" : "unavailable" });

  useEffect(() => {
    if (!READER_ENABLED) return;
    let cancelled = false;
    const run = () => {
      detection ??= detect();
      void detection.then((r) => {
        if (!cancelled) setState(r);
      });
    };
    run();
    // A user who just installed the extension in another tab should not need to reload.
    const onFocus = () => {
      if (detection) {
        void detection.then((r) => {
          if (r.status === "unavailable") {
            detection = undefined;
            run();
          }
        });
      }
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return state;
}

/** Chromium desktop is the only place the extension can run; used to decide whether to suggest installing it. */
export function canInstallReader(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Chrome\/|Edg\//.test(navigator.userAgent) && !/Mobi|Android/.test(navigator.userAgent);
}

export function useReadPost(post: { externalUrl?: string | null } | undefined) {
  const extension = useReaderExtension();
  const [open, setOpen] = useState(false);
  const canEmbed = extension.status === "available" && !!post?.externalUrl && isHttpUrl(post.externalUrl);

  /** onClick for the "Read post" anchor. With the extension it opens the reader; otherwise the anchor's own href (new tab via /r/:id) runs. */
  function read(e?: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault(): void }) {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0)) return; // user asked for a new tab
    if (!canEmbed) return;
    e?.preventDefault();
    setOpen(true);
  }

  return { extension, canEmbed, open, read, close: () => setOpen(false) };
}
