import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IBookmark extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  folderId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const bookmarkSchema = new Schema<IBookmark>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    folderId: { type: Schema.Types.ObjectId, ref: "BookmarkFolder" },
  },
  { timestamps: true },
);

bookmarkSchema.index({ userId: 1, postId: 1 }, { unique: true });
bookmarkSchema.index({ userId: 1, folderId: 1, createdAt: -1 });

export const Bookmark = mongoose.model<IBookmark>("Bookmark", bookmarkSchema);

export interface IBookmarkFolder extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookmarkFolderSchema = new Schema<IBookmarkFolder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { timestamps: true },
);

bookmarkFolderSchema.index({ userId: 1, name: 1 }, { unique: true });

export const BookmarkFolder = mongoose.model<IBookmarkFolder>(
  "BookmarkFolder",
  bookmarkFolderSchema,
);
