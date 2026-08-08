import { useSearchParams } from "react-router-dom";
import type { FilterFieldDef } from "./types";

/** Reads the current committed filter values from the URL search params. */
export function useServerFilter(config: FilterFieldDef[]): {
  activeFilters: Record<string, string[]>;
  filterCount: number;
  hasActiveFilters: boolean;
} {
  const [params] = useSearchParams();
  const activeFilters: Record<string, string[]> = {};

  for (const field of config) {
    const val = params.get(field.key);
    if (val) {
      activeFilters[field.key] = field.type === "multi" ? val.split(",") : [val];
    }
  }

  const filterCount = Object.values(activeFilters).flat().length;
  return { activeFilters, filterCount, hasActiveFilters: filterCount > 0 };
}
