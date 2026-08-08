import { useSearchParams } from "react-router-dom";
import type { FilterFieldDef, FilterOption } from "./types";

interface Props {
  config: FilterFieldDef[];
  /** Cached options from ServerFilterBar (labels resolved from loaded options). */
  resolvedOptions?: Record<string, FilterOption[]>;
}

/**
 * Renders the active filter chips row with × buttons and a "Clear all" link.
 * Reads committed filters directly from the URL search params.
 */
export function ActiveFilterPills({ config, resolvedOptions = {} }: Props) {
  const [params, setParams] = useSearchParams();

  const pills: Array<{ fieldKey: string; fieldLabel: string; value: string; displayLabel: string }> = [];
  for (const field of config) {
    const raw = params.get(field.key);
    if (!raw) continue;
    const values = field.type === "multi" ? raw.split(",") : [raw];
    const opts = field.options ?? resolvedOptions[field.key] ?? [];
    for (const value of values) {
      const displayLabel = opts.find((o) => o.value === value)?.label ?? value;
      pills.push({ fieldKey: field.key, fieldLabel: field.label, value, displayLabel });
    }
  }

  if (pills.length === 0) return null;

  function removePill(fieldKey: string, value: string, isMulti: boolean) {
    const nextParams = new URLSearchParams(params);
    if (isMulti) {
      const current = (nextParams.get(fieldKey) ?? "").split(",").filter(Boolean);
      const next = current.filter((v) => v !== value);
      if (next.length === 0) nextParams.delete(fieldKey);
      else nextParams.set(fieldKey, next.join(","));
    } else {
      nextParams.delete(fieldKey);
    }
    setParams(nextParams, { replace: true });
  }

  function clearAll() {
    const nextParams = new URLSearchParams(params);
    for (const field of config) nextParams.delete(field.key);
    setParams(nextParams, { replace: true });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pills.map(({ fieldKey, fieldLabel, value, displayLabel }) => {
        const field = config.find((f) => f.key === fieldKey)!;
        return (
          <span
            key={`${fieldKey}:${value}`}
            className="flex items-center gap-1 rounded-full border border-line bg-cream px-2.5 py-0.5 text-xs text-ink-soft"
          >
            <span className="font-medium text-ink">{fieldLabel}:</span>
            {displayLabel}
            <button
              type="button"
              onClick={() => removePill(fieldKey, value, field.type === "multi")}
              className="ml-0.5 leading-none text-ink-faint hover:text-crimson"
              aria-label={`Remove ${fieldLabel} filter`}
            >
              ×
            </button>
          </span>
        );
      })}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs text-ink-faint hover:text-crimson"
      >
        Clear all
      </button>
    </div>
  );
}
