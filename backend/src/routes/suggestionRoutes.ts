import { Router } from "express";
import * as suggestionController from "../controllers/suggestionController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  SuggestionDismissBodySchema,
  SuggestionIgnoreBodySchema,
  SuggestionImpressionsBodySchema,
  SuggestionsQuerySchema,
} from "../schemas/suggestions.js";
import { asyncHandler } from "../utils/async-handler.js";

export const suggestionRouter = Router();

suggestionRouter.get(
  "/circles",
  requireAuth,
  validate({ query: SuggestionsQuerySchema }),
  asyncHandler(suggestionController.getCircles),
);

suggestionRouter.get(
  "/creators",
  requireAuth,
  validate({ query: SuggestionsQuerySchema }),
  asyncHandler(suggestionController.getCreators),
);

suggestionRouter.post(
  "/dismiss",
  requireAuth,
  validate({ body: SuggestionDismissBodySchema }),
  asyncHandler(suggestionController.dismiss),
);

suggestionRouter.post(
  "/ignore",
  requireAuth,
  validate({ body: SuggestionIgnoreBodySchema }),
  asyncHandler(suggestionController.ignore),
);

suggestionRouter.post(
  "/impressions",
  requireAuth,
  validate({ body: SuggestionImpressionsBodySchema }),
  asyncHandler(suggestionController.recordImpressions),
);
