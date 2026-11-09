import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../Button";
import { SuggestionReasonBadge } from "./SuggestionReasonBadge";
import {
  useSuggestedCircles,
  useDismissSuggestion,
  type SuggestedCircle,
} from "../../lib/api/suggestions";
import { useJoinCircle } from "../../lib/api/generated/circles/circles";

interface SimilarCirclesModalProps {
  isOpen: boolean;
  onClose: () => void;
  joinedCircleName: string;
  currentCircleSlug?: string;
}

export function SimilarCirclesModal({
  isOpen,
  onClose,
  joinedCircleName,
  currentCircleSlug,
}: SimilarCirclesModalProps) {
  const { data: rawCircles, isLoading } = useSuggestedCircles(6);
  const dismissMutation = useDismissSuggestion();
  const joinMutation = useJoinCircle();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const circles = (rawCircles || [])
    .filter((c) => c.slug !== currentCircleSlug)
    .filter((c) => !dismissedIds.has(c.id));

  const handleDismiss = (circleId: string) => {
    setDismissedIds((prev) => new Set(prev).add(circleId));
    dismissMutation.mutate({ targetType: "circle", targetId: circleId });
  };

  const handleJoin = (circle: SuggestedCircle) => {
    setJoinedIds((prev) => new Set(prev).add(circle.id));
    joinMutation.mutate({ slug: circle.slug });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-paper border border-line shadow-2xl p-6 sm:p-7 overflow-hidden">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-ink-faint hover:text-ink rounded-full hover:bg-surface transition-colors cursor-pointer"
          aria-label="Close"
        >
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Joined {joinedCircleName}
          </div>
          <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-ink tracking-tight">
            Similar circles you might like
          </h2>
          <p className="text-sm text-ink-soft mt-1">
            Curated based on shared aesthetics, tags, and member community overlap.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3 py-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-surface/80 border border-line/40" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && circles.length === 0 && (
          <div className="py-8 text-center text-ink-soft text-sm">
            <p>You&apos;re all caught up! No more similar circles right now.</p>
            <Button variant="primary" className="mt-4" onClick={onClose}>
              Explore Circle
            </Button>
          </div>
        )}

        {/* Circles List */}
        {!isLoading && circles.length > 0 && (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {circles.map((circle) => {
              const isJoined = joinedIds.has(circle.id);
              return (
                <div
                  key={circle.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-line bg-surface/30 hover:border-ink-soft/40 transition-all"
                >
                  <Link
                    to={`/c/${circle.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3 min-w-0 flex-1 group"
                  >
                    <div className="size-11 rounded-lg bg-surface flex items-center justify-center font-display-serif font-bold text-lg text-ink border border-line shrink-0 overflow-hidden">
                      {circle.avatarUrl ? (
                        <img src={circle.avatarUrl} alt={circle.name} className="size-full object-cover" />
                      ) : (
                        circle.name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-ink group-hover:text-primary transition-colors truncate">
                          {circle.name}
                        </p>
                        <SuggestionReasonBadge reason={circle.reason} />
                      </div>
                      <p className="text-xs text-ink-faint truncate mt-0.5">
                        {circle.memberCount} members · {circle.description}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={isJoined ? "secondary" : "primary"}
                      onClick={() => handleJoin(circle)}
                      disabled={isJoined}
                      className="text-xs px-3 py-1 h-8"
                    >
                      {isJoined ? "Joined" : "Join"}
                    </Button>
                    <button
                      type="button"
                      aria-label="Dismiss circle"
                      onClick={() => handleDismiss(circle.id)}
                      className="p-1 text-ink-faint hover:text-ink rounded-full transition-colors cursor-pointer"
                      title="Not interested"
                    >
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-line flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
