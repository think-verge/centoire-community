import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";
import { PostCardSchema } from "./posts.js";

export const VoteInputSchema = registry.register(
  "VoteInput",
  z.object({ value: z.union([z.literal(1), z.literal(-1)]) }),
);

export const BookmarkInputSchema = registry.register(
  "BookmarkInput",
  z.object({ folderId: z.string().nullable().optional() }),
);

const CommentAuthorSchema = z.object({
  id: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  reputation: z.number(),
});

interface CommentNodeShape {
  id: string;
  content: string;
  status: "active" | "deleted";
  depth: number;
  upvoteCount: number;
  replyCount: number;
  createdAt: string;
  author: z.infer<typeof CommentAuthorSchema> | null;
  viewerVoted: boolean;
  replies: CommentNodeShape[];
}

const CommentNodeSchema: z.ZodType<CommentNodeShape> = z.lazy(() =>
  z.object({
    id: z.string(),
    content: z.string(),
    status: z.enum(["active", "deleted"]),
    depth: z.number(),
    upvoteCount: z.number(),
    replyCount: z.number(),
    createdAt: z.string(),
    author: CommentAuthorSchema.nullable(),
    viewerVoted: z.boolean(),
    replies: z.array(CommentNodeSchema),
  }),
) as z.ZodType<CommentNodeShape>;

export const CommentSchema = registry.register(
  "Comment",
  z.object({
    id: z.string(),
    content: z.string(),
    status: z.enum(["active", "deleted"]),
    depth: z.number(),
    upvoteCount: z.number(),
    replyCount: z.number(),
    createdAt: z.string(),
    author: CommentAuthorSchema.nullable(),
    viewerVoted: z.boolean(),
    replies: z.array(z.lazy(() => CommentNodeSchema)).openapi({
      type: "array",
      items: { $ref: "#/components/schemas/Comment" },
    }),
  }),
);

export const CreateCommentInputSchema = registry.register(
  "CreateCommentInput",
  z.object({
    content: z.string().min(1).max(2000),
    parentId: z.string().optional(),
  }),
);

export const UpdateCommentInputSchema = registry.register(
  "UpdateCommentInput",
  z.object({ content: z.string().min(1).max(2000) }),
);

export const BookmarkFoldersSchema = registry.register(
  "BookmarkFolders",
  z.object({
    folders: z.array(z.object({ id: z.string(), name: z.string(), count: z.number() })),
    unfiledCount: z.number(),
  }),
);

export const CreateFolderInputSchema = registry.register(
  "CreateFolderInput",
  z.object({ name: z.string().min(1).max(40) }),
);

export const BookmarksQuerySchema = z.object({ folderId: z.string().optional() });

export function registerEngagementPaths(): void {
  registry.registerPath({
    method: "put",
    path: "/posts/{id}/vote",
    tags: ["engagement"],
    operationId: "votePost",
    request: { params: z.object({ id: z.string() }), body: jsonBody(VoteInputSchema) },
    responses: { 204: { description: "Vote recorded" }, 404: errorResponse("Post not found") },
  });
  registry.registerPath({
    method: "delete",
    path: "/posts/{id}/vote",
    tags: ["engagement"],
    operationId: "unvotePost",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Vote removed" } },
  });
  registry.registerPath({
    method: "put",
    path: "/comments/{id}/vote",
    tags: ["engagement"],
    operationId: "voteComment",
    request: { params: z.object({ id: z.string() }), body: jsonBody(VoteInputSchema) },
    responses: { 204: { description: "Vote recorded" } },
  });
  registry.registerPath({
    method: "delete",
    path: "/comments/{id}/vote",
    tags: ["engagement"],
    operationId: "unvoteComment",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Vote removed" } },
  });

  registry.registerPath({
    method: "put",
    path: "/posts/{id}/bookmark",
    tags: ["engagement"],
    operationId: "bookmarkPost",
    request: { params: z.object({ id: z.string() }), body: jsonBody(BookmarkInputSchema) },
    responses: { 204: { description: "Bookmarked" } },
  });
  registry.registerPath({
    method: "delete",
    path: "/posts/{id}/bookmark",
    tags: ["engagement"],
    operationId: "unbookmarkPost",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Bookmark removed" } },
  });
  registry.registerPath({
    method: "get",
    path: "/bookmarks",
    tags: ["engagement"],
    operationId: "listBookmarks",
    request: { query: BookmarksQuerySchema },
    responses: { 200: jsonResponse("Bookmarked posts", z.array(PostCardSchema)) },
  });
  registry.registerPath({
    method: "get",
    path: "/bookmark-folders",
    tags: ["engagement"],
    operationId: "listBookmarkFolders",
    responses: { 200: jsonResponse("Your folders", BookmarkFoldersSchema) },
  });
  registry.registerPath({
    method: "post",
    path: "/bookmark-folders",
    tags: ["engagement"],
    operationId: "createBookmarkFolder",
    request: { body: jsonBody(CreateFolderInputSchema) },
    responses: {
      201: jsonResponse(
        "Folder created",
        z.object({ id: z.string(), name: z.string(), count: z.number() }),
      ),
      409: errorResponse("Duplicate folder name"),
    },
  });
  registry.registerPath({
    method: "delete",
    path: "/bookmark-folders/{id}",
    tags: ["engagement"],
    operationId: "deleteBookmarkFolder",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Folder deleted; bookmarks unfiled" } },
  });

  registry.registerPath({
    method: "get",
    path: "/posts/{id}/comments",
    tags: ["engagement"],
    operationId: "listComments",
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: jsonResponse("Comment tree", z.array(CommentSchema)) },
  });
  registry.registerPath({
    method: "post",
    path: "/posts/{id}/comments",
    tags: ["engagement"],
    operationId: "createComment",
    request: { params: z.object({ id: z.string() }), body: jsonBody(CreateCommentInputSchema) },
    responses: {
      201: jsonResponse("Comment created", z.object({ id: z.string() })),
      403: errorResponse("Email not verified"),
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/comments/{id}",
    tags: ["engagement"],
    operationId: "updateComment",
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateCommentInputSchema) },
    responses: { 204: { description: "Comment updated" } },
  });
  registry.registerPath({
    method: "delete",
    path: "/comments/{id}",
    tags: ["engagement"],
    operationId: "deleteComment",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Comment deleted" } },
  });
}
