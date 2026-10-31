import { asyncHandler, defineIdentity, requireUser, type Context, type Processor } from "@centoire/bahamut";
import { Router } from "express";
import { z } from "zod";
import { serialize } from "./serialize.js";
import * as service from "./service.js";

export const NotificationIdentity = defineIdentity({
  name: "notification",
  category: "notifications",
  package: "notifications",
  auth: { retrieveMany: "user" },
  schemas: { query: z.object({ cursor: z.string().optional() }) },
});

// GET /notifications — the only CRUD operation; the rest are actions, mounted as custom routes.
export const notificationProcessor: Processor = {
  async processRetrieveMany(ctx: Context) {
    const { cursor } = ctx.query as { cursor?: string };
    const page = await service.listForUser(ctx.claims!.userId, cursor);
    ctx.setOutput({ items: page.items.map(serialize), nextCursor: page.nextCursor });
  },
};

export const actionRouter = Router();
actionRouter.use(requireUser);
actionRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    res.json({ count: await service.unreadCount(req.user!.userId) });
  }),
);
actionRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    await service.markAllRead(req.user!.userId);
    res.status(204).end();
  }),
);
actionRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    await service.markRead(req.user!.userId, req.params.id as string);
    res.status(204).end();
  }),
);
