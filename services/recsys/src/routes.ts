import { Router, type Request, type Response } from "express";

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export const forYouRouter = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";

forYouRouter.get("/", async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  const userId = user?.userId || (req.headers && req.headers["x-user-id"] ? (req.headers["x-user-id"] as string) : undefined);
  const cursor = req.query?.cursor as string | undefined;
  const limit = req.query?.limit as string | undefined;

  if (!userId) {
    res.json({
      status: "ok",
      service: "recsys",
      authenticated: false,
      user: null,
      items: [],
      nextCursor: null,
      cursor: null,
      hasMore: false,
    });
    return;
  }

  try {
    const q = new URLSearchParams();
    if (cursor) q.set("cursor", cursor);
    if (limit) q.set("limit", limit);

    const coreUrl = `${CORE_BACKEND_URL}/api/v1/feed/for-you${q.toString() ? `?${q.toString()}` : ""}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const resp = await fetch(coreUrl, {
      signal: controller.signal,
      headers: {
        "x-user-id": userId,
        "x-user-role": user?.role ?? "user",
        "x-user-email": user?.email ?? "",
        "x-internal-secret": process.env.INTERNAL_SECRET || "dev-internal-secret",
        "x-gateway-secret": process.env.INTERNAL_SECRET || "dev-internal-secret",
        cookie: req.headers.cookie ?? "",
      },
    });
    clearTimeout(timer);

    if (resp.ok) {
      const data = (await resp.json()) as { items?: unknown[]; nextCursor?: string | null };
      res.json({
        status: "ok",
        service: "recsys",
        authenticated: true,
        user: user ?? null,
        items: data.items || [],
        nextCursor: data.nextCursor || null,
        cursor: data.nextCursor || null,
        hasMore: !!data.nextCursor,
      });
      return;
    }
  } catch (err) {
    console.warn(`[recsys] core backend feed call failed: ${(err as Error).message}`);
  }

  // Graceful fallback response
  res.json({
    status: "ok",
    service: "recsys",
    authenticated: !!user,
    user: user ?? null,
    items: [],
    nextCursor: null,
    cursor: null,
    hasMore: false,
  });
});

const CORE_BACKEND_URL = process.env.CORE_BACKEND_URL ?? "http://localhost:8000";

export const suggestionsRouter = Router();

suggestionsRouter.get("/", (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  res.json({
    status: "ok",
    service: "recsys",
    authenticated: !!user,
    user: user ?? null,
    circles: [],
    creators: [],
  });
});

suggestionsRouter.get("/circles", async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.userId) {
    res.json({ items: [], count: 0 });
    return;
  }
  try {
    const limit = req.query.limit ?? 10;
    const resp = await fetch(`${CORE_BACKEND_URL}/api/v1/suggestions/circles?limit=${limit}`, {
      headers: {
        "x-user-id": user.userId,
        "x-user-role": user.role ?? "member",
        "x-user-email": user.email ?? "",
        cookie: req.headers.cookie ?? "",
      },
    });
    if (resp.ok) {
      const data = await resp.json();
      res.json(data);
      return;
    }
  } catch {
    // fallback
  }
  res.json({ items: [], count: 0 });
});

suggestionsRouter.get("/creators", async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.userId) {
    res.json({ items: [], count: 0 });
    return;
  }
  try {
    const limit = req.query.limit ?? 10;
    const resp = await fetch(`${CORE_BACKEND_URL}/api/v1/suggestions/creators?limit=${limit}`, {
      headers: {
        "x-user-id": user.userId,
        "x-user-role": user.role ?? "member",
        "x-user-email": user.email ?? "",
        cookie: req.headers.cookie ?? "",
      },
    });
    if (resp.ok) {
      const data = await resp.json();
      res.json(data);
      return;
    }
  } catch {
    // fallback
  }
  res.json({ items: [], count: 0 });
});

suggestionsRouter.post("/dismiss", async (req: Request, res: Response) => {
  const user = req.user;
  if (!user?.userId) {
    res.status(401).json({ detail: "Authentication required" });
    return;
  }
  try {
    const resp = await fetch(`${CORE_BACKEND_URL}/api/v1/suggestions/dismiss`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": user.userId,
        "x-user-role": user.role ?? "member",
        "x-user-email": user.email ?? "",
        "x-internal-secret": process.env.INTERNAL_SECRET || "dev-internal-secret",
        "x-gateway-secret": process.env.INTERNAL_SECRET || "dev-internal-secret",
        cookie: req.headers.cookie ?? "",
      },
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
    return;
  } catch (err) {
    res.status(502).json({ detail: (err as Error).message });
  }
});

export const internalRecsysRouter = Router();

internalRecsysRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "recsys",
    mode: "node-bahamut",
  });
});

internalRecsysRouter.post("/topic-mix/:userId/seed", (req: Request, res: Response) => {
  const { userId } = req.params;
  const { domains } = req.body as { domains?: string[] };
  res.json({
    status: "ok",
    service: "recsys",
    userId,
    domains: domains ?? [],
  });
});
