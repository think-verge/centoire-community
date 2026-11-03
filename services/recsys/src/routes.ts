import { Router, type Request, type Response } from "express";

export const forYouRouter = Router();

forYouRouter.get("/", (req: Request, res: Response) => {
  const user = req.user;
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
  const user = req.user;
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
