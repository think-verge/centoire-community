import { Router, type Request, type Response } from "express";

export const forYouRouter = Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";

forYouRouter.get("/", async (req: Request, res: Response) => {
  const user = req.user;
  const userId = user?.userId || (req.headers && req.headers["x-user-id"] ? (req.headers["x-user-id"] as string) : undefined);
  const cursor = req.query?.cursor as string | undefined;
  const limit = req.query?.limit as string | undefined;
  const rebuild = req.query?.rebuild === "true";

  if (!userId) {
    res.json({
      status: "ok",
      service: "recsys",
      authenticated: false,
      user: null,
      items: [],
      cursor: null,
      hasMore: false,
    });
    return;
  }

  try {
    const url = new URL(`${AI_SERVICE_URL}/v1/feed/for-you/${userId}`);
    if (cursor) url.searchParams.set("cursor", cursor);
    if (limit) url.searchParams.set("limit", limit);
    if (rebuild) url.searchParams.set("rebuild", "true");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000); // 2s timeout budget

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = (await response.json()) as {
        items?: Array<{ id: string; [key: string]: unknown }>;
        cursor?: string | null;
        hasMore?: boolean;
        cached?: boolean;
      };

      res.json({
        status: "ok",
        service: "recsys",
        authenticated: true,
        user,
        items: data.items || [],
        cursor: data.cursor || null,
        hasMore: !!data.hasMore,
        cached: !!data.cached,
      });
      return;
    }
  } catch (err) {
    console.warn(`[recsys] AI agent feed call failed: ${(err as Error).message}`);
  }

  // Graceful fallback response
  res.json({
    status: "ok",
    service: "recsys",
    authenticated: true,
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
