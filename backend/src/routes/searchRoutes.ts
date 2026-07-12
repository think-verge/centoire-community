import { Router } from "express";
import * as searchController from "../controllers/searchController.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { SearchQuerySchema } from "../schemas/search.js";
import { asyncHandler } from "../utils/async-handler.js";

export const searchRouter = Router();

searchRouter.get(
  "/",
  optionalAuth,
  validate({ query: SearchQuerySchema }),
  asyncHandler(searchController.search),
);
