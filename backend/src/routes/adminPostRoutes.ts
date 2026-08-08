import { Router } from "express";
import * as adminPostController from "../controllers/adminPostController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

export const adminPostRouter = Router();

adminPostRouter.use(requireAuth, requireAdmin);

adminPostRouter.post("/backfill-categories", asyncHandler(adminPostController.backfillCategories));
