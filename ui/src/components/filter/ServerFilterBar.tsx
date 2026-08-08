import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FilterFieldDef, FilterOption } from "./types";

interface Props {
  config: FilterFieldDef[];
  className?: string;
}

/**
 * Filter button + side panel. Manages pending filter state locally and commits
 * to URL search params on Apply. Mount alongside <ActiveFilterPills />.
 */
export function ServerFilterBar({ config, className = "" }: Props) {
  const [params, setParams] = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string>(config[0]?.key ?? "");
  const [pending, setPending] = useState<Record<string, string[]>>({});
  const [optionsCache, setOptionsCache] = useState<Record<string, FilterOption[]>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());

  // Committed filters from URL
  const activeFilters: Record<string, string[]> = {};
  for (const field of config) {
    const val = params.get(field.key);
    if (val) activeFilters[field.key] = field.type === "multi" ? val.split(",") : [val];
  }
  const filterCount = Object.values(activeFilters).flat().length;

  function openPanel() {
    setPending({ ...activeFilters });
    setActiveKey(config[0]?.key ?? "");
    setPanelOpen(true);
    if (config[0]) void maybeLoadOptions(config[0]);
  }

  function closePanel() {
    setPanelOpen(false);
  }

  async function maybeLoadOptions(field: FilterFieldDef) {
    if (!field.loadOptions || optionsCache[field.key] || loadingKeys.has(field.key)) return;
    setLoadingKeys((prev) => new Set([...prev, field.key]));
    try {
      const options = await field.loadOptions();
      setOptionsCache((prev) => ({ ...prev, [field.key]: options }));
    } finally {
      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(field.key);
        return next;
      });
    }
  }

  function selectField(field: FilterFieldDef) {
    setActiveKey(field.key);
    void maybeLoadOptions(field);
  }

  function getOptions(field: FilterFieldDef): FilterOption[] {
    return field.options ?? optionsCache[field.key] ?? [];
  }

  function toggleValue(fieldKey: string, value: string, type: FilterFieldDef["type"]) {
    setPending((prev) => {
      const current = prev[fieldKey] ?? [];
      if (type === "single") {
        return { ...prev, [fieldKey]: current[0] === value ? [] : [value] };
      }
      return {
        ...prev,
        [fieldKey]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  }

  function setTextValue(fieldKey: string, value: string) {
    setPending((prev) => ({ ...prev, [fieldKey]: value ? [value] : [] }));
  }

  function resetField(fieldKey: string) {
    setPending((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }

  function apply() {
    const nextParams = new URLSearchParams(params);
    for (const field of config) nextParams.delete(field.key);
    for (const [key, values] of Object.entries(pending)) {
      if (values.length > 0) nextParams.set(key, values.join(","));
    }
    setParams(nextParams, { replace: true });
    setPanelOpen(false);
  }

  // Close on Escape
  useEffect(() => {
    if (!panelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePanel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const activeField = config.find((f) => f.key === activeKey);
  const pendingValues = pending[activeKey] ?? [];
  const options = activeField ? getOptions(activeField) : [];
  const isLoading = loadingKeys.has(activeKey);

  return (
    <div className={className}>
      {/* Filter trigger button */}
      <button
        type="button"
        onClick={openPanel}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
          filterCount > 0
            ? "border-crimson bg-crimson/5 text-crimson"
            : "border-line bg-paper text-ink-soft hover:border-ink-soft hover:text-ink"
        }`}
      >
        <FilterIcon />
        Filters
        {filterCount > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-crimson text-[10px] font-bold text-white">
            {filterCount}
          </span>
        )}
      </button>

      {/* Side panel */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20"
            onClick={closePanel}
          />
          <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-full flex-col border-l border-line bg-paper shadow-card-hover">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="font-semibold text-ink">Filters</span>
              <button
                type="button"
                onClick={closePanel}
                className="text-xl leading-none text-ink-faint hover:text-ink"
                aria-label="Close filters"
              >
                ×
              </button>
            </div>

            {/* Body: 2-column */}
            <div className="flex min-h-0 flex-1">
              {/* Left sidebar: field list */}
              <div className="w-36 shrink-0 overflow-y-auto border-r border-line">
                {config.map((field) => {
                  const count = (pending[field.key] ?? []).length;
                  return (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => selectField(field)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                        activeKey === field.key
                          ? "bg-cream font-semibold text-ink"
                          : "text-ink-soft hover:bg-cream/60 hover:text-ink"
                      }`}
                    >
                      <span className="truncate">{field.label}</span>
                      {count > 0 && (
                        <span className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-crimson text-[10px] font-bold text-white">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right: options for active field */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeField?.type === "text" && (
                  <input
                    type="text"
                    placeholder={activeField.placeholder ?? `Filter by ${activeField.label.toLowerCase()}`}
                    value={pendingValues[0] ?? ""}
                    onChange={(e) => setTextValue(activeKey, e.target.value)}
                    className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder-ink-faint focus:border-crimson focus:outline-none"
                    autoFocus
                  />
                )}

                {(activeField?.type === "single" || activeField?.type === "multi") && (
                  <div className="space-y-0.5">
                    {isLoading && (
                      <p className="py-4 text-center text-sm text-ink-faint">Loading…</p>
                    )}
                    {!isLoading && options.length === 0 && (
                      <p className="py-4 text-center text-sm text-ink-faint">No options found.</p>
                    )}
                    {options.map((opt) => {
                      const selected = pendingValues.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleValue(activeKey, opt.value, activeField.type)}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            selected
                              ? "bg-crimson/5 text-ink"
                              : "text-ink-soft hover:bg-cream hover:text-ink"
                          }`}
                        >
                          {activeField.type === "multi" ? (
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                selected ? "border-crimson bg-crimson text-white" : "border-line"
                              }`}
                            >
                              {selected && <span className="text-[10px] leading-none">✓</span>}
                            </span>
                          ) : (
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                selected ? "border-crimson" : "border-line"
                              }`}
                            >
                              {selected && <span className="h-2 w-2 rounded-full bg-crimson" />}
                            </span>
                          )}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-line px-5 py-4">
              <button
                type="button"
                onClick={() => resetField(activeKey)}
                className="text-sm text-ink-soft hover:text-ink"
              >
                Reset field
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:border-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ink-inverse hover:bg-ink/90"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
