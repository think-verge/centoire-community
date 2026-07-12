import { Router } from "express";
import * as engagementController from "../controllers/engagementController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { requireVerified } from "../middleware/requireVerified.js";
import { validate } from "../middleware/validate.js";
import {
  BookmarkInputSchema,
  BookmarksQuerySchema,
  CreateCommentInputSchema,
  CreateFolderInputSchema,
  UpdateCommentInputSchema,
  VoteInputSchema,
} from "../schemas/engagement.js";
import { asyncHandler } from "../utils/async-handler.js";

/** Mounted on /posts — vote/bookmark/comment subroutes for posts. */
export const postEngagementRouter = Router();

postEngagementRouter.put(
  "/:id/vote",
  requireAuth,
  asyncHandler(requireVerified),
  validate({ body: VoteInputSchema }),
  asyncHandler(engagementController.votePost),
);
postEngagementRouter.delete(
  "/:id/vote",
  requireAuth,
  asyncHandler(engagementController.unvotePost),
);
postEngagementRouter.put(
  "/:id/bookmark",
  requireAuth,
  validate({ body: BookmarkInputSchema }),
  asyncHandler(engagementController.bookmarkPost),
);
postEngagementRouter.delete(
  "/:id/bookmark",
  requireAuth,
  asyncHandler(engagementController.unbookmarkPost),
);
postEngagementRouter.get(
  "/:id/comments",
  optionalAuth,
  asyncHandler(engagementController.listComments),
);
postEngagementRouter.post(
  "/:id/comments",
  requireAuth,
  asyncHandler(requireVerified),
  validate({ body: CreateCommentInputSchema }),
  asyncHandler(engagementController.createComment),
);

/** Mounted on /comments. */
export const commentRouter = Router();

commentRouter.put(
  "/:id/vote",
  requireAuth,
  asyncHandler(requireVerified),
  validate({ body: VoteInputSchema }),
  asyncHandler(engagementController.voteComment),
);
commentRouter.delete("/:id/vote", requireAuth, asyncHandler(engagementController.unvoteComment));
commentRouter.patch(
  "/:id",
  requireAuth,
  validate({ body: UpdateCommentInputSchema }),
  asyncHandler(engagementController.updateComment),
);
commentRouter.delete("/:id", requireAuth, asyncHandler(engagementController.deleteComment));

/** Mounted on /bookmarks + /bookmark-folders. */
export const bookmarkRouter = Router();

bookmarkRouter.get(
  "/",
  requireAuth,
  validate({ query: BookmarksQuerySchema }),
  asyncHandler(engagementController.listBookmarks),
);

export const bookmarkFolderRouter = Router();

bookmarkFolderRouter.get("/", requireAuth, asyncHandler(engagementController.listFolders));
bookmarkFolderRouter.post(
  "/",
  requireAuth,
  validate({ body: CreateFolderInputSchema }),
  asyncHandler(engagementController.createFolder),
);
bookmarkFolderRouter.delete("/:id", requireAuth, asyncHandler(engagementController.deleteFolder));
