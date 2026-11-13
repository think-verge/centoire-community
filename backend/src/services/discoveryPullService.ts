/**
 * The discovery engine keeps a queue of stories worth putting up for review; the backend pulls it.
 * A cursor (the engine's `nextSince`) is persisted so a restart resumes where it stopped.
 */
import { z } from "zod";
import { env } from "../config/env.js";
import { DiscoveryCursor } from "../models/DiscoveryCursor.js";
import { StoryCandidateSchema } from "../routes/discoveryRoutes.js";
import { ApiError } from "../utils/api-error.js";
import { upsertStory } from "./discoveryService.js";

const CURSOR_ID = "queue";
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const TIMEOUT_MS = 20_000;

const QueuePageSchema = z.object({
  items: z.array(z.object({ storyId: z.string(), queuedAt: z.string().optional(), payload: z.unknown() })),
  nextSince: z.string(),
});

export interface FetchRequestResult {
  polled: number;
  newItems: number;
  queued: number;
  pulled: number;
}

let pulling = false;

async function engine(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${env.DISCOVERY_ENGINE_URL.replace(/\/+$/, "")}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "x-internal-secret": env.DISCOVERY_ENGINE_SECRET, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiError(503, `The discovery engine is unreachable: ${(err as Error).message}`);
  }
  if (res.status === 404 && path.startsWith("/fetch")) throw new ApiError(404, "The discovery engine does not watch this source");
  if (!res.ok) throw new ApiError(503, `The discovery engine answered ${res.status}`);
  return res;
}

/** Read the queue from the saved cursor until it is empty. Returns how many stories were saved. */
export async function pullQueue(): Promise<{ pulled: number; skipped: number }> {
  if (pulling) return { pulled: 0, skipped: 0 };
  pulling = true;
  try {
    const cursor = await DiscoveryCursor.findById(CURSOR_ID);
    let since = cursor?.since ? cursor.since.toISOString() : new Date(0).toISOString();
    let pulled = 0;
    let skipped = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await engine(`/queue?since=${encodeURIComponent(since)}&limit=${PAGE_SIZE}`);
      const parsed = QueuePageSchema.safeParse(await res.json().catch(() => null));
      if (!parsed.success) throw new ApiError(503, "The discovery engine sent an unreadable queue page");
      const { items, nextSince } = parsed.data;
      if (items.length === 0) break;
      for (const item of items) {
        const story = StoryCandidateSchema.safeParse(item.payload);
        if (!story.success) {
          skipped++;
          console.warn(`[discovery-pull] skipped invalid story ${item.storyId}: ${story.error.issues[0]?.message}`);
          continue;
        }
        try {
          await upsertStory(story.data);
          pulled++;
        } catch (err) {
          skipped++;
          console.warn(`[discovery-pull] could not save story ${item.storyId}:`, err);
        }
      }
      since = nextSince;
      await DiscoveryCursor.findByIdAndUpdate(CURSOR_ID, { since: new Date(since) }, { upsert: true });
      if (items.length < PAGE_SIZE) break;
    }
    return { pulled, skipped };
  } finally {
    pulling = false;
  }
}

/** Ask the engine to poll now (one source or all), then pull whatever it queued. */
export async function requestFetch(sourceId?: string): Promise<FetchRequestResult> {
  const res = await engine("/fetch", { method: "POST", body: JSON.stringify({ sourceId: sourceId ?? null }) });
  const stats = z
    .object({ polled: z.number(), newItems: z.number(), queued: z.number() })
    .safeParse(await res.json().catch(() => null));
  if (!stats.success) throw new ApiError(503, "The discovery engine sent unreadable fetch stats");
  const { pulled } = await pullQueue();
  return { ...stats.data, pulled };
}
