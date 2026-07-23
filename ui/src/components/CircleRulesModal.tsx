import { Button } from "./Button";
import type { Circle } from "../lib/api/generated/model";

interface Props {
  circle: Pick<Circle, "name" | "rules">;
  onCancel: () => void;
  onAgree: () => void;
  loading?: boolean;
}

export function CircleRulesModal({ circle, onCancel, onAgree, loading }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Circle rules"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-card-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="kicker mb-1">Before you join</p>
        <h2 className="font-display-serif text-2xl font-semibold">{circle.name} rules</h2>
        <ol className="mt-4 space-y-2">
          {circle.rules.map((rule, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink-soft">
              <span className="font-display-serif font-semibold text-gold">{i + 1}</span>
              {rule}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={loading} onClick={onAgree}>
            Agree & join
          </Button>
        </div>
      </div>
    </div>
  );
}
