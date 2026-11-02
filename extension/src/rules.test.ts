import { describe, expect, it } from "vitest";
import { buildFrameRule, ruleDomains } from "./rules.js";

describe("buildFrameRule", () => {
  it("is scoped to one tab, sub-frames and the given domains, and only removes the two headers", () => {
    const rule = buildFrameRule(7, 42, ["freecodecamp.org"]);
    expect(rule.condition.tabIds).toEqual([42]);
    expect(rule.condition.resourceTypes).toEqual(["sub_frame"]);
    expect(rule.condition.requestDomains).toEqual(["freecodecamp.org"]);
    expect(rule.action.responseHeaders?.map((h) => [h.header, h.operation])).toEqual([
      ["X-Frame-Options", "remove"],
      ["Content-Security-Policy", "remove"],
    ]);
  });
});

describe("ruleDomains", () => {
  it("includes the redirect destination and dedupes", () => {
    expect(ruleDomains("https://www.a.com/x", "https://a.com/y")).toEqual(["a.com"]);
    expect(ruleDomains("https://a.com/x", "https://b.com/y")).toEqual(["a.com", "b.com"]);
    expect(ruleDomains("https://a.com/x")).toEqual(["a.com"]);
  });
});
