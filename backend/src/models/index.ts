// Central model registry: importing this file registers every Mongoose model,
// so populate() calls never hit MissingSchemaError regardless of request path.
import "./User.js";
import "./Tag.js";
import "./Circle.js";
import "./CircleMembership.js";
import "./Follow.js";
import "./Source.js";
import "./Post.js";
import "./Comment.js";
import "./Vote.js";
import "./Bookmark.js";
import "./ReputationEvent.js";
