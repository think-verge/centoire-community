import { describe, expect, it } from "vitest";
import { resolveReadTarget } from "../utils/readTarget.js";

describe("resolveReadTarget", () => {
  it("returns http(s) urls", () => {
    expect(resolveReadTarget("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(resolveReadTarget("http://example.com/")).toBe("http://example.com/");
  });

  it("rejects non-web schemes so the redirect can never run script or open files", () => {
    expect(resolveReadTarget("javascript:alert(1)")).toBeNull();
    expect(resolveReadTarget("data:text/html,<script>1</script>")).toBeNull();
    expect(resolveReadTarget("file:///etc/passwd")).toBeNull();
  });

  it("rejects missing or malformed values", () => {
    expect(resolveReadTarget(undefined)).toBeNull();
    expect(resolveReadTarget(null)).toBeNull();
    expect(resolveReadTarget("")).toBeNull();
    expect(resolveReadTarget("not a url")).toBeNull();
  });
});
