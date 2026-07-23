import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as authController from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  ForgotPasswordInputSchema,
  GoogleLoginInputSchema,
  LoginInputSchema,
  ResetPasswordInputSchema,
  SignupInputSchema,
  VerifyEmailInputSchema,
} from "../schemas/auth.js";
import { asyncHandler } from "../utils/async-handler.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many attempts, try again later" },
});

export const authRouter = Router();

authRouter.post(
  "/signup",
  authLimiter,
  validate({ body: SignupInputSchema }),
  asyncHandler(authController.signup),
);
authRouter.post(
  "/login",
  authLimiter,
  validate({ body: LoginInputSchema }),
  asyncHandler(authController.login),
);
authRouter.post(
  "/google",
  authLimiter,
  validate({ body: GoogleLoginInputSchema }),
  asyncHandler(authController.google),
);
authRouter.get("/google/config", authController.googleEnabled);
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
authRouter.post(
  "/verify-email",
  validate({ body: VerifyEmailInputSchema }),
  asyncHandler(authController.verifyEmail),
);
authRouter.post(
  "/resend-verification",
  requireAuth,
  authLimiter,
  asyncHandler(authController.resendVerification),
);
authRouter.post(
  "/forgot-password",
  authLimiter,
  validate({ body: ForgotPasswordInputSchema }),
  asyncHandler(authController.forgotPassword),
);
authRouter.post(
  "/reset-password",
  authLimiter,
  validate({ body: ResetPasswordInputSchema }),
  asyncHandler(authController.resetPassword),
);
authRouter.get("/invite/:token", asyncHandler(authController.getInvitePreview));
