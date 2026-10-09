import { keepPreviousData } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchHashtags } from "../lib/api/generated/hashtags/hashtags";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { cleanHashtag, postsLabel } from "../lib/hashtag";

interface HashtagPickerProps {
  selected: string[];
  onChange: (hashtags: string[]) => void;
  max?: number;
}

/** Pick from existing hashtags: featured ones by default, searchable by prefix. Used for interests. */
export function HashtagPicker({ selected, onChange, max = 20 }: HashtagPickerProps) {
  const [text, setText] = useState("");
  const query = cleanHashtag(text);
  const debounced = useDebouncedValue(query, 150);
  const searching = debounced.length > 0;

  const { data, isLoading } = useSearchHashtags(
    searching ? { q: debounced, limit: 20 } : { featured: "true", limit: 30 },
    { query: { placeholderData: keepPreviousData, staleTime: 60_000 } },
  );

  const chosen = useMemo(() => new Set(selected), [selected]);
  // Hashtags picked from a search that are not in the featured list stay visible at the front.
  const options = useMemo(() => {
    const rows = (data ?? []).map((h) => ({ name: h.name, postCount: h.postCount }));
    if (searching) return rows;
    const known = new Set(rows.map((r) => r.name));
    return [...selected.filter((n) => !known.has(n)).map((name) => ({ name, postCount: -1 })), ...rows];
  }, [data, searching, selected]);

  function toggle(name: string) {
    if (chosen.has(name)) onChange(selected.filter((n) => n !== name));
    else if (selected.length < max) onChange([...selected, name]);
  }

  return (
    <div>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/^#+/, ""))}
        placeholder="Search hashtags…"
        aria-label="Search hashtags"
        className="mb-4 w-full rounded-full border border-[#EAEAEA] bg-white px-4 py-2 font-ui text-[14px] placeholder:text-[#8A8A8A] focus:border-[#999999] focus:outline-none"
      />
      {isLoading ? (
        <p className="font-ui text-sm text-[#8A8A8A]">Loading hashtags…</p>
      ) : options.length === 0 ? (
        <p className="font-ui text-sm text-[#8A8A8A]">No hashtags found for “{text}”.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const on = chosen.has(o.name);
            return (
              <button
                key={o.name}
                type="button"
                aria-pressed={on}
                disabled={!on && selected.length >= max}
                onClick={() => toggle(o.name)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 font-ui text-[13px] font-semibold transition-colors disabled:opacity-40 ${
                  on ? "border-[#E5552D] bg-[#E5552D] text-white" : "border-[#EAEAEA] bg-white text-[#111111] hover:border-[#999999]"
                }`}
              >
                #{o.name}
                {o.postCount >= 0 && <span className={`text-[11px] font-medium ${on ? "text-white/80" : "text-[#8A8A8A]"}`}>{postsLabel(o.postCount)}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
