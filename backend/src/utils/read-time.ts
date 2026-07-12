const WORDS_PER_MINUTE = 220;

export function readTimeMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Walk TipTap JSON and collect all text nodes into a plain string. */
export function tiptapToPlainText(doc: unknown): string {
  const parts: string[] = [];
  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") {
      parts.push(n.text);
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
      // paragraph-level nodes separate words
      parts.push(" ");
    }
  }
  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}
