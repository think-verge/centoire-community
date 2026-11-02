import mongoose, { Schema } from "mongoose";

// Read models, keyed by the owning service's id. `card` is the pre-serialized wire
// object, returned verbatim; the other fields exist only to filter, match and rank.
const opts = { versionKey: false, _id: false } as const;

export const PostDoc = mongoose.model(
  "SearchPost",
  new Schema(
    {
      _id: String,
      status: String,
      circlePrivate: Boolean,
      title: String,
      excerpt: String,
      summary: String,
      hashtags: [String],
      publishedAt: Date,
      card: Schema.Types.Mixed,
    },
    opts,
  ).index({ title: "text", excerpt: "text", summary: "text", hashtags: "text" }).index({ status: 1, publishedAt: -1 }),
  "search_posts",
);

export const PersonDoc = mongoose.model(
  "SearchPerson",
  new Schema(
    { _id: String, hasHandle: Boolean, handle: String, displayName: String, bio: String, followerCount: Number, card: Schema.Types.Mixed },
    opts,
  ).index({ handle: "text", displayName: "text", bio: "text" }).index({ hasHandle: 1, followerCount: -1 }),
  "search_people",
);

export const CircleDoc = mongoose.model(
  "SearchCircle",
  new Schema(
    { _id: String, isPrivate: Boolean, name: String, description: String, memberCount: Number, card: Schema.Types.Mixed },
    opts,
  ).index({ name: "text", description: "text" }).index({ isPrivate: 1, memberCount: -1 }),
  "search_circles",
);

export const HashtagDoc = mongoose.model(
  "SearchHashtag",
  new Schema({ _id: String, name: String, postCount: Number, status: String }, opts).index({ name: 1 }).index({ postCount: -1 }),
  "search_hashtags",
);

export const SyncState = mongoose.model(
  "SyncState",
  new Schema({ _id: String, cursor: String, syncedAt: Date }, opts),
  "sync_state",
);

export type Kind = "posts" | "people" | "circles" | "hashtags";
// Uniform handle for the generic sync/reconcile code, which treats every kind alike.
export const MODELS: Record<Kind, mongoose.Model<any>> = {
  posts: PostDoc,
  people: PersonDoc,
  circles: CircleDoc,
  hashtags: HashtagDoc,
};
