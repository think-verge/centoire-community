import { customInstance } from "./api/http";
import type { EventItemInput } from "./api/generated/model";

const FLUSH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 20;
const MAX_QUEUE_SIZE = 100;

class FeedEventTracker {
  private queue: EventItemInput[] = [];
  private timer: NodeJS.Timeout | null = null;
  private seenImpressions = new Set<string>();
  private seenReads = new Set<string>();
  private activeDwells = new Map<string, { startTime: number; accumulatedMs: number }>();

  constructor() {
    if (typeof window !== "undefined") {
      this.timer = setInterval(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);

      const handleUnload = () => {
        this.flushWithBeacon();
      };

      window.addEventListener("pagehide", handleUnload);
      window.addEventListener("beforeunload", handleUnload);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
          this.flushWithBeacon();
        }
      });
    }
  }

  /**
   * Stop background flush timer and cleanup.
   */
  public dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Enqueue a behavioural event.
   */
  public enqueue(event: EventItemInput): void {
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Discard oldest if buffer is overwhelmed
      this.queue.shift();
    }
    this.queue.push({
      ...event,
      at: event.at || new Date().toISOString(),
    });

    if (this.queue.length >= MAX_BATCH_SIZE) {
      void this.flush();
    }
  }

  /**
   * Reset session impression & read sets (e.g. on pull-to-refresh).
   */
  public resetSessionTracking(): void {
    this.seenImpressions.clear();
    this.seenReads.clear();
    this.activeDwells.clear();
  }

  /**
   * Track post impression (fires once per post per session).
   */
  public trackImpression(post: {
    id: string;
    position?: number;
    source?: string;
    score?: number;
  }): void {
    if (this.seenImpressions.has(post.id)) return;
    this.seenImpressions.add(post.id);

    if (import.meta.env.DEV) {
      console.log(
        `[FeedTracker] 👁️ Impression tracked for post ${post.id.slice(-6)} (pos ${post.position ?? "unknown"})`,
      );
    }

    this.enqueue({
      action: "impression",
      postId: post.id,
      position: post.position,
      source: post.source || "feed",
      score: post.score,
    });
  }

  /**
   * Card entered viewport: start or resume dwell tracking.
   */
  public startDwell(postId: string): void {
    const existing = this.activeDwells.get(postId) || { startTime: 0, accumulatedMs: 0 };
    if (existing.startTime === 0) {
      existing.startTime = Date.now();
    }
    this.activeDwells.set(postId, existing);
  }

  /**
   * Card left viewport: pause dwell tracking and accumulate elapsed time.
   */
  public pauseDwell(
    postId: string,
    postMeta?: { position?: number; source?: string; score?: number },
  ): void {
    const existing = this.activeDwells.get(postId);
    if (!existing || existing.startTime === 0) return;

    const elapsed = Date.now() - existing.startTime;
    existing.accumulatedMs += elapsed;
    existing.startTime = 0; // paused

    // If accumulated dwell reached >= 10s and read not yet emitted
    if (existing.accumulatedMs >= 10000 && !this.seenReads.has(postId)) {
      this.triggerRead(postId, existing.accumulatedMs, postMeta);
    }
  }

  /**
   * Check active dwell in-flight and trigger read if >= 10s.
   */
  public checkActiveDwell(
    postId: string,
    postMeta?: { position?: number; source?: string; score?: number },
  ): void {
    if (this.seenReads.has(postId)) return;
    const existing = this.activeDwells.get(postId);
    if (!existing) return;

    const currentTotal =
      existing.accumulatedMs + (existing.startTime > 0 ? Date.now() - existing.startTime : 0);

    if (import.meta.env.DEV) {
      const elapsedSec = Math.floor(currentTotal / 1000);
      const trackerObj = existing as { startTime: number; accumulatedMs: number; lastLoggedSec?: number };
      if (elapsedSec > 0 && elapsedSec <= 10 && elapsedSec !== trackerObj.lastLoggedSec) {
        trackerObj.lastLoggedSec = elapsedSec;
        console.log(`[FeedTracker] ⏱️ Dwell post ${postId.slice(-6)}: ${elapsedSec}s / 10s`);
      }
    }

    if (currentTotal >= 10000) {
      this.triggerRead(postId, currentTotal, postMeta);
    }
  }

  private triggerRead(
    postId: string,
    dwellMs: number,
    postMeta?: { position?: number; source?: string; score?: number },
  ): void {
    if (this.seenReads.has(postId)) return;
    this.seenReads.add(postId);

    if (import.meta.env.DEV) {
      console.log(
        `[FeedTracker] 📖 Read triggered (>=10s dwell) for post: ${postId.slice(-6)} (${Math.round(dwellMs / 1000)}s total). Flushing event...`,
      );
    }

    this.enqueue({
      action: "read",
      postId,
      position: postMeta?.position,
      source: postMeta?.source || "feed",
      score: postMeta?.score,
      dwellMs: Math.round(dwellMs),
    });

    // Immediately flush read events so developer sees network request without 5s batch delay!
    void this.flush();
  }

  /**
   * Track hide action.
   */
  public trackHide(postId: string): void {
    this.enqueue({
      action: "hide",
      postId,
    });
  }

  /**
   * Track report action.
   */
  public trackReport(postId: string): void {
    this.enqueue({
      action: "report",
      postId,
    });
  }

  /**
   * Standard batch flush via customInstance POST /events.
   */
  public async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    this.queue = [];

    try {
      await customInstance({
        url: "/events",
        method: "POST",
        data: { events: batch },
      });
    } catch (err) {
      // Re-queue items if transmission failed and queue has room
      if (this.queue.length + batch.length <= MAX_QUEUE_SIZE) {
        this.queue.unshift(...batch);
      }
      console.warn("[FeedEventTracker] Failed to flush events batch", err);
    }
  }

  /**
   * Emergency flush on navigation / pagehide using sendBeacon.
   */
  public flushWithBeacon(): void {
    if (this.queue.length === 0) return;
    const batch = [...this.queue];
    this.queue = [];

    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
    const endpoint = `${baseUrl}/api/v1/events`;
    const payload = JSON.stringify({ events: batch });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (!sent) {
        this.fallbackKeepaliveFetch(endpoint, payload);
      }
    } else {
      this.fallbackKeepaliveFetch(endpoint, payload);
    }
  }

  private fallbackKeepaliveFetch(endpoint: string, payload: string): void {
    try {
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      // Best-effort
    }
  }
}

export const feedEventTracker = new FeedEventTracker();
