import { Router } from "express";
import * as sourceController from "../controllers/sourceController.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { CreateSourceInputSchema, UpdateSourceInputSchema } from "../schemas/sources.js";
import { asyncHandler } from "../utils/async-handler.js";

export const sourceRouter = Router();

sourceRouter.use(requireAuth, requireAdmin);

sourceRouter.get("/", asyncHandler(sourceController.list));
sourceRouter.post(
  "/",
  validate({ body: CreateSourceInputSchema }),
  asyncHandler(sourceController.create),
);
sourceRouter.patch(
  "/:id",
  validate({ body: UpdateSourceInputSchema }),
  asyncHandler(sourceController.update),
);
sourceRouter.delete("/:id", asyncHandler(sourceController.remove));
sourceRouter.post("/:id/fetch", asyncHandler(sourceController.fetchNow));
