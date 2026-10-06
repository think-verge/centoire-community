import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-error.js";
import { createErrorHandler } from "../error-handler.js";
import { requireAllowedOrigin } from "../origin.js";
import { readSessionToken } from "../session.js";

const req = (init: Partial<Request> & { origin?: string }) =>
  ({ method: "GET", cookies: {}, get: (h: string) => (h.toLowerCase() === "origin" ? init.origin : undefined), ...init }) as unknown as Request;

function run(handler: (r: Request, s: Response, n: () => void) => void, r: Request) {
  const next = vi.fn();
  let error: unknown;
  try {
    handler(r, {} as Response, next);
  } catch (e) {
    error = e;
  }
  return { next, error };
}

describe("requireAllowedOrigin", () => {
  const guard = requireAllowedOrigin(["https://centoire.com", "https://jobs.centoire.com/"]);

  it("lets safe methods through regardless of origin", () => {
    expect(run(guard, req({ method: "GET", origin: "https://evil.example" })).next).toHaveBeenCalled();
  });

  it("blocks state-changing requests from other origins", () => {
    const { error } = run(guard, req({ method: "POST", origin: "https://evil.example" }));
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
  });

  it("allows listed origins (trailing slash tolerated) and origin-less server calls", () => {
    expect(run(guard, req({ method: "POST", origin: "https://jobs.centoire.com" })).next).toHaveBeenCalled();
    expect(run(guard, req({ method: "DELETE" })).next).toHaveBeenCalled();
  });
});

describe("readSessionToken", () => {
  it("prefers the shared cookie over the legacy host-only one", () => {
    expect(readSessionToken(req({ cookies: { cnt_session: "new", token: "old" } }))).toBe("new");
    expect(readSessionToken(req({ cookies: { token: "old" } }))).toBe("old");
    expect(readSessionToken(req({ cookies: {} }))).toBeUndefined();
  });
});

describe("createErrorHandler", () => {
  const handler = createErrorHandler({ isProduction: true });
  const respond = (err: unknown) => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    handler(err, req({}), { status } as unknown as Response, () => undefined);
    return { status: status.mock.calls[0]?.[0], body: json.mock.calls[0]?.[0] };
  };

  it("maps ApiError, zod-shaped and mongoose input errors, hides everything else", () => {
    expect(respond(new ApiError(409, "dup"))).toEqual({ status: 409, body: { detail: "dup" } });
    const zod = Object.assign(new Error("z"), { name: "ZodError", issues: [{ path: ["name"], message: "Required" }] });
    expect(respond(zod)).toEqual({ status: 422, body: { detail: "name: Required" } });
    expect(respond(Object.assign(new Error("bad id"), { name: "CastError" })).status).toBe(422);
    expect(respond(new Error("db exploded"))).toEqual({ status: 500, body: { detail: "Internal server error" } });
  });
});
