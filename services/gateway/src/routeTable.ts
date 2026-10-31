import type { ServicePing } from "@centoire/bahamut";

export interface Upstream {
  name: string;
  instanceId: string;
  address: string;
  load: number;
  /** The registered route prefix that matched. */
  matched: string;
}

interface Entry {
  ping: ServicePing;
  seenAt: number;
}

/** In-memory route table built from service hello/goodbye announcements. */
export class RouteTable {
  private entries = new Map<string, Entry>();

  constructor(
    private ttlMs = 15_000,
    private now: () => number = Date.now,
    private rand: () => number = Math.random,
  ) {}

  apply(ping: ServicePing): void {
    if (ping.type === "goodbye") this.entries.delete(ping.instanceId);
    else this.entries.set(ping.instanceId, { ping, seenAt: this.now() });
  }

  private live(): ServicePing[] {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, e] of this.entries) if (e.seenAt < cutoff) this.entries.delete(id);
    return [...this.entries.values()].map((e) => e.ping);
  }

  /** Longest matching route prefix wins; ties are balanced by power-of-two-choices on load. */
  resolve(path: string, opts: { includePrivate: boolean; reserved?: string[] }): Upstream | undefined {
    const hit = this.match(path, opts);
    if (!hit) return undefined;
    // A reserved prefix belongs to an extracted service: if only a shorter (fallback)
    // route matched, the owner is down, so fail closed instead of letting core answer.
    const owner = opts.reserved?.find((r) => path === r || path.startsWith(`${r}/`));
    if (owner && hit.matched.length < owner.length) return undefined;
    return hit;
  }

  private match(path: string, opts: { includePrivate: boolean }): Upstream | undefined {
    let bestLen = -1;
    let bestPath = "";
    let candidates: ServicePing[] = [];
    for (const ping of this.live()) {
      for (const r of ping.routes) {
        if (r.private && !opts.includePrivate) continue;
        if (path !== r.path && !path.startsWith(r.path.endsWith("/") ? r.path : `${r.path}/`) && path !== r.path) continue;
        if (r.path.length > bestLen) {
          bestLen = r.path.length;
          bestPath = r.path;
          candidates = [ping];
        } else if (r.path.length === bestLen) {
          candidates.push(ping);
        }
      }
    }
    if (!candidates.length) return undefined;
    let pick = candidates[0]!;
    if (candidates.length >= 3) {
      const a = candidates[Math.floor(this.rand() * candidates.length)]!;
      const b = candidates[Math.floor(this.rand() * candidates.length)]!;
      pick = a.load <= b.load ? a : b;
    } else if (candidates.length === 2) {
      pick = candidates[0]!.load <= candidates[1]!.load ? candidates[0]! : candidates[1]!;
    }
    return { name: pick.name, instanceId: pick.instanceId, address: pick.address, load: pick.load, matched: bestPath };
  }

  snapshot(): ServicePing[] {
    return this.live();
  }
}
