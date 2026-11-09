import { describe, expect, it } from "vitest";
import { forYouRouter, suggestionsRouter, internalRecsysRouter } from "./routes.js";
import type { Request, Response } from "express";

function mockRes() {
  const state: { statusCode: number; data?: unknown } = { statusCode: 200 };
  const res: Partial<Response> = {
    status(code: number) {
      state.statusCode = code;
      return this as Response;
    },
    json(data: unknown) {
      state.data = data;
      return this as Response;
    },
  };
  return { res: res as Response, state };
}

describe("recsys routes", () => {
  it("forYouRouter returns empty skeleton feed and user claims if authenticated", async () => {
    const { res, state } = mockRes();
    const req = {
      user: { userId: "usr_123", email: "user@test.com", role: "member" },
      query: {},
      headers: {},
    } as unknown as Request;

    const layer = forYouRouter.stack.find((s) => s.route?.path === "/");
    expect(layer).toBeDefined();

    await layer!.route!.stack[0].handle(req, res, () => {});
    expect(state.data).toMatchObject({
      status: "ok",
      service: "recsys",
      authenticated: true,
      user: { userId: "usr_123", email: "user@test.com", role: "member" },
      items: [],
      cursor: null,
      hasMore: false,
    });
  });

  it("suggestionsRouter returns empty suggestions response", () => {
    const { res, state } = mockRes();
    const req = {} as unknown as Request;

    const layer = suggestionsRouter.stack.find((s) => s.route?.path === "/");
    expect(layer).toBeDefined();

    layer!.route!.stack[0].handle(req, res, () => {});
    expect(state.data).toEqual({
      status: "ok",
      service: "recsys",
      authenticated: false,
      user: null,
      circles: [],
      creators: [],
    });
  });

  it("internalRecsysRouter returns healthy status", () => {
    const { res, state } = mockRes();
    const req = {} as unknown as Request;

    const layer = internalRecsysRouter.stack.find((s) => s.route?.path === "/status");
    expect(layer).toBeDefined();

    layer!.route!.stack[0].handle(req, res, () => {});
    expect(state.data).toEqual({
      status: "healthy",
      service: "recsys",
      mode: "node-bahamut",
    });
  });

  it("internalRecsysRouter seeds topic mix for user", () => {
    const { res, state } = mockRes();
    const req = {
      params: { userId: "usr_123" },
      body: { domains: ["streetwear", "runway"] },
    } as unknown as Request;

    const layer = internalRecsysRouter.stack.find((s) => s.route?.path === "/topic-mix/:userId/seed");
    expect(layer).toBeDefined();

    layer!.route!.stack[0].handle(req, res, () => {});
    expect(state.data).toEqual({
      status: "ok",
      service: "recsys",
      userId: "usr_123",
      domains: ["streetwear", "runway"],
    });
  });
});
