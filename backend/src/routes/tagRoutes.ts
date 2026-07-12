import { Router } from "express";
import * as tagController from "../controllers/tagController.js";
import { validate } from "../middleware/validate.js";
import { TagListQuerySchema } from "../schemas/community.js";
import { asyncHandler } from "../utils/async-handler.js";

export const tagRouter = Router();

tagRouter.get("/", validate({ query: TagListQuerySchema }), asyncHandler(tagController.list));
tagRouter.get("/:slug", asyncHandler(tagController.getBySlug));
