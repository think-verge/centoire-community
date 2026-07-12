import { Tag, type ITag, type TagCategory } from "../models/Tag.js";
import { ApiError } from "../utils/api-error.js";

export async function listTags(category?: TagCategory): Promise<ITag[]> {
  const filter = category ? { category } : {};
  return Tag.find(filter).sort({ name: 1 });
}

export async function getTagBySlug(slug: string): Promise<ITag> {
  const tag = await Tag.findOne({ slug });
  if (!tag) throw new ApiError(404, "Tag not found");
  return tag;
}

export function serializeTag(tag: ITag) {
  return {
    id: tag._id.toString(),
    name: tag.name,
    slug: tag.slug,
    category: tag.category,
    description: tag.description ?? null,
    postCount: tag.postCount,
    followerCount: tag.followerCount,
  };
}
