import type { Request, Response } from "express";
import * as eventService from "../services/eventService.js";

export async function ingestEvents(req: Request, res: Response): Promise<void> {
  const events = req.body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ detail: "events array must contain between 1 and 100 items" });
    return;
  }

  const userId = req.user?.userId;
  const result = await eventService.ingestEventBatch(events, userId);

  res.status(202).json(result);
}
