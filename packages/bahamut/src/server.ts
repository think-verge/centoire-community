import cookieParser from "cookie-parser";
import express, { type Express, type Request, type Response, type Router } from "express";
import type { Server as HttpServer } from "node:http";
import type { Bus } from "./bus.js";
import { requireAdminUser, requireUser, resolveClaims } from "./auth.js";
import type { ServiceConfig } from "./config.js";
import { ApiError, asyncHandler, errorHandler, notFoundHandler } from "./errors.js";
import type { Identity, Operation } from "./identity.js";
import { processorMethod, type Context, type Processor } from "./processor.js";
import { startRegistration, type RouteInfo } from "./registration.js";

export interface ServerOptions {
  config: ServiceConfig;
  bus?: Bus<any>;
  apiPrefix?: string;
  /** Extra route listing for custom routers mounted outside registerProcessor. */
}

export interface BahamutServer {
  readonly app: Express;
  registerProcessor(identity: Identity, processor: Processor): void;
  /** Escape hatch for non-CRUD routes (e.g. /notifications/unread-count, uploads, /internal). */
  mount(path: string, router: Router | express.RequestHandler, opts?: { private?: boolean }): void;
  routes(): RouteInfo[];
  /** Installs the 404/error handlers (idempotent) and returns the app; run() calls it. Useful for tests. */
  build(): Express;
  run(): Promise<void>;
  close(): Promise<void>;
}

export function createServer(opts: ServerOptions): BahamutServer {
  const { config, bus } = opts;
  const prefix = opts.apiPrefix ?? "/api/v1";
  const app = express();
  const routes = new Map<string, RouteInfo>();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(resolveClaims(config));
  app.get("/healthz", (_req, res) => void res.json({ status: "ok", service: config.name }));

  let finalized = false;
  const finalize = () => {
    if (finalized) return;
    finalized = true;
    app.use(notFoundHandler);
    app.use(errorHandler);
  };

  function addRoute(path: string, isPrivate?: boolean) {
    const existing = routes.get(path);
    routes.set(path, { path, private: existing ? existing.private && isPrivate : isPrivate });
  }

  function authFor(identity: Identity, op: Operation) {
    const level = identity.auth?.[op] ?? "user";
    return level === "none" ? [] : [level === "admin" ? requireAdminUser : requireUser];
  }

  function handler(identity: Identity, processor: Processor, op: Operation) {
    return asyncHandler(async (req: Request, res: Response) => {
      const method = processorMethod[op];
      const fn = processor[method] as ((ctx: Context) => Promise<void>) | undefined;
      if (!fn) throw new ApiError(501, "Not implemented");

      const schema = identity.schemas;
      const query = (schema?.query ? schema.query.parse(req.query) : req.query) as Record<string, unknown>;
      let body: unknown = req.body;
      if (op === "create" && schema?.create) body = schema.create.parse(req.body);
      if (op === "update" && schema?.update) body = schema.update.parse(req.body);

      const ctx: Context = {
        identity,
        op,
        id: req.params.id as string | undefined,
        parentId: req.params.parentId as string | undefined,
        query,
        body,
        claims: req.user,
        headers: req.headers,
        events: [],
        setOutput(value, status) {
          ctx.output = value;
          if (status) ctx.status = status;
        },
        pushEvent(name, payload) {
          ctx.events.push({ name, payload });
        },
      };

      await processor.authorize?.(ctx);
      await fn.call(processor, ctx);

      // Events are published only after the processor succeeded.
      for (const e of ctx.events) bus?.emit(e.name as never, e.payload as never);

      if (ctx.output === undefined) {
        res.status(ctx.status ?? (op === "create" ? 201 : 204)).end();
      } else {
        res.status(ctx.status ?? (op === "create" ? 201 : 200)).json(ctx.output);
      }
    });
  }

  const server: BahamutServer = {
    app,
    registerProcessor(identity, processor) {
      const base = identity.parent
        ? `/${identity.parent}/:parentId/${identity.category}`
        : `/${identity.category}`;
      const r = express.Router();
      const wire = (op: Operation, verb: "get" | "post" | "put" | "patch" | "delete", path: string) => {
        if (!processor[processorMethod[op]]) return;
        r[verb](path, ...authFor(identity, op), handler(identity, processor, op));
      };
      wire("retrieveMany", "get", base);
      wire("create", "post", base);
      if (!identity.parent) {
        wire("retrieve", "get", `${base}/:id`);
        wire("update", "put", `${base}/:id`);
        wire("update", "patch", `${base}/:id`);
        wire("delete", "delete", `${base}/:id`);
      }
      app.use(prefix, r);
      const isPrivate = identity.private && identity.private.length >= 5 ? true : undefined;
      addRoute(`${prefix}/${identity.parent ?? identity.category}`, isPrivate);
    },
    mount(path, router, o) {
      app.use(`${prefix}${path}`, router);
      addRoute(`${prefix}${path}`, o?.private);
    },
    routes: () => [...routes.values()],
    build() {
      finalize();
      return app;
    },
    async run() {
      finalize();
      // Bind first: announcing an address we failed to bind would route traffic into the void.
      const http = await new Promise<HttpServer>((resolve, reject) => {
        const s = app.listen(config.port, config.host, () => resolve(s));
        s.once("error", reject);
      });
      const registration = bus
        ? startRegistration(bus, { name: config.name, address: config.announceAddress, routes: server.routes })
        : undefined;
      console.log(`[${config.name}] listening on ${config.host}:${config.port} (bus: ${bus?.mode ?? "none"})`);
      const shutdown = async () => {
        registration?.stop();
        http.close();
        await bus?.close();
        process.exit(0);
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
      closer = async () => {
        registration?.stop();
        await new Promise((r) => http.close(r));
        await bus?.close();
      };
    },
    close: async () => closer(),
  };
  let closer: () => Promise<void> = async () => {};
  return server;
}

