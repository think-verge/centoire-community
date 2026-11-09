import { Router, type Request, type Response } from "express";

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export const forYouRouter = Router();

forYouRouter.get("/", (req: Request, res: Response) => {
  const user = (req as AuthRequest).user;
  res.json({
    status: "ok",
    service: "recsys",
    authenticated: !!user,
    user: user ?? null,
    items: [],
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
