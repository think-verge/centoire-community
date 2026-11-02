// Protocol shared by the Centoire web app and the Centoire Reader browser extension.
// Keep this file dependency-free: it is bundled into the extension and the web app.

/** Sent by the web app via chrome.runtime.sendMessage(extensionId, …) to detect the extension. */
export const READER_PING = "centoire-reader/ping";
/** Dev builds only: returns the background worker's recent log lines. */
export const READER_DEBUG = "centoire-reader/debug";

export interface ReaderPingResponse {
  ok: true;
  version: string;
  /** Whether the optional "read other sites" permission has already been granted. */
  permissionGranted: boolean;
}

/** postMessage events from the extension's frame page to the embedding Centoire page. */
export const READER_FRAME_SOURCE = "centoire-reader-frame";

export type ReaderErrorReason =
  | "invalid-target"
  | "untrusted-parent"
  | "permission-denied"
  | "enable-failed"
  | "load-timeout";

export type ReaderFrameEvent =
  | { source: typeof READER_FRAME_SOURCE; type: "needs-permission" }
  | { source: typeof READER_FRAME_SOURCE; type: "loading" }
  | { source: typeof READER_FRAME_SOURCE; type: "loaded"; target: string }
  | { source: typeof READER_FRAME_SOURCE; type: "error"; reason: ReaderErrorReason; detail?: string }
  /** Dev builds only: progress breadcrumbs from the frame, for diagnosing a stuck reader. */
  | { source: typeof READER_FRAME_SOURCE; type: "debug"; note: string };

/** frame page <-> background service worker (long-lived port). */
export const READER_PORT_NAME = "centoire-reader";
export type ReaderPortRequest = { type: "enable"; target: string } | { type: "keepalive" };
export type ReaderPortResponse =
  | { type: "enabled"; target: string }
  | { type: "failed"; reason: ReaderErrorReason; detail?: string };

export const READER_QUERY = { target: "target", parentOrigin: "parentOrigin" } as const;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Origin allow-list matching. Patterns look like "https://centoire.com",
 * "https://*.centoire.com" (any subdomain) or "http://localhost:*" (any port).
 */
export function isAllowedOrigin(origin: string, patterns: readonly string[]): boolean {
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  if (o.origin === "null") return false;
  return patterns.some((pattern) => {
    const m = /^(https?):\/\/([^/:]+)(?::(\*|\d+))?$/.exec(pattern);
    if (!m) return false;
    const [, protocol, host, port] = m;
    if (o.protocol !== `${protocol}:`) return false;
    const hostOk = host!.startsWith("*.")
      ? o.hostname.endsWith(host!.slice(1)) && o.hostname.length > host!.length - 1
      : o.hostname === host;
    if (!hostOk) return false;
    if (port === "*") return true;
    return (o.port || (o.protocol === "https:" ? "443" : "80")) === (port ?? (protocol === "https" ? "443" : "80"));
  });
}

export function buildReaderFrameSrc(opts: { extensionId: string; target: string; parentOrigin: string }): string {
  const q = new URLSearchParams({
    [READER_QUERY.target]: opts.target,
    [READER_QUERY.parentOrigin]: opts.parentOrigin,
  });
  return `chrome-extension://${opts.extensionId}/frame.html?${q.toString()}`;
}

/** Domain used to scope the header-removal rule: the host without a leading "www." (subdomains match too). */
export function ruleDomainFor(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Stable id of the unpacked dev build (extension/src/dev-key.json). The Web Store build gets its own id. */
export const READER_DEV_EXTENSION_ID = "llmagdcpngphkhcjbjdncbbcdgoeploe";
