import {
  READER_FRAME_SOURCE,
  READER_PORT_NAME,
  READER_QUERY,
  isAllowedOrigin,
  isHttpUrl,
  type ReaderErrorReason,
  type ReaderFrameEvent,
  type ReaderPortRequest,
  type ReaderPortResponse,
} from "@centoire/contracts";
import { DEBUG, ORIGINS, PERMS } from "./config.js";

const LOAD_TIMEOUT_MS = 12_000;
const KEEPALIVE_MS = 20_000;
const ENABLE_TIMEOUT_MS = 8_000; // the background worker must answer well inside the app's own backstop

const params = new URLSearchParams(location.search);
const target = params.get(READER_QUERY.target) ?? "";
const claimedParent = params.get(READER_QUERY.parentOrigin) ?? "";
// The browser-reported embedder is the source of truth; the query param must merely agree with it.
const parentOrigin = location.ancestorOrigins?.[0] ?? "";
const parentTrusted = !!parentOrigin && parentOrigin === claimedParent && isAllowedOrigin(parentOrigin, ORIGINS);

// Omit<> on a union collapses it, so distribute it to keep each event's own fields.
type EventBody<E> = E extends unknown ? Omit<E, "source"> : never;

function emit(event: EventBody<ReaderFrameEvent>): void {
  if (!parentTrusted) return; // never talk to an origin we do not trust
  window.parent.postMessage({ source: READER_FRAME_SOURCE, ...event }, parentOrigin);
}
const fail = (reason: ReaderErrorReason, detail?: string) => emit({ type: "error", reason, detail });
const dbg = (note: string) => {
  if (DEBUG) emit({ type: "debug", note });
};

function waitForGrant(): Promise<boolean> {
  const prompt = document.getElementById("prompt")!;
  const button = document.getElementById("enable") as HTMLButtonElement;
  prompt.style.display = "flex";
  emit({ type: "needs-permission" });
  return new Promise((resolve) => {
    button.addEventListener(
      "click",
      async () => {
        button.disabled = true;
        // Must run from this click: browsers only show the permission dialog for a user gesture in an extension page.
        const granted = await chrome.permissions.request(PERMS).catch(() => false);
        prompt.style.display = "none";
        resolve(granted);
      },
      { once: true },
    );
  });
}

function openArticle(url: string): void {
  const iframe = document.createElement("iframe");
  iframe.id = "article";
  // No allow-top-navigation: a site's frame-busting script cannot hijack the Centoire tab.
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
  iframe.setAttribute("allow", "fullscreen; clipboard-write");
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  const timer = setTimeout(() => fail("load-timeout"), LOAD_TIMEOUT_MS);
  iframe.addEventListener("load", () => {
    clearTimeout(timer);
    emit({ type: "loaded", target: url });
  });
  iframe.src = url;
  document.body.appendChild(iframe);
}

async function main(): Promise<void> {
  if (!parentTrusted) return; // render nothing for untrusted embedders
  if (!isHttpUrl(target)) return fail("invalid-target");

  if (!(await chrome.permissions.contains(PERMS))) {
    if (!(await waitForGrant())) return fail("permission-denied");
  }

  emit({ type: "loading" });
  const port = chrome.runtime.connect({ name: READER_PORT_NAME });
  const send = (m: ReaderPortRequest) => port.postMessage(m);
  const enableTimer = setTimeout(() => {
    dbg("no answer from background worker");
    fail("enable-failed", "background worker did not respond");
  }, ENABLE_TIMEOUT_MS);
  port.onMessage.addListener((msg: ReaderPortResponse) => {
    clearTimeout(enableTimer);
    dbg(`background said ${msg.type}`);
    if (msg.type === "enabled") openArticle(msg.target);
    else fail(msg.reason, msg.detail);
  });
  port.onDisconnect.addListener(() => {
    clearTimeout(enableTimer);
    dbg(`port disconnected: ${chrome.runtime.lastError?.message ?? "no error"}`);
    fail("enable-failed", chrome.runtime.lastError?.message ?? "port disconnected");
  });
  dbg("sending enable");
  send({ type: "enable", target });
  // Keeps the service worker alive while the article is open; closing the frame disconnects the port,
  // which is what removes the header rule.
  setInterval(() => send({ type: "keepalive" }), KEEPALIVE_MS);
}

main().catch((err) => fail("enable-failed", err instanceof Error ? err.message : String(err)));
