import { Router } from "express";
import * as onboardingController from "../controllers/onboardingController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const onboardingRouter = Router();

onboardingRouter.get("/suggestions", requireAuth, asyncHandler(onboardingController.suggestions));
