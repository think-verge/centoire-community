import { useEffect, useRef } from "react";
import type { PostCard as PostCardType } from "../lib/api/generated/model";
import { feedEventTracker } from "../lib/feedEventTracker";

export function useFeedCardObserver({
  post,
  position,
}: {
  post: PostCardType;
  position?: number;
}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const dwellCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || typeof window === "undefined" || !("IntersectionObserver" in window)) {
      return;
    }

    const postMeta = {
      position,
      source: post.source?.name || post.origin || "feed",
      score: (post as unknown as { recsysScore?: number; score?: number }).recsysScore ??
        (post as unknown as { recsysScore?: number; score?: number }).score,
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        // Consider card visible if at least 20% in viewport or intersecting on compact/mobile screens
        if (entry.isIntersecting && entry.intersectionRatio >= 0.2) {
          // 1. Fire impression once
          feedEventTracker.trackImpression({
            id: post.id,
            position: postMeta.position,
            source: postMeta.source,
            score: postMeta.score,
          });

          // 2. Start active dwell
          feedEventTracker.startDwell(post.id);

          // 3. Periodic check while visible so read triggers at exactly 10s
          if (!dwellCheckInterval.current) {
            dwellCheckInterval.current = setInterval(() => {
              feedEventTracker.checkActiveDwell(post.id, postMeta);
            }, 1000);
          }
        } else {
          // Left viewport: pause dwell
          if (dwellCheckInterval.current) {
            clearInterval(dwellCheckInterval.current);
            dwellCheckInterval.current = null;
          }
          feedEventTracker.pauseDwell(post.id, postMeta);
        }
      },
      {
        threshold: [0, 0.2, 0.5],
      },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (dwellCheckInterval.current) {
        clearInterval(dwellCheckInterval.current);
        dwellCheckInterval.current = null;
      }
      feedEventTracker.pauseDwell(post.id, postMeta);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, post.origin, post.source?.name, position]);

  return elementRef;
}
