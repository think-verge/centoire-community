import { Bookmark } from "../models/Bookmark.js";
import { Vote } from "../models/Vote.js";
import type { ViewerState } from "./postSerializer.js";

// Vote/bookmark mutations arrive in M5; the viewer-state lookup lives here so
// the post detail endpoint has a stable shape from M3 onward.
export async function getViewerState(
  postId: string,
  userId?: string,
): Promise<ViewerState> {
  if (!userId) return { voted: null, bookmarked: false };
  const [vote, bookmark] = await Promise.all([
    Vote.findOne({ userId, targetType: "post", targetId: postId }),
    Bookmark.findOne({ userId, postId }),
  ]);
  return {
    voted: (vote?.value as 1 | -1 | undefined) ?? null,
    bookmarked: Boolean(bookmark),
  };
}
