/**
 * Migrates the curated Tag system to hashtags. Additive and idempotent:
 *
 *   npm run migrate:hashtags -- --dry-run     report only, write nothing
 *   npm run migrate:hashtags                  copy data into the new fields/collection (old data stays)
 *   npm run migrate:hashtags -- --cleanup     later: rename `tags` -> `tags_legacy`, drop old fields/indexes
 *
 * Safe rollout: run it, deploy the hashtag code, run it again (picks up anything written by the old
 * code in between), and only run --cleanup after a few days. Nothing in the new code reads old fields.
 */
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../src/config/db.js";
import { FEATURED_HASHTAG_NAMES } from "../src/config/seedHashtags.js";
import "../src/models/index.js";
import { reconcileCounts } from "../src/services/hashtagService.js";
import { MAX_POST_HASHTAGS, normalizeHashtag } from "../src/utils/hashtag.js";

const DRY = process.argv.includes("--dry-run");
const CLEANUP = process.argv.includes("--cleanup");
const BATCH = 500;

interface OldTag {
  _id: mongoose.Types.ObjectId;
  name?: string;
  slug?: string;
  followerCount?: number;
}

const db = () => mongoose.connection;
const col = (name: string) => db().collection(name);
const log = (msg: string) => console.log(`[migrate]${DRY ? " (dry-run)" : ""} ${msg}`);

async function loadMapping(): Promise<{ byId: Map<string, string>; followers: Map<string, number>; collisions: string[] }> {
  const old = await col("tags").find<OldTag>({}).toArray();
  const byId = new Map<string, string>();
  const followers = new Map<string, number>();
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const tag of old) {
    const name = normalizeHashtag(tag.name ?? "") ?? normalizeHashtag(tag.slug ?? "");
    if (!name) {
      log(`skipping tag ${tag._id} (${tag.name ?? tag.slug}): not a valid hashtag`);
      continue;
    }
    if (seen.has(name)) collisions.push(`"${tag.name}" merged into #${name} (also "${seen.get(name)}")`);
    else seen.set(name, tag.name ?? name);
    byId.set(String(tag._id), name);
    followers.set(name, (followers.get(name) ?? 0) + (tag.followerCount ?? 0));
  }
  return { byId, followers, collisions };
}

/** Copies an ObjectId-array field into a names array for docs that have the old field but no new one. */
async function convert(collection: string, oldField: string, newField: string, byId: Map<string, string>, cap?: number): Promise<number> {
  const filter = { [oldField]: { $exists: true, $ne: [] }, $or: [{ [newField]: { $exists: false } }, { [newField]: { $size: 0 } }] };
  const cursor = col(collection).find(filter).project({ [oldField]: 1 });
  let converted = 0;
  let ops: mongoose.mongo.AnyBulkWriteOperation[] = [];
  const flush = async () => {
    if (ops.length && !DRY) await col(collection).bulkWrite(ops, { ordered: false });
    ops = [];
  };
  for await (const doc of cursor) {
    const names = [...new Set((doc[oldField] as mongoose.Types.ObjectId[]).map((id) => byId.get(String(id))).filter((n): n is string => Boolean(n)))];
    const next = cap ? names.slice(0, cap) : names;
    if (next.length === 0) continue;
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { [newField]: next } } } });
    converted += 1;
    if (ops.length >= BATCH) await flush();
  }
  await flush();
  return converted;
}

async function migrate(): Promise<void> {
  const { byId, followers, collisions } = await loadMapping();
  log(`${byId.size} old tags -> ${new Set(byId.values()).size} hashtags`);
  collisions.forEach((c) => log(`collision: ${c}`));

  const names = [...new Set(byId.values())];
  if (!DRY && names.length) {
    await col("hashtags").bulkWrite(
      names.map((name) => ({
        updateOne: {
          filter: { name },
          update: {
            $setOnInsert: { name, postCount: 0, status: "active", createdAt: new Date() },
            $set: { followerCount: followers.get(name) ?? 0, featured: FEATURED_HASHTAG_NAMES.has(name), updatedAt: new Date() },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  log(`upserted ${names.length} hashtag documents`);

  log(`posts converted: ${await convert("posts", "tags", "hashtags", byId, MAX_POST_HASHTAGS)}`);
  log(`circles converted: ${await convert("circles", "tags", "hashtags", byId, 5)}`);
  log(`sources converted: ${await convert("sources", "tags", "hashtags", byId, 5)}`);
  log(`users converted (interests -> followedHashtags): ${await convert("users", "interests", "followedHashtags", byId)}`);

  if (!DRY) {
    const stats = await reconcileCounts();
    log(`recomputed usage counts (${stats.updated} changed)`);
  }
}

async function cleanup(): Promise<void> {
  if (DRY) return log("would rename tags -> tags_legacy and unset tags/interests fields");
  const unsets: Array<[string, string]> = [["posts", "tags"], ["circles", "tags"], ["sources", "tags"], ["users", "interests"]];
  for (const [collection, field] of unsets) {
    const res = await col(collection).updateMany({ [field]: { $exists: true } }, { $unset: { [field]: "" } });
    log(`${collection}: removed "${field}" from ${res.modifiedCount} documents`);
  }
  for (const [collection, index] of [["posts", "status_1_tags_1_publishedAt_-1"], ["circles", "tags_1_memberCount_-1"]] as const) {
    await col(collection).dropIndex(index).then(() => log(`dropped index ${collection}.${index}`)).catch(() => undefined);
  }
  const exists = (await db().db!.listCollections({ name: "tags" }).toArray()).length > 0;
  if (exists) {
    await col("tags").rename("tags_legacy");
    log("renamed tags -> tags_legacy (drop it manually once you are happy)");
  }
}

async function main(): Promise<void> {
  await connectDb();
  await (CLEANUP ? cleanup() : migrate());
  await disconnectDb();
  log("done");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
