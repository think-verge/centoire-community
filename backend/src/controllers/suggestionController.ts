import type { Request, Response } from "express";
import * as suggestionService from "../services/suggestionService.js";
import type { SuggestionTargetType } from "../models/SuggestionFeedback.js";
import { emitDomainEvent } from "../events/eventBus.js";

export async function getCircles(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { limit } = (req.validatedQuery ?? {}) as { limit?: number };
  const result = await suggestionService.getSuggestedCircles(userId, limit ?? 10);
  res.json(result);
}

export async function getCreators(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { limit } = (req.validatedQuery ?? {}) as { limit?: number };
  const result = await suggestionService.getSuggestedCreators(userId, limit ?? 10);
  res.json(result);
}

export async function dismiss(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { targetType, targetId } = req.body as {
    targetType: SuggestionTargetType;
    targetId: string;
  };

  const result = await suggestionService.dismissSuggestion(userId, targetType, targetId);

  // Emit event if event bus is active
  try {
    emitDomainEvent("suggestion.dismissed" as any, {
      userId,
      targetType,
      targetId,
      dismissedUntil: result.dismissedUntil,
    } as any);
  } catch {
    // Non-blocking
  }

  res.json(result);
}

export async function ignore(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { targetType, targetId } = req.body as {
    targetType: SuggestionTargetType;
    targetId: string;
  };

  const result = await suggestionService.ignoreSuggestion(userId, targetType, targetId);
  res.json(result);
}

export async function recordImpressions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { impressions } = req.body as {
    impressions: Array<{
      targetType: SuggestionTargetType;
      targetId: string;
      position: number;
      score?: number;
      reason?: string;
    }>;
  };

  for (const imp of impressions) {
    try {
      emitDomainEvent("suggestion.impression" as any, {
        userId,
        targetType: imp.targetType,
        targetId: imp.targetId,
        position: imp.position,
        reason: imp.reason,
      } as any);
    } catch {
      // Non-blocking event emission
    }
  }

  res.json({ status: "ok", loggedCount: impressions.length });
}
