import { Circle } from "../models/Circle.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { serializeCircle } from "./circleService.js";
import { serializePostCard } from "./postSerializer.js";
import * as hashtagService from "./hashtagService.js";
import { serializeUser } from "./userSerializer.js";

export type SearchType = "all" | "posts" | "people" | "circles" | "hashtags";

const CARD_POPULATE = [
  { path: "authorId", select: "handle displayName avatarUrl" },
  { path: "sourceId", select: "name siteUrl faviconUrl" },
  { path: "circleId", select: "name slug" },
];

export async function search(q: string, type: SearchType) {
  const limit = type === "all" ? 5 : 20;
  const textQuery = { $text: { $search: q } };
  const score = { score: { $meta: "textScore" } };

  const wantPosts = type === "all" || type === "posts";
  const wantPeople = type === "all" || type === "people";
  const wantCircles = type === "all" || type === "circles";
  const wantHashtags = type === "all" || type === "hashtags";

  const [posts, people, circles, hashtags] = await Promise.all([
    wantPosts
      ? Post.find({ ...textQuery, status: "published" }, score)
          .sort(score)
          .limit(limit)
          .populate(CARD_POPULATE)
      : [],
    wantPeople
      ? User.find({ ...textQuery, handle: { $exists: true } }, score)
          .sort(score)
          .limit(limit)
      : [],
    wantCircles
      ? Circle.find(textQuery, score).sort(score).limit(limit)
      : [],
    wantHashtags ? hashtagService.search({ q, limit }) : [],
  ]);

  return {
    posts: posts.map((p) => serializePostCard(p)),
    people: people.map((u) => serializeUser(u)),
    circles: circles.map((c) => serializeCircle(c)),
    hashtags,
  };
}
