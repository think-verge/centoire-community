import type { ServiceClient } from "@centoire/bahamut";
import { isIndexable } from "./indexable.js";
import { MODELS, SyncState, type Kind } from "./model.js";

const KINDS: Kind[] = ["posts", "people", "circles", "hashtags"];
const BATCH = 200;

interface ChangePage {
  items: Array<{ id: string } & Record<string, unknown>>;
  nextCursor: string | null;
}

/** Drains core's change feed for one kind into the local read model, resuming from the saved cursor. */
export async function syncKind(core: ServiceClient, kind: Kind): Promise<number> {
  const state = await SyncState.findById(kind).lean();
  let cursor = state?.cursor ?? undefined;
  let total = 0;
  for (;;) {
    const query: Record<string, string> = { limit: String(BATCH) };
    if (cursor) query.cursor = cursor;
    const page = await core.request<ChangePage>("GET", `/internal/sync/${kind}`, { query });
    if (page.items.length) {
      const keep = page.items.filter((i) => isIndexable(kind, i));
      const drop = page.items.filter((i) => !isIndexable(kind, i)).map((i) => i.id);
      await MODELS[kind].bulkWrite([
        ...keep.map(({ id, ...doc }) => ({
          replaceOne: { filter: { _id: id }, replacement: { _id: id, ...doc }, upsert: true },
        })),
        ...(drop.length ? [{ deleteMany: { filter: { _id: { $in: drop } } } }] : []),
      ] as never);
      total += page.items.length;
    }
    if (page.nextCursor) {
      cursor = page.nextCursor;
      await SyncState.updateOne({ _id: kind }, { $set: { cursor, syncedAt: new Date() } }, { upsert: true });
    }
    if (page.items.length < BATCH) return total;
  }
}

export async function syncAll(core: ServiceClient): Promise<void> {
  for (const kind of KINDS) {
    try {
      const n = await syncKind(core, kind);
      if (n) console.log(`[search] synced ${n} ${kind}`);
    } catch (err) {
      console.error(`[search] sync ${kind} failed:`, (err as Error).message);
    }
  }
}

/**
 * Deletes are invisible to an updatedAt feed, so periodically compare id sets and drop
 * anything core no longer has. Aborts without deleting if the id listing is incomplete.
 */
export async function reconcileDeletes(core: ServiceClient): Promise<void> {
  for (const kind of KINDS) {
    try {
      const live = new Set<string>();
      let after: string | undefined;
      do {
        const q: Record<string, string> = after ? { after } : {};
        const page = await core.request<{ ids: string[]; next: string | null }>("GET", `/internal/sync/${kind}/ids`, { query: q });
        page.ids.forEach((i) => live.add(i));
        after = page.next ?? undefined;
      } while (after);

      const stale: string[] = [];
      for await (const d of MODELS[kind].find({}, { _id: 1 }).lean().cursor()) {
        if (!live.has(String(d._id))) stale.push(String(d._id));
      }
      if (stale.length) {
        await MODELS[kind].deleteMany({ _id: { $in: stale } });
        console.log(`[search] reconciled: removed ${stale.length} stale ${kind}`);
      }
    } catch (err) {
      console.error(`[search] reconcile ${kind} aborted:`, (err as Error).message);
    }
  }
}

export function startSyncLoops(core: ServiceClient, intervalMs: number, reconcileMs: number): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await syncAll(core);
    } finally {
      running = false;
    }
  };
  void tick().then(() => reconcileDeletes(core));
  setInterval(tick, intervalMs).unref();
  setInterval(() => void reconcileDeletes(core), reconcileMs).unref();
}
