import { useRef } from "react";
import type { PostCard as PostCardType } from "../lib/api/generated/model";

export function useFeedCardObserver({
  post: _post,
  position: _position,
}: {
  post: PostCardType;
  position?: number;
}) {
  const elementRef = useRef<HTMLElement | null>(null);
  // Feed card dwell and impression background DB writes disabled for performance & read-only feed
  return elementRef;
}
