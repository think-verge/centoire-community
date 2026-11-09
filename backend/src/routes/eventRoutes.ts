import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as eventController from "../controllers/eventController.js";
import { optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { EventBatchInputSchema } from "../schemas/events.js";
import { asyncHandler } from "../utils/async-handler.js";

const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120, // 120 batch requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many event batches, please slow down" },
});

export const eventRouter = Router();

eventRouter.post(
  "/",
  eventLimiter,
  optionalAuth,
  validate({ body: EventBatchInputSchema }),
  asyncHandler(eventController.ingestEvents),
);
