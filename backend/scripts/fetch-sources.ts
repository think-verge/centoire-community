// Usage:
//   npx tsx scripts/fetch-sources.ts                 # every active source
//   npx tsx scripts/fetch-sources.ts --source GQ     # one source, matched by name (case-insensitive)
// AI summaries/tags are fired per new post unless ENABLE_AI_PROCESSING=false; override per run, e.g.
//   ENABLE_AI_PROCESSING=true npx tsx scripts/fetch-sources.ts --source GQ
// Re-run AI on a source's posts that have no AI result yet (e.g. the agent had no API key at import time):
//   ENABLE_AI_PROCESSING=true npx tsx scripts/fetch-sources.ts --source GQ --reprocess-ai
// Calls are spaced (AI_SPACING_MS, default 4000) to stay inside free-tier rate limits.
import { connectDb, disconnectDb } from "../src/config/db.js";
import { Post } from "../src/models/Post.js";
import { Source } from "../src/models/Source.js";
import { fireAiProcessing } from "../src/services/aiService.js";
import { fetchAllActiveSources, fetchSource } from "../src/services/ingestionService.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  await connectDb();
  const name = argValue("--source");
  if (name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const source = await Source.findOne({ name: new RegExp(`^${escaped}$`, "i") });
    if (!source) throw new Error(`No source named "${name}"`);
    if (process.argv.includes("--reprocess-ai")) {
      const spacing = Number(process.env.AI_SPACING_MS ?? 4000);
      const posts = await Post.find({
        sourceId: source._id,
        aiProcessed: { $ne: true },
        status: { $in: ["pending_review", "published"] },
        externalUrl: { $exists: true },
      }).select("_id externalUrl");
      console.log(`[ai] re-processing ${posts.length} ${source.name} posts (one every ${spacing}ms)`);
      for (const post of posts) {
        await fireAiProcessing(post._id.toString(), { origin: "aggregated", url: post.externalUrl });
        await new Promise((r) => setTimeout(r, spacing));
      }
    } else {
      const stats = await fetchSource(source);
      console.log(
        `[ingestion] ${stats.sourceName}: ${stats.imported} imported, ${stats.skippedDuplicates} duplicates${stats.error ? `, error: ${stats.error}` : ""}`,
      );
    }
  } else {
    const stats = await fetchAllActiveSources();
    console.log(`[ingestion] total imported: ${stats.reduce((sum, s) => sum + s.imported, 0)}`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
