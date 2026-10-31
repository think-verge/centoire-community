// One-off copy of core's `notifications` collection into this service's database,
// attaching actor/post/circle snapshots so no cross-service lookup is needed afterwards.
// Dry-run by default (counts only); pass --apply to write. Idempotent via legacyId.
import "../src/env.js";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");
const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/centoire";
const targetDb = process.env.NOTIFICATIONS_DB_NAME ?? "centoire_notifications";

const source = await mongoose.createConnection(uri).asPromise();
const target = source.useDb(targetDb, { useCache: true });
const col = (db: mongoose.Connection, name: string) => db.collection(name);

const total = await col(source, "notifications").countDocuments();
console.log(`[migrate] source=${source.name} target=${targetDb} notifications=${total} mode=${apply ? "APPLY" : "dry-run"}`);

const str = (v: unknown) => (v == null ? undefined : String(v));
let written = 0;
for await (const n of col(source, "notifications").find({})) {
  const [actor, post, circle] = await Promise.all([
    n.actorId ? col(source, "users").findOne({ _id: n.actorId }, { projection: { handle: 1, displayName: 1, avatarUrl: 1 } }) : null,
    n.targetPostId ? col(source, "posts").findOne({ _id: n.targetPostId }, { projection: { slug: 1, title: 1 } }) : null,
    n.targetCircleId ? col(source, "circles").findOne({ _id: n.targetCircleId }, { projection: { slug: 1, name: 1, avatarUrl: 1 } }) : null,
  ]);
  const doc = {
    legacyId: String(n._id),
    recipientId: String(n.recipientId),
    actorId: str(n.actorId),
    type: n.type,
    actor: actor && { id: String(actor._id), handle: actor.handle, displayName: actor.displayName, avatarUrl: actor.avatarUrl },
    targetPostId: str(n.targetPostId),
    targetPost: post && { id: String(post._id), slug: post.slug, title: post.title },
    targetCommentId: str(n.targetCommentId),
    targetCircleId: str(n.targetCircleId),
    targetCircle: circle && { id: String(circle._id), slug: circle.slug, name: circle.name, avatarUrl: circle.avatarUrl },
    targetInviteToken: n.targetInviteToken,
    readAt: n.readAt,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
  if (apply) {
    await col(target, "notifications").updateOne({ legacyId: doc.legacyId }, { $setOnInsert: doc }, { upsert: true });
  }
  written++;
}
console.log(`[migrate] ${apply ? "upserted" : "would upsert"} ${written} notifications`);
await source.close();
