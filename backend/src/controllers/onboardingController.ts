import type { Request, Response } from "express";
import * as onboardingService from "../services/onboardingService.js";
import { serializeCircle } from "../services/circleService.js";
import { serializeUser } from "../services/userSerializer.js";

export async function suggestions(req: Request, res: Response): Promise<void> {
  const result = await onboardingService.getSuggestions(req.user!.userId);
  res.json({
    creators: result.creators.map((u) => serializeUser(u)),
    circles: result.circles.map((c) => serializeCircle(c)),
    followedCreatorIds: result.followedCreatorIds,
    joinedCircleIds: result.joinedCircleIds,
  });
}
