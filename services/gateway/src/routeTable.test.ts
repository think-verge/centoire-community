import { describe, expect, it } from "vitest";
import type { ServicePing } from "@centoire/bahamut";
import { RouteTable } from "./routeTable.js";

const ping = (name: string, id: string, paths: Array<string | [string, boolean]>, load = 0): ServicePing => ({
  type: "hello",
  instanceId: id,
  name,
  address: `http://${name}`,
  routes: paths.map((p) => (Array.isArray(p) ? { path: p[0], private: p[1] } : { path: p })),
  load,
  sentAt: 0,
});

describe("RouteTable", () => {
  it("prefers the longest prefix so extracted services win over the monolith", () => {
    const t = new RouteTable();
    t.apply(ping("core", "1", ["/api/v1"]));
    t.apply(ping("notifications", "2", ["/api/v1/notifications"]));
    expect(t.resolve("/api/v1/notifications/unread-count", { includePrivate: false })?.name).toBe("notifications");
    expect(t.resolve("/api/v1/feed/for-you", { includePrivate: false })?.name).toBe("core");
  });

  it("does not match a sibling that merely shares a string prefix", () => {
    const t = new RouteTable();
    t.apply(ping("core", "1", ["/api/v1"]));
    t.apply(ping("notifications", "2", ["/api/v1/notifications"]));
    expect(t.resolve("/api/v1/notificationsX", { includePrivate: false })?.name).toBe("core");
  });

  it("hides private routes from the public listener", () => {
    const t = new RouteTable();
    t.apply(ping("core", "1", [["/api/v1/internal", true]]));
    expect(t.resolve("/api/v1/internal/x", { includePrivate: false })).toBeUndefined();
    expect(t.resolve("/api/v1/internal/x", { includePrivate: true })?.name).toBe("core");
  });

  it("evicts instances that stop heartbeating and honours goodbye", () => {
    let now = 0;
    const t = new RouteTable(15_000, () => now);
    t.apply(ping("a", "1", ["/api/v1/a"]));
    now = 20_000;
    expect(t.resolve("/api/v1/a", { includePrivate: false })).toBeUndefined();
    t.apply(ping("a", "1", ["/api/v1/a"]));
    t.apply({ ...ping("a", "1", []), type: "goodbye" });
    expect(t.resolve("/api/v1/a", { includePrivate: false })).toBeUndefined();
  });

  it("balances between two instances by lower load", () => {
    const t = new RouteTable();
    t.apply(ping("s", "1", ["/api/v1/s"], 0.9));
    t.apply(ping("s", "2", ["/api/v1/s"], 0.1));
    expect(t.resolve("/api/v1/s", { includePrivate: false })?.instanceId).toBe("2");
  });

  it("fails closed on reserved prefixes when the owning service is down", () => {
    const t = new RouteTable();
    t.apply(ping("core", "1", ["/api/v1"]));
    const reserved = ["/api/v1/notifications"];
    expect(t.resolve("/api/v1/notifications", { includePrivate: false, reserved })).toBeUndefined();
    t.apply(ping("notifications", "2", ["/api/v1/notifications"]));
    expect(t.resolve("/api/v1/notifications/unread-count", { includePrivate: false, reserved })?.name).toBe("notifications");
    expect(t.resolve("/api/v1/feed", { includePrivate: false, reserved })?.name).toBe("core");
  });
});
