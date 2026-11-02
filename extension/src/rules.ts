import { ruleDomainFor } from "@centoire/contracts";

export const STRIPPED_HEADERS = ["X-Frame-Options", "Content-Security-Policy"] as const;

/**
 * Session rule that lets the article load in a frame: for sub-frame requests in ONE tab
 * and ONE site only, drop the headers that forbid being framed. Nothing else is touched.
 */
export function buildFrameRule(id: number, tabId: number, domains: string[]): chrome.declarativeNetRequest.Rule {
  return {
    id,
    priority: 1,
    condition: {
      tabIds: [tabId],
      resourceTypes: ["sub_frame" as chrome.declarativeNetRequest.ResourceType],
      requestDomains: domains,
    },
    action: {
      type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
      responseHeaders: STRIPPED_HEADERS.map((header) => ({
        header,
        operation: "remove" as chrome.declarativeNetRequest.HeaderOperation,
      })),
    },
  };
}

/** Domains for the rule: the target's, plus wherever it redirects to (same-site navigation inside the frame keeps working). */
export function ruleDomains(target: string, finalUrl?: string): string[] {
  const out = new Set<string>();
  for (const u of [target, finalUrl]) {
    const d = u ? ruleDomainFor(u) : null;
    if (d) out.add(d);
  }
  return [...out];
}
