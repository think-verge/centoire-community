import { Router } from "express";
import * as agentController from "../controllers/agentController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AgentSearchQueryInputSchema } from "../schemas/agent.js";
import { asyncHandler } from "../utils/async-handler.js";

export const agentRouter = Router();

agentRouter.post(
  "/search-query",
  requireAuth,
  validate({ body: AgentSearchQueryInputSchema }),
  asyncHandler(agentController.searchQuery),
);
