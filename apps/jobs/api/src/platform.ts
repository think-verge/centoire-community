import type { UserSummary } from "@centoire/contracts";
import { ApiError } from "@centoire/server-kit";
import { env } from "./config/env.js";

/**
 * Client for core's internal platform API. jobs-api never reads the core database: users,
 * names and verification state all come through here (x-internal-secret, same as ai-agent).
 */
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: UserSummary }>();

async function core<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`${env.CORE_API_URL}/api/v1/internal${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-internal-secret": env.AI_INTERNAL_SECRET,
      ...(init?.headers ?? {}),
    },
  }).catch(() => null);
  if (!res) throw new ApiError(503, "Centoire accounts service is unavailable");
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(502, "Centoire accounts service returned an error");
  return (await res.json()) as T;
}

export async function getUserSummaries(ids: string[], opts: { fresh?: boolean } = {}): Promise<Map<string, UserSummary>> {
  const result = new Map<string, UserSummary>();
  const missing: string[] = [];
  for (const id of new Set(ids)) {
    const hit = cache.get(id);
    if (!opts.fresh && hit && Date.now() - hit.at < TTL_MS) result.set(id, hit.value);
    else missing.push(id);
  }
  if (missing.length > 0) {
    const rows = (await core<UserSummary[]>("/users/summaries", { method: "POST", body: JSON.stringify({ ids: missing }) })) ?? [];
    for (const row of rows) {
      cache.set(row.id, { at: Date.now(), value: row });
      result.set(row.id, row);
    }
  }
  return result;
}

export async function getUserByHandle(handle: string): Promise<UserSummary | null> {
  const user = await core<UserSummary>(`/users/by-handle/${encodeURIComponent(handle)}`);
  if (user) cache.set(user.id, { at: Date.now(), value: user });
  return user;
}

/** Always asks core, so a user who just verified their email isn't blocked by a stale cache. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const users = await getUserSummaries([userId], { fresh: true });
  return users.get(userId)?.emailVerified ?? false;
}
