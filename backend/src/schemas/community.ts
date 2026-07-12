import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";
import { CurrentUserSchema, PublicUserSchema } from "./auth.js";
import { PostCardSchema } from "./posts.js";

export const TagSchema = registry.register(
  "Tag",
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    category: z.enum(["style", "craft", "business", "culture"]),
    description: z.string().nullable(),
    postCount: z.number(),
    followerCount: z.number(),
  }),
);

export const CircleSchema = registry.register(
  "Circle",
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    about: z.string().nullable(),
    rules: z.array(z.string()),
    avatarUrl: z.string().nullable(),
    coverImageUrl: z.string().nullable(),
    tags: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
    memberCount: z.number(),
    postCount: z.number(),
    viewerRole: z.enum(["owner", "moderator", "member"]).nullable(),
    createdAt: z.string(),
  }),
);

export const PublicProfileSchema = registry.register(
  "PublicProfile",
  PublicUserSchema.extend({ isFollowing: z.boolean() }),
);

export const UpdateMeInputSchema = registry.register(
  "UpdateMeInput",
  z.object({
    displayName: z.string().min(1).max(60).optional(),
    handle: z
      .string()
      .regex(/^[a-z0-9_]{3,24}$/, "3-24 chars: lowercase letters, numbers, underscores")
      .optional(),
    bio: z.string().max(160).optional(),
    avatarUrl: z.string().url().optional(),
  }),
);

export const SetInterestsInputSchema = registry.register(
  "SetInterestsInput",
  z.object({ tagIds: z.array(z.string()).min(1).max(20) }),
);

export const CreateCircleInputSchema = registry.register(
  "CreateCircleInput",
  z.object({
    name: z.string().min(3).max(60),
    description: z.string().min(1).max(160),
    about: z.string().max(4000).optional(),
    rules: z.array(z.string().max(300)).max(10).optional(),
    tagIds: z.array(z.string()).max(5).optional(),
    avatarUrl: z.string().url().optional(),
    coverImageUrl: z.string().url().optional(),
  }),
);

export const OnboardingSuggestionsSchema = registry.register(
  "OnboardingSuggestions",
  z.object({
    creators: z.array(PublicUserSchema),
    circles: z.array(CircleSchema),
    followedCreatorIds: z.array(z.string()),
    joinedCircleIds: z.array(z.string()),
  }),
);

export const TagListQuerySchema = z.object({
  category: z.enum(["style", "craft", "business", "culture"]).optional(),
});

export const CircleListQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
});

export function registerCommunityPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/tags",
    tags: ["tags"],
    operationId: "listTags",
    request: { query: TagListQuerySchema },
    responses: { 200: jsonResponse("All tags", z.array(TagSchema)) },
  });
  registry.registerPath({
    method: "get",
    path: "/tags/{slug}",
    tags: ["tags"],
    operationId: "getTag",
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: jsonResponse("Tag detail", TagSchema),
      404: errorResponse("Tag not found"),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/users/{handle}",
    tags: ["users"],
    operationId: "getUserByHandle",
    request: { params: z.object({ handle: z.string() }) },
    responses: {
      200: jsonResponse("Public profile", PublicProfileSchema),
      404: errorResponse("User not found"),
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/users/me",
    tags: ["users"],
    operationId: "updateMe",
    request: { body: jsonBody(UpdateMeInputSchema) },
    responses: {
      200: jsonResponse("Updated user", CurrentUserSchema),
      409: errorResponse("Handle taken or reserved"),
    },
  });
  registry.registerPath({
    method: "put",
    path: "/users/me/interests",
    tags: ["users"],
    operationId: "setInterests",
    request: { body: jsonBody(SetInterestsInputSchema) },
    responses: { 200: jsonResponse("Updated user", CurrentUserSchema) },
  });
  registry.registerPath({
    method: "post",
    path: "/users/me/complete-onboarding",
    tags: ["users"],
    operationId: "completeOnboarding",
    responses: {
      200: jsonResponse("Onboarding completed", CurrentUserSchema),
      422: errorResponse("Handle or interests missing"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/users/{id}/follow",
    tags: ["users"],
    operationId: "followUser",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Now following" }, 404: errorResponse("User not found") },
  });
  registry.registerPath({
    method: "delete",
    path: "/users/{id}/follow",
    tags: ["users"],
    operationId: "unfollowUser",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "No longer following" } },
  });

  registry.registerPath({
    method: "get",
    path: "/onboarding/suggestions",
    tags: ["onboarding"],
    operationId: "getOnboardingSuggestions",
    responses: { 200: jsonResponse("Suggested creators and circles", OnboardingSuggestionsSchema) },
  });

  registry.registerPath({
    method: "get",
    path: "/circles",
    tags: ["circles"],
    operationId: "listCircles",
    request: { query: CircleListQuerySchema },
    responses: { 200: jsonResponse("Circle directory", z.array(CircleSchema)) },
  });
  registry.registerPath({
    method: "post",
    path: "/circles",
    tags: ["circles"],
    operationId: "createCircle",
    request: { body: jsonBody(CreateCircleInputSchema) },
    responses: { 201: jsonResponse("Circle created", CircleSchema) },
  });
  registry.registerPath({
    method: "get",
    path: "/circles/{slug}",
    tags: ["circles"],
    operationId: "getCircle",
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: jsonResponse("Circle detail", CircleSchema),
      404: errorResponse("Circle not found"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/circles/{slug}/join",
    tags: ["circles"],
    operationId: "joinCircle",
    request: { params: z.object({ slug: z.string() }) },
    responses: { 204: { description: "Joined" }, 404: errorResponse("Circle not found") },
  });
  registry.registerPath({
    method: "delete",
    path: "/circles/{slug}/join",
    tags: ["circles"],
    operationId: "leaveCircle",
    request: { params: z.object({ slug: z.string() }) },
    responses: { 204: { description: "Left" }, 422: errorResponse("Owners cannot leave") },
  });
}

export function registerUserContentPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/users/{handle}/posts",
    tags: ["users"],
    operationId: "listUserPosts",
    request: { params: z.object({ handle: z.string() }) },
    responses: {
      200: jsonResponse("User's published posts", z.array(PostCardSchema)),
      404: errorResponse("User not found"),
    },
  });
}

export function registerCircleContentPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/circles/{slug}/posts",
    tags: ["circles"],
    operationId: "listCirclePosts",
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: jsonResponse("Posts in this circle", z.array(PostCardSchema)),
    },
  });
  registry.registerPath({
    method: "get",
    path: "/circles/{slug}/members",
    tags: ["circles"],
    operationId: "listCircleMembers",
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: jsonResponse(
        "Circle members",
        z.array(
          z.object({
            role: z.enum(["owner", "moderator", "member"]),
            user: PublicUserSchema,
          }),
        ),
      ),
    },
  });
}
