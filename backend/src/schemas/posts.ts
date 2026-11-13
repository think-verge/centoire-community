import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";
import { POST_CATEGORIES } from "../config/categoryTaxonomy.js";
import { hashtagNames } from "./hashtags.js";

export const PostCategorySchema = z.enum(POST_CATEGORIES);

const PostAuthorSchema = z.object({
  id: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  followerCount: z.number().optional(),
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
    authorFollowed: z.boolean().optional(),
  }),
);

const PostDiscoverySchema = registry.register(
  "PostDiscovery",
  z.object({
    storyId: z.string(),
    category: z.string().nullable(),
    websiteCount: z.number(),
    articleCount: z.number(),
    firstPublished: z.object({ name: z.string(), url: z.string().nullable(), at: z.string() }).nullable(),
    engineSawAt: z.string().nullable(),
    spread: z.array(z.object({ name: z.string(), url: z.string().nullable(), firstAt: z.string() })),
    markets: z.array(z.string()),
    momentum: z
      .object({
        tag: z.enum(["breaking", "rising", "early", "steady", "settled"]),
        reason: z.string(),
        computedAt: z.string().nullable(),
      })
      .nullable()
      .optional(),
  }),
);

export const PostCardSchema = registry.register(
  "PostCard",
  z.object({
    id: z.string(),
    slug: z.string(),
    origin: z.enum(["native", "aggregated"]),
    status: z.enum(["draft", "pending_review", "published", "rejected", "removed"]),
    curated: z.boolean().optional(),
    title: z.string(),
    excerpt: z.string(),
    coverImageUrl: z.string().nullable(),
    externalUrl: z.string().nullable(),
    author: PostAuthorSchema.nullable(),
    source: PostSourceSchema.nullable(),
    circle: PostCircleRefSchema.nullable(),
    category: PostCategorySchema.nullable(),
    subcategory: z.string().nullable(),
    hashtags: z.array(z.string()),
    upvoteCount: z.number(),
    commentCount: z.number(),
    bookmarkCount: z.number(),
    readTimeMinutes: z.number(),
    publishedAt: z.string().nullable(),
    updatedAt: z.string(),
    viewer: ViewerStateSchema,
    authorIsCreator: z.boolean(),
    /** Set on stories the discovery engine put up for review: how far the story had spread. */
    discovery: PostDiscoverySchema.nullable().optional(),
  }),
);

export const PostDetailSchema = registry.register(
  "PostDetail",
  PostCardSchema.extend({
    content: z.record(z.string(), z.unknown()).nullable(),
    contentHtml: z.string().nullable(),
    viewCount: z.number(),
    rejectionReason: z.string().nullable(),
    authorFollowedByViewer: z.boolean(),
    aiSummary: z.string().nullable(),
    clickbaitDetected: z.boolean(),
  }),
);

export const PostFullContentSchema = registry.register(
  "PostFullContent",
  z.object({
    contentHtml: z.string().nullable(),
    source: z.string(),
  }),
);

export const CreatePostInputSchema = registry.register(
  "CreatePostInput",
  z.object({
    title: z.string().min(1).max(200),
    content: z.record(z.string(), z.unknown()).optional(),
    /** Up to 5 hashtag names (1-5 required to publish). Normalized and created server-side. */
    hashtags: hashtagNames(0, 5).optional(),
    circleId: z.string().nullable().optional(),
    coverImageUrl: z.string().url().nullable().optional(),
    category: PostCategorySchema.nullable().optional(),
    subcategory: z.string().nullable().optional(),
    status: z.enum(["draft", "published"]).optional(),
  }),
);

export const UpdatePostInputSchema = registry.register(
  "UpdatePostInput",
  CreatePostInputSchema.omit({ status: true }).partial(),
);

export const BackfillCategoriesResultSchema = registry.register(
  "BackfillCategoriesResult",
  z.object({
    scanned: z.number(),
    updated: z.number(),
  }),
);

export const CuratePostInputSchema = registry.register(
  "CuratePostInput",
  z.object({
    curated: z.boolean().optional(),
  }),
);

export const CuratePostResponseSchema = registry.register(
  "CuratePostResponse",
  z.object({
    id: z.string(),
    curated: z.boolean(),
    status: z.string(),
  }),
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
    method: "get",
    path: "/posts/{slug}/full-content",
    tags: ["posts"],
    operationId: "getPostFullContent",
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: jsonResponse("Extracted full article content, fetching on demand if needed", PostFullContentSchema),
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
    path: "/admin/posts/backfill-categories",
    tags: ["admin"],
    operationId: "backfillPostCategories",
    responses: { 200: jsonResponse("Backfill result", BackfillCategoriesResultSchema) },
  });
  registry.registerPath({
    method: "patch",
    path: "/admin/posts/{id}/curate",
    tags: ["admin"],
    operationId: "curatePost",
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(CuratePostInputSchema),
    },
    responses: {
      200: jsonResponse("Post curated status updated", CuratePostResponseSchema),
      404: errorResponse("Post not found"),
    },
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
