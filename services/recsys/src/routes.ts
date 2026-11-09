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
