import {
  READER_DEBUG,
  READER_PING,
  READER_PORT_NAME,
  isAllowedOrigin,
  isHttpUrl,
  type ReaderPingResponse,
  type ReaderPortRequest,
  type ReaderPortResponse,
} from "@centoire/contracts";
import { DEBUG, ORIGINS, PERMS } from "./config.js";
import { buildFrameRule, ruleDomains } from "./rules.js";

// Dev builds keep a ring buffer of breadcrumbs (also readable by an allowed page via READER_DEBUG).
async function dbg(note: string): Promise<void> {
  if (!DEBUG) return;
  console.log("[reader]", note);
  const { log } = await chrome.storage.session.get("log");
  const lines = ((log as string[] | undefined) ?? []).slice(-39);
  lines.push(`${new Date().toISOString().slice(11, 23)} ${note}`);
  await chrome.storage.session.set({ log: lines });
}

const TTL_MS = 30 * 60 * 1000; // backstop: a rule never outlives this, even if cleanup events are missed
const GC_ALARM = "reader-gc";

interface RuleRecord {
  tabId: number;
  expiresAt: number;
}

// MV3 service workers are killed and restarted freely, so rule bookkeeping lives in storage.session.
async function getRules(): Promise<Record<string, RuleRecord>> {
  const { rules } = await chrome.storage.session.get("rules");
  return (rules as Record<string, RuleRecord> | undefined) ?? {};
}
const setRules = (rules: Record<string, RuleRecord>) => chrome.storage.session.set({ rules });

async function nextRuleId(): Promise<number> {
  const { nextId } = await chrome.storage.session.get("nextId");
  const id = (typeof nextId === "number" ? nextId : 1) as number;
  await chrome.storage.session.set({ nextId: id + 1 });
  return id;
}

async function addFrameRule(tabId: number, target: string): Promise<{ id: number; finalUrl: string }> {
  // Follow redirects first so the rule also covers where the article really lives (e.g. http -> https, bare -> www).
  let finalUrl = target;
  try {
    const res = await fetch(target, { redirect: "follow", credentials: "omit", signal: AbortSignal.timeout(6000) });
    if (isHttpUrl(res.url)) finalUrl = res.url;
    void res.body?.cancel();
  } catch {
    // fall back to the original URL
  }
  const id = await nextRuleId();
  await chrome.declarativeNetRequest.updateSessionRules({
    addRules: [buildFrameRule(id, tabId, ruleDomains(target, finalUrl))],
  });
  const rules = await getRules();
  rules[id] = { tabId, expiresAt: Date.now() + TTL_MS };
  await setRules(rules);
  return { id, finalUrl };
}

async function removeFrameRules(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: ids });
  const rules = await getRules();
  for (const id of ids) delete rules[id];
  await setRules(rules);
}

// Web app -> extension: "are you installed, and did the user already grant access?"
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!isAllowedOrigin(sender.origin ?? "", ORIGINS)) return false;
  const type = (message as { type?: string } | null)?.type;
  if (DEBUG && type === READER_DEBUG) {
    chrome.storage.session.get("log").then(({ log }) => sendResponse({ log: log ?? [] }));
    return true;
  }
  if (type !== READER_PING) return false;
  chrome.permissions.contains(PERMS).then((permissionGranted) => {
    const res: ReaderPingResponse = { ok: true, version: chrome.runtime.getManifest().version, permissionGranted };
    sendResponse(res);
  });
  return true; // async response
});

// frame.html (inside the Centoire tab) -> background: enable framing for this tab + article site.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== READER_PORT_NAME) return;
  const tabId = port.sender?.tab?.id;
  const send = (m: ReaderPortResponse) => port.postMessage(m);
  let ruleId: number | undefined;
  void dbg(`connect tab=${tabId} from=${(port.sender?.url ?? "").split("?")[0]}`);

  port.onMessage.addListener(async (msg: ReaderPortRequest) => {
    if (msg.type !== "enable") return; // keepalive just wakes the worker
    try {
      await dbg(`enable ${msg.target}`);
      if (tabId == null || !isHttpUrl(msg.target)) return send({ type: "failed", reason: "invalid-target" });
      if (!(await chrome.permissions.contains(PERMS))) return send({ type: "failed", reason: "permission-denied" });
      const { id, finalUrl } = await addFrameRule(tabId, msg.target);
      ruleId = id;
      await dbg(`rule ${id} added, final=${finalUrl}`);
      send({ type: "enabled", target: finalUrl });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      await dbg(`enable failed: ${detail}`);
      console.error("[reader] enable failed", err);
      send({ type: "failed", reason: "enable-failed", detail });
    }
  });

  port.onDisconnect.addListener(() => {
    void dbg(`disconnect rule=${ruleId}`);
    if (ruleId !== undefined) void removeFrameRules([ruleId]);
  });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const rules = await getRules();
  await removeFrameRules(Object.entries(rules).filter(([, r]) => r.tabId === tabId).map(([id]) => Number(id)));
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== GC_ALARM) return;
  const rules = await getRules();
  const now = Date.now();
  await removeFrameRules(Object.entries(rules).filter(([, r]) => r.expiresAt <= now).map(([id]) => Number(id)));
});

chrome.runtime.onInstalled.addListener(async () => {
  // Start clean: drop any rules left from a previous version.
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  await removeFrameRules(existing.map((r) => r.id));
  await chrome.alarms.create(GC_ALARM, { periodInMinutes: 5 });
});
