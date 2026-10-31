import {
  claimsToHeaders,
  HDR_GATEWAY_SECRET,
  HDR_INTERNAL_SECRET,
  HDR_USER_EMAIL,
  HDR_USER_ID,
  HDR_USER_ROLE,
  verifyJwt,
  type ServiceConfig,
} from "@centoire/bahamut";
import cookieParser from "cookie-parser";
import express, { type Express, type Request, type Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { RouteTable } from "./routeTable.js";

type Mode = "public" | "private";

function buildListener(mode: Mode, table: RouteTable, cfg: ServiceConfig, reserved: string[]): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.get("/healthz", (_req, res) => void res.json({ status: "ok", service: "gateway", mode }));

  if (mode === "private") {
    app.get("/_meta/routes", (req, res) => {
      if (req.headers[HDR_INTERNAL_SECRET] !== cfg.internalSecret) return void res.status(401).json({ detail: "Internal secret required" });
      res.json(table.snapshot());
    });
  }

  // Identity at the edge.
  app.use((req: Request, res: Response, next) => {
    if (mode === "private") {
      if (req.headers[HDR_INTERNAL_SECRET] !== cfg.internalSecret) {
        return void res.status(401).json({ detail: "Internal secret required" });
      }
      return next();
    }
    // Public: never trust caller-supplied identity/secret headers.
    for (const h of [HDR_USER_ID, HDR_USER_EMAIL, HDR_USER_ROLE, HDR_GATEWAY_SECRET, HDR_INTERNAL_SECRET]) {
      delete req.headers[h];
    }
    const token = req.cookies?.token as string | undefined;
    const claims = token ? verifyJwt(token, cfg.jwtSecret) : undefined;
    if (claims) {
      Object.assign(req.headers, claimsToHeaders(claims));
      req.headers[HDR_GATEWAY_SECRET] = cfg.gatewaySecret;
    }
    next();
  });

  const proxy = createProxyMiddleware({
    target: "http://127.0.0.1:0",
    changeOrigin: false,
    xfwd: true,
    proxyTimeout: 120_000,
    timeout: 120_000,
    router: (req) => {
      const path = (req as Request).originalUrl.split("?")[0]!;
      return table.resolve(path, { includePrivate: mode === "private", reserved })?.address;
    },
    on: {
      error: (_err, _req, res) => {
        const r = res as Response;
        if (!r.headersSent && typeof r.status === "function") r.status(502).json({ detail: "Upstream unavailable" });
      },
    },
  });

  app.use((req: Request, res: Response, next) => {
    const path = req.originalUrl.split("?")[0]!;
    if (!table.resolve(path, { includePrivate: mode === "private", reserved })) {
      return void res.status(503).json({ detail: "No service registered for this route" });
    }
    next();
  });
  app.use(proxy);
  return app;
}

export const buildPublicListener = (t: RouteTable, c: ServiceConfig, reserved: string[] = []) =>
  buildListener("public", t, c, reserved);
export const buildPrivateListener = (t: RouteTable, c: ServiceConfig, reserved: string[] = []) =>
  buildListener("private", t, c, reserved);
