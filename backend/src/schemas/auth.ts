import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";

export const TagRefSchema = registry.register(
  "TagRef",
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
);

export const PublicUserSchema = registry.register(
  "PublicUser",
  z.object({
    id: z.string(),
    handle: z.string().nullable(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
    reputation: z.number(),
    followerCount: z.number(),
    followingCount: z.number(),
    postCount: z.number(),
    createdAt: z.string(),
  }),
);

export const CurrentUserSchema = registry.register(
  "CurrentUser",
  PublicUserSchema.extend({
    email: z.string(),
    role: z.enum(["member", "admin"]),
    emailVerified: z.boolean(),
    onboardingCompleted: z.boolean(),
    interests: z.array(TagRefSchema),
  }),
);

export const SignupInputSchema = registry.register(
  "SignupInput",
  z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    displayName: z.string().min(1).max(60),
  }),
);

export const LoginInputSchema = registry.register(
  "LoginInput",
  z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
);

export const GoogleLoginInputSchema = registry.register(
  "GoogleLoginInput",
  z.object({ idToken: z.string().min(1) }),
);

export const VerifyEmailInputSchema = registry.register(
  "VerifyEmailInput",
  z.object({ token: z.string().min(1) }),
);

export const ForgotPasswordInputSchema = registry.register(
  "ForgotPasswordInput",
  z.object({ email: z.string().email() }),
);

export const ResetPasswordInputSchema = registry.register(
  "ResetPasswordInput",
  z.object({ token: z.string().min(1), password: z.string().min(8).max(128) }),
);

const SentSchema = registry.register("Sent", z.object({ sent: z.boolean() }));

const GoogleConfigSchema = registry.register(
  "GoogleConfig",
  z.object({ enabled: z.boolean(), clientId: z.string().nullable() }),
);

export function registerAuthPaths(): void {
  registry.registerPath({
    method: "post",
    path: "/auth/signup",
    tags: ["auth"],
    operationId: "signup",
    request: { body: jsonBody(SignupInputSchema) },
    responses: {
      201: jsonResponse("Account created; session cookie set", CurrentUserSchema),
      409: errorResponse("Email already registered"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/auth/login",
    tags: ["auth"],
    operationId: "login",
    request: { body: jsonBody(LoginInputSchema) },
    responses: {
      200: jsonResponse("Logged in; session cookie set", CurrentUserSchema),
      401: errorResponse("Invalid credentials"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/auth/google",
    tags: ["auth"],
    operationId: "loginWithGoogle",
    request: { body: jsonBody(GoogleLoginInputSchema) },
    responses: {
      200: jsonResponse("Logged in; session cookie set", CurrentUserSchema),
      401: errorResponse("Google token invalid"),
    },
  });
  registry.registerPath({
    method: "get",
    path: "/auth/google/config",
    tags: ["auth"],
    operationId: "getGoogleConfig",
    responses: { 200: jsonResponse("Whether Google sign-in is available", GoogleConfigSchema) },
  });
  registry.registerPath({
    method: "post",
    path: "/auth/logout",
    tags: ["auth"],
    operationId: "logout",
    responses: { 204: { description: "Session cleared" } },
  });
  registry.registerPath({
    method: "get",
    path: "/auth/me",
    tags: ["auth"],
    operationId: "getAuthMe",
    responses: {
      200: jsonResponse("Current user", CurrentUserSchema),
      401: errorResponse("Not authenticated"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/auth/verify-email",
    tags: ["auth"],
    operationId: "verifyEmail",
    request: { body: jsonBody(VerifyEmailInputSchema) },
    responses: {
      200: jsonResponse("Email verified", CurrentUserSchema),
      400: errorResponse("Invalid or expired token"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/auth/resend-verification",
    tags: ["auth"],
    operationId: "resendVerification",
    responses: { 202: jsonResponse("Verification email queued", SentSchema) },
  });
  registry.registerPath({
    method: "post",
    path: "/auth/forgot-password",
    tags: ["auth"],
    operationId: "forgotPassword",
    request: { body: jsonBody(ForgotPasswordInputSchema) },
    responses: { 202: jsonResponse("Reset email queued if the account exists", SentSchema) },
  });
  registry.registerPath({
    method: "post",
    path: "/auth/reset-password",
    tags: ["auth"],
    operationId: "resetPassword",
    request: { body: jsonBody(ResetPasswordInputSchema) },
    responses: {
      200: jsonResponse("Password updated; session cookie set", CurrentUserSchema),
      400: errorResponse("Invalid or expired token"),
    },
  });
}
