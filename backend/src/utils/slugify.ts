import { randomBytes } from "node:crypto";

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled"
  );
}

export function slugifyWithId(text: string): string {
  return `${slugify(text)}-${randomBytes(4).toString("hex")}`;
}
