import { describe, expect, it } from "vitest";
import { buildReaderFrameSrc, isAllowedOrigin, isHttpUrl, ruleDomainFor } from "./reader.js";

const PATTERNS = ["https://centoire.com", "https://*.centoire.com", "http://localhost:*"];

describe("isAllowedOrigin", () => {
  it("accepts exact, subdomain and any-port localhost origins", () => {
    expect(isAllowedOrigin("https://centoire.com", PATTERNS)).toBe(true);
    expect(isAllowedOrigin("https://app.centoire.com", PATTERNS)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", PATTERNS)).toBe(true);
    expect(isAllowedOrigin("http://localhost", PATTERNS)).toBe(true);
  });

  it("rejects look-alikes, wrong schemes and opaque origins", () => {
    expect(isAllowedOrigin("https://centoire.com.evil.io", PATTERNS)).toBe(false);
    expect(isAllowedOrigin("https://evilcentoire.com", PATTERNS)).toBe(false);
    expect(isAllowedOrigin("http://centoire.com", PATTERNS)).toBe(false);
    expect(isAllowedOrigin("http://127.0.0.1:5173", PATTERNS)).toBe(false);
    expect(isAllowedOrigin("null", PATTERNS)).toBe(false);
    expect(isAllowedOrigin("", PATTERNS)).toBe(false);
  });

  it("does not let the bare apex satisfy a wildcard-only pattern", () => {
    expect(isAllowedOrigin("https://centoire.com", ["https://*.centoire.com"])).toBe(false);
  });
});

describe("helpers", () => {
  it("isHttpUrl only allows web urls", () => {
    expect(isHttpUrl("https://a.com/x")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("chrome-extension://abc/frame.html")).toBe(false);
    expect(isHttpUrl("nope")).toBe(false);
  });

  it("ruleDomainFor strips www and keeps other subdomains", () => {
    expect(ruleDomainFor("https://www.freecodecamp.org/news/x")).toBe("freecodecamp.org");
    expect(ruleDomainFor("https://blog.example.co.uk/p")).toBe("blog.example.co.uk");
    expect(ruleDomainFor("not a url")).toBeNull();
  });

  it("buildReaderFrameSrc encodes the target", () => {
    const src = buildReaderFrameSrc({ extensionId: "abc", target: "https://a.com/x?y=1&z=2", parentOrigin: "https://centoire.com" });
    expect(src.startsWith("chrome-extension://abc/frame.html?")).toBe(true);
    const q = new URL(src).searchParams;
    expect(q.get("target")).toBe("https://a.com/x?y=1&z=2");
    expect(q.get("parentOrigin")).toBe("https://centoire.com");
  });
});
