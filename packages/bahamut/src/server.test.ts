import type { AddressInfo } from "node:net";
import http from "node:http";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createBus } from "./bus.js";
import { loadServiceConfig } from "./config.js";
import { defineIdentity } from "./identity.js";
import { createServer } from "./server.js";

const config = { ...loadServiceConfig("kit-test", { port: 0 }), jwtSecret: "s", gatewaySecret: "gw", internalSecret: "int" };
const Widget = defineIdentity({
  name: "widget",
  category: "widgets",
  package: "kit-test",
  auth: { retrieveMany: "none", delete: "admin" },
  schemas: { create: z.object({ name: z.string().min(1) }) },
});

let base = "";
let httpServer: http.Server;
const emitted: Array<[string, unknown]> = [];

beforeAll(async () => {
  const bus = await createBus<Record<string, unknown>>({ service: "kit-test" });
  await bus.on("widget.created", (p) => void emitted.push(["widget.created", p]));
  const server = createServer({ config, bus: bus as never });
  const items: Array<{ id: string; name: string }> = [];
  server.registerProcessor(Widget, {
    async processRetrieveMany(ctx) {
      ctx.setOutput({ items });
    },
    async processCreate(ctx) {
      const w = { id: String(items.length + 1), name: (ctx.body as { name: string }).name };
      items.push(w);
      ctx.pushEvent("widget.created", { by: ctx.claims?.userId, ...w });
      ctx.setOutput(w);
    },
    async processDelete(ctx) {
      ctx.setOutput(undefined);
    },
  });
  // run() would bind config.port; bind an ephemeral port on the same app instead.
  httpServer = http.createServer(server.build());
  await new Promise<void>((r) => httpServer.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}/api/v1`;
});
afterAll(() => void httpServer.close());

const token = (role: string) => jwt.sign({ userId: "u1", email: "u@x.dev", role }, "s");

describe("dispatch pipeline", () => {
  it("serves public operations without auth", async () => {
    const res = await fetch(`${base}/widgets`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it("rejects unauthenticated create with the {detail} shape", async () => {
    const res = await fetch(`${base}/widgets`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: "Authentication required" });
  });

  it("validates the body (422) and then creates (201) and publishes the queued event", async () => {
    const h = { "content-type": "application/json", cookie: `token=${token("member")}` };
    const bad = await fetch(`${base}/widgets`, { method: "POST", headers: h, body: JSON.stringify({ name: "" }) });
    expect(bad.status).toBe(422);
    const ok = await fetch(`${base}/widgets`, { method: "POST", headers: h, body: JSON.stringify({ name: "w" }) });
    expect(ok.status).toBe(201);
    expect(emitted).toEqual([["widget.created", { by: "u1", id: "1", name: "w" }]]);
  });

  it("enforces admin-only operations and returns 204 for empty output", async () => {
    const member = await fetch(`${base}/widgets/1`, { method: "DELETE", headers: { cookie: `token=${token("member")}` } });
    expect(member.status).toBe(403);
    const admin = await fetch(`${base}/widgets/1`, { method: "DELETE", headers: { cookie: `token=${token("admin")}` } });
    expect(admin.status).toBe(204);
  });

  it("returns 404 for operations the processor does not implement", async () => {
    const res = await fetch(`${base}/widgets/1`, { headers: { cookie: `token=${token("member")}` } });
    expect(res.status).toBe(404);
  });

  it("trusts forwarded claims only with the gateway secret", async () => {
    const spoof = await fetch(`${base}/widgets`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": "evil", "x-user-role": "admin" }, body: JSON.stringify({ name: "x" }) });
    expect(spoof.status).toBe(401);
    const trusted = await fetch(`${base}/widgets`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": "u9", "x-gateway-secret": "gw" }, body: JSON.stringify({ name: "y" }) });
    expect(trusted.status).toBe(201);
  });
});
