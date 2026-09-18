import cron from "node-cron";
import { Post } from "../models/Post.js";

// Runs every hour. Deletes expired aggregated posts that have no engagement.
// A post survives if it has been upvoted, bookmarked, commented on, or seen by ≥50 viewers.
async function deleteExpiredPosts(): Promise<void> {
  const result = await Post.deleteMany({
    origin: "aggregated",
    expiresAt: { $lt: new Date() },
    bookmarkCount: 0,
    upvoteCount: 0,
    commentCount: 0,
    viewCount: { $lt: 50 },
    status: { $nin: ["pending_review"] },
  });
  if (result.deletedCount > 0) {
    console.log(`[cleanup] deleted ${result.deletedCount} expired aggregated post(s)`);
  }
}

export function startCleanupCron(): void {
  // Every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    try {
      await deleteExpiredPosts();
    } catch (err) {
      console.error("[cleanup] run failed:", err);
    }
  });
  console.log("[cleanup] scheduled: every hour");
}
