/**
 * Backfill script for existing published posts.
 * Emits post.created domain events for embedding downstream.
 *
 * Usage:
 *   npx tsx scripts/backfill-post-events.ts
 *   npx tsx scripts/backfill-post-events.ts --dry-run
 *   npx tsx scripts/backfill-post-events.ts --batch-size 50 --delay-ms 20
 *   npx tsx scripts/backfill-post-events.ts --resume-from 64f1a2b3c4d5e6f7a8b9c0d1
 *   npx tsx scripts/backfill-post-events.ts --origin native
 */

import { Types } from "mongoose";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { emitDomainEvent, initEventBus } from "../src/events/eventBus.js";
import { Post } from "../src/models/Post.js";
import { buildPostLifecyclePayload } from "../src/services/postLifecycleService.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const isDryRun = process.argv.includes("--dry-run");
const batchSize = Math.max(1, parseInt(argValue("--batch-size") ?? "50", 10));
const delayMs = Math.max(0, parseInt(argValue("--delay-ms") ?? "20", 10));
const resumeFrom = argValue("--resume-from");
const originFilter = argValue("--origin");
const maxLimit = argValue("--limit") ? parseInt(argValue("--limit")!, 10) : Infinity;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  await connectDb();
  if (!isDryRun && env.NATS_URL) {
    await initEventBus("backend-backfill", env.NATS_URL);
    console.log(`[backfill] Connected to NATS at ${env.NATS_URL}`);
  }

  const query: Record<string, unknown> = {
    status: "published",
  };

  if (originFilter === "native" || originFilter === "aggregated") {
    query.origin = originFilter;
  }

  if (resumeFrom) {
    if (!Types.ObjectId.isValid(resumeFrom)) {
      throw new Error(`Invalid --resume-from ObjectId: "${resumeFrom}"`);
    }
    query._id = { $gt: new Types.ObjectId(resumeFrom) };
    console.log(`[backfill] Resuming after post ID: ${resumeFrom}`);
  }

  const totalMatching = await Post.countDocuments(query);
  const targetCount = Math.min(totalMatching, maxLimit);
  console.log(
    `[backfill] Found ${totalMatching} published post(s) to process (target: ${targetCount}, batchSize: ${batchSize}, delay: ${delayMs}ms, dryRun: ${isDryRun})`,
  );

  let processedCount = 0;
  let lastId: string | null = resumeFrom ?? null;
  let running = true;

  const onInterrupt = () => {
    console.log("\n[backfill] Interrupt received. Finishing current item...");
    running = false;
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);

  while (running && processedCount < targetCount) {
    const currentBatchLimit = Math.min(batchSize, targetCount - processedCount);
    const batchQuery: Record<string, unknown> = { ...query };
    if (lastId) {
      batchQuery._id = { $gt: new Types.ObjectId(lastId) };
    }

    const posts = await Post.find(batchQuery)
      .sort({ _id: 1 })
      .limit(currentBatchLimit);

    if (posts.length === 0) break;

    for (const post of posts) {
      if (!running) break;
      const payload = await buildPostLifecyclePayload(post);
      lastId = post._id.toString();
      processedCount++;

      if (isDryRun) {
        console.log(
          `[dry-run] [${processedCount}/${targetCount}] post ${lastId} (${post.origin}) title="${post.title.slice(0, 40)}" curated=${payload.curated} private=${payload.isCirclePrivate}`,
        );
      } else {
        emitDomainEvent("post.created", payload);
        console.log(
          `[backfill] [${processedCount}/${targetCount}] emitted post.created for post ${lastId} (${post.origin})`,
        );
      }

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`[backfill] Summary:`);
  console.log(`  Processed: ${processedCount}/${targetCount} post(s)`);
  if (lastId) {
    console.log(`  Last post ID: ${lastId}`);
    if (processedCount < targetCount) {
      console.log(`  To resume: npx tsx scripts/backfill-post-events.ts --resume-from ${lastId}`);
    }
  }
  console.log(`========================================\n`);

  await disconnectDb();
}

main().catch(async (err) => {
  console.error("[backfill] Failed:", err);
  try {
    await disconnectDb();
  } catch {
    // ignore
  }
  process.exit(1);
});

