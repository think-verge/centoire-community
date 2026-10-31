import { Types } from "mongoose";
import { Circle } from "../models/Circle.js";
import { Hashtag } from "../models/Hashtag.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import { serializeCircle } from "./circleService.js";
import { serializePostCard } from "./postSerializer.js";
import { serializeUser } from "./userSerializer.js";

// Pull-based change feed for read-model services (search, later feed). Everything that
// changes a document — including counter $inc's — bumps `updatedAt`, so an
// (updatedAt, _id) keyset cursor sees every write without touching each emitter.

export type SyncKind = "posts" | "people" | "circles" | "hashtags";
export const SYNC_KINDS: SyncKind[] = ["posts", "people", "circles", "hashtags"];

const MAX_LIMIT = 500;

interface Cursor extends Record<string, unknown> {
  t: string;
  id: string;
}

const CARD_POPULATE = [
  { path: "authorId", select: "handle displayName avatarUrl role followerCount" },
  { path: "sourceId", select: "name siteUrl faviconUrl" },
  { path: "circleId", select: "name slug isPrivate" },
];

export interface SyncPage<T> {
  items: T[];
  nextCursor: string | null;
}

function keyset(cursor: string | undefined): Record<string, unknown> {
  const c = decodeCursor<Cursor>(cursor);
  if (!c) return {};
  const t = new Date(c.t);
  return { $or: [{ updatedAt: { $gt: t } }, { updatedAt: t, _id: { $gt: new Types.ObjectId(c.id) } }] };
}

function page<T extends { _id: Types.ObjectId; updatedAt: Date }, R>(rows: T[], map: (r: T) => R): SyncPage<R> {
  const last = rows[rows.length - 1];
  return {
    items: rows.map(map),
    // A short page means we're caught up; keep the cursor anyway so the client resumes from it.
    nextCursor: last ? encodeCursor({ t: last.updatedAt.toISOString(), id: String(last._id) }) : null,
  };
}

const clampLimit = (n: unknown) => Math.min(Math.max(Number(n) || 200, 1), MAX_LIMIT);

export async function changes(kind: SyncKind, cursor: string | undefined, rawLimit: unknown): Promise<SyncPage<unknown>> {
  const limit = clampLimit(rawLimit);
  const filter = keyset(cursor);
  const sort = { updatedAt: 1, _id: 1 } as const;

  switch (kind) {
    case "posts": {
      const rows = await Post.find(filter).sort(sort).limit(limit).populate(CARD_POPULATE);
      return page(rows, (p) => {
        const circle = p.circleId as unknown as { isPrivate?: boolean } | null;
        return {
          id: String(p._id),
          status: p.status,
          // Posts in private circles must never be discoverable through global search.
          circlePrivate: Boolean(circle && typeof circle === "object" && circle.isPrivate),
          title: p.title,
          excerpt: p.excerpt ?? "",
          // Never the article body (we do not keep or index other sites' full text): summary + tags are what search matches on.
          summary: p.aiSummary ?? "",
          hashtags: p.hashtags ?? [],
          publishedAt: p.publishedAt ?? null,
          card: serializePostCard(p),
        };
      });
    }
    case "people": {
      const rows = await User.find(filter).sort(sort).limit(limit);
      return page(rows, (u) => ({
        id: String(u._id),
        hasHandle: Boolean(u.handle),
        handle: u.handle ?? "",
        displayName: u.displayName,
        bio: u.bio ?? "",
        followerCount: u.followerCount,
        card: serializeUser(u),
      }));
    }
    case "circles": {
      const rows = await Circle.find(filter).sort(sort).limit(limit);
      return page(rows, (c) => ({
        id: String(c._id),
        isPrivate: Boolean(c.isPrivate),
        name: c.name,
        description: c.description ?? "",
        memberCount: c.memberCount,
        card: serializeCircle(c),
      }));
    }
    case "hashtags": {
      const rows = await Hashtag.find(filter).sort(sort).limit(limit);
      return page(rows, (h) => ({ id: String(h._id), name: h.name, postCount: h.postCount, status: h.status }));
    }
  }
}

const idModels = { posts: Post, people: User, circles: Circle, hashtags: Hashtag } as const;

/** Id listing for delete reconciliation: read-model services drop anything not returned. */
export async function ids(kind: SyncKind, after: string | undefined, rawLimit: unknown): Promise<{ ids: string[]; next: string | null }> {
  const limit = Math.min(Math.max(Number(rawLimit) || 5000, 1), 20_000);
  const filter = after && Types.ObjectId.isValid(after) ? { _id: { $gt: new Types.ObjectId(after) } } : {};
  const rows = await (idModels[kind] as typeof Post).find(filter).sort({ _id: 1 }).limit(limit).select("_id").lean();
  const out = rows.map((r) => String(r._id));
  return { ids: out, next: out.length === limit ? out[out.length - 1]! : null };
}
