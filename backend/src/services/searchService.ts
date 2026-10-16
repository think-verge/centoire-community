import { Circle } from "../models/Circle.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { serializeCircle } from "./circleService.js";
import { serializePostCard } from "./postSerializer.js";
import * as hashtagService from "./hashtagService.js";
import { serializeUser } from "./userSerializer.js";

export type SearchType = "all" | "posts" | "people" | "circles" | "hashtags";

const CARD_POPULATE = [
  { path: "authorId", select: "handle displayName avatarUrl role followerCount" },
  { path: "sourceId", select: "name siteUrl faviconUrl" },
  { path: "circleId", select: "name slug" },
];

export async function search(q: string, type: SearchType) {
  const limit = type === "all" ? 5 : 20;
  const trimmed = q ? q.trim() : "";
  const hasText = trimmed.length > 0;
  const textQuery = hasText ? { $text: { $search: trimmed } } : {};
  const score = hasText ? { score: { $meta: "textScore" } } : {};

  const wantPosts = type === "all" || type === "posts";
  const wantPeople = type === "all" || type === "people";
  const wantCircles = type === "all" || type === "circles";
  const wantHashtags = type === "all" || type === "hashtags";

  const [posts, people, circles, hashtags] = await Promise.all([
    wantPosts
      ? Post.find({ ...textQuery, status: "published" }, hasText ? score : {})
          .sort(hasText ? (score as any) : { publishedAt: -1 })
          .limit(limit)
          .populate(CARD_POPULATE)
      : [],
    wantPeople
      ? User.find({ ...textQuery, handle: { $exists: true } }, hasText ? score : {})
          .sort(hasText ? (score as any) : { followerCount: -1 })
          .limit(limit)
      : [],
    wantCircles
      ? Circle.find({ ...textQuery, isPrivate: { $ne: true } }, hasText ? score : {})
          .sort(hasText ? (score as any) : { memberCount: -1 })
          .limit(limit)
      : [],
    wantHashtags ? hashtagService.search({ q: trimmed, limit }) : [],
  ]);

  return {
    posts: posts.map((p) => serializePostCard(p)),
    people: people.map((u) => serializeUser(u)),
    circles: circles.map((c) => serializeCircle(c)),
    hashtags,
  };
}
