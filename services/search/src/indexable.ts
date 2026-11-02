import type { Kind } from "./model.js";

type Item = Record<string, unknown>;

/**
 * Whether a document belongs in the read model at all. Anything else is removed instead of stored, so the
 * index only ever holds what a search can return (published, public) and stays small.
 */
export function isIndexable(kind: Kind, item: Item): boolean {
  switch (kind) {
    case "posts":
      return item.status === "published" && item.circlePrivate !== true;
    case "people":
      return item.hasHandle === true;
    case "circles":
      return item.isPrivate !== true;
    case "hashtags":
      return item.status === "active";
  }
}
