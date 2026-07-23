import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";

const PostAuthorSchema = z.object({
  id: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

const PostSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  siteUrl: z.string(),
  faviconUrl: z.string().nullable(),
});

const PostCircleRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

export const ViewerStateSchema = registry.register(
  "ViewerState",
  z.object({
    voted: z.union([z.literal(1), z.literal(-1)]).nullable(),
    bookmarked: z.boolean(),
  }),
);

export const PostCardSchema = registry.register(
  "PostCard",
  z.object({
    id: z.string(),
    slug: z.string(),
    origin: z.enum(["native", "aggregated"]),
    status: z.enum(["draft", "pending_review", "published", "rejected", "removed"]),
    title: z.string(),
    excerpt: z.string(),
    coverImageUrl: z.string().nullable(),
    externalUrl: z.string().nullable(),
    author: PostAuthorSchema.nullable(),
    source: PostSourceSchema.nullable(),
    circle: PostCircleRefSchema.nullable(),
    tags: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
    upvoteCount: z.number(),
    commentCount: z.number(),
    bookmarkCount: z.number(),
    readTimeMinutes: z.number(),
    publishedAt: z.string().nullable(),
    updatedAt: z.string(),
    viewer: ViewerStateSchema,
  }),
);

export const PostDetailSchema = registry.register(
  "PostDetail",
  PostCardSchema.extend({
    content: z.record(z.string(), z.unknown()).nullable(),
    viewCount: z.number(),
    rejectionReason: z.string().nullable(),
    authorFollowedByViewer: z.boolean(),
  }),
);

export const CreatePostInputSchema = registry.register(
  "CreatePostInput",
  z.object({
    title: z.string().min(1).max(200),
    content: z.record(z.string(), z.unknown()).optional(),
    tagIds: z.array(z.string()).max(5).optional(),
    circleId: z.string().nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    status: z.enum(["draft", "published"]).optional(),
  }),
);

export const UpdatePostInputSchema = registry.register(
  "UpdatePostInput",
  CreatePostInputSchema.omit({ status: true }).partial(),
);

export const UploadedImageSchema = registry.register(
  "UploadedImage",
  z.object({
    url: z.string(),
    width: z.number().nullable(),
    height: z.number().nullable(),
  }),
);

export function registerPostPaths(): void {
  registry.registerPath({
    method: "post",
    path: "/posts",
    tags: ["posts"],
    operationId: "createPost",
    request: { body: jsonBody(CreatePostInputSchema) },
    responses: {
      201: jsonResponse("Post created", PostCardSchema),
      403: errorResponse("Email not verified"),
    },
  });
  registry.registerPath({
    method: "get",
    path: "/posts/me/drafts",
    tags: ["posts"],
    operationId: "listMyDrafts",
    responses: { 200: jsonResponse("Your drafts", z.array(PostCardSchema)) },
  });
  registry.registerPath({
    method: "get",
    path: "/posts/{slug}",
    tags: ["posts"],
    operationId: "getPost",
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: jsonResponse("Post detail", PostDetailSchema),
      404: errorResponse("Post not found"),
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/posts/{id}",
    tags: ["posts"],
    operationId: "updatePost",
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdatePostInputSchema),
    },
    responses: {
      200: jsonResponse("Updated post", PostDetailSchema),
      403: errorResponse("Not your post"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/posts/{id}/publish",
    tags: ["posts"],
    operationId: "publishPost",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: jsonResponse("Published post", PostCardSchema),
      422: errorResponse("Post is missing title or content"),
    },
  });
  registry.registerPath({
    method: "delete",
    path: "/posts/{id}",
    tags: ["posts"],
    operationId: "deletePost",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Post removed" } },
  });
  registry.registerPath({
    method: "post",
    path: "/uploads/image",
    tags: ["uploads"],
    operationId: "uploadImage",
    request: {
      body: {
        content: {
          "multipart/form-data": {
            schema: z.object({ file: z.string().openapi({ format: "binary" }) }),
          },
        },
      },
    },
    responses: {
      201: jsonResponse("Uploaded image", UploadedImageSchema),
      422: errorResponse("Invalid file"),
    },
  });
}
