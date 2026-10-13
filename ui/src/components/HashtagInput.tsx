import { keepPreviousData } from "@tanstack/react-query";
import { useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { useSearchHashtags } from "../lib/api/generated/hashtags/hashtags";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { MAX_POST_HASHTAGS, cleanHashtag, postsLabel, toHashtag } from "../lib/hashtag";

interface HashtagInputProps {
  value: string[];
  onChange: (hashtags: string[]) => void;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  /** Id for the text field so an external <label htmlFor> can point at it. */
  id?: string;
}

const DEBOUNCE_MS = 120;
const SUGGESTION_LIMIT = 8;

/**
 * Instagram-style hashtag field: type to see matching hashtags with their usage counts, pick one
 * with the mouse or keyboard, or create a new one. Space, comma, Enter and paste all commit a tag.
 */
export function HashtagInput({ value, onChange, max = MAX_POST_HASHTAGS, placeholder, disabled, id }: HashtagInputProps) {
  const reactId = useId();
  const listId = `${reactId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);

  const query = cleanHashtag(text);
  const debounced = useDebouncedValue(query, DEBOUNCE_MS);
  const full = value.length >= max;
  const open = focused && !full && !disabled;

  const { data, isPlaceholderData } = useSearchHashtags(
    { q: debounced || undefined, limit: SUGGESTION_LIMIT },
    {
      query: {
        enabled: open,
        // Keep the previous suggestions on screen while the next request is in flight (no flicker).
        placeholderData: keepPreviousData,
        staleTime: 30_000,
      },
    },
  );

  const selected = useMemo(() => new Set(value), [value]);
  const suggestions = useMemo(() => (data ?? []).filter((h) => !selected.has(h.name)), [data, selected]);

  // Offer "Create #x" only once the results for exactly this text have arrived and none match it.
  const typed = toHashtag(text);
  const settled = !isPlaceholderData && debounced === query;
  const exists = typed ? (data ?? []).some((h) => h.name === typed) : false;
  const canCreate = Boolean(typed && settled && !exists && !selected.has(typed));
  const rows = useMemo(() => {
    const list = suggestions.map((h) => ({ name: h.name, label: postsLabel(h.postCount), isNew: false }));
    if (canCreate && typed) list.push({ name: typed, label: "New hashtag", isNew: true });
    return list;
  }, [suggestions, canCreate, typed]);
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  function add(raw: string[]) {
    const next = [...value];
    for (const item of raw) {
      const name = toHashtag(item);
      if (name && !next.includes(name) && next.length < max) next.push(name);
    }
    if (next.length !== value.length) onChange(next);
    setText("");
    setActive(0);
  }

  function remove(name: string) {
    onChange(value.filter((v) => v !== name));
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && rows.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp" && rows.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      // Enter/Tab accept the highlighted suggestion; with nothing typed they keep their normal job.
      if (text.trim()) {
        e.preventDefault();
        add([rows[activeIndex]?.name ?? text]);
      }
    } else if (e.key === "," || e.key === " ") {
      if (text.trim()) {
        e.preventDefault();
        add([text]);
      }
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    if (/[\s,#]/.test(pasted.trim())) {
      e.preventDefault();
      add(pasted.split(/[\s,#]+/));
    }
  }

  return (
    <div className="relative">
      <div
        className="flex min-h-[48px] w-full flex-wrap items-center gap-2 rounded-[10px] border border-[#D0D0D0] bg-white px-3 py-2 focus-within:border-[#999999]"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((name) => (
          <span key={name} className="inline-flex items-center gap-1 rounded-full bg-[#FFF1EE] px-3 py-1 font-ui text-[13px] font-semibold text-[#E5552D]">
            #{name}
            <button
              type="button"
              aria-label={`Remove #${name}`}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                remove(name);
              }}
              className="-mr-1 flex size-4 items-center justify-center rounded-full text-[#E5552D]/70 hover:bg-[#E5552D]/10 hover:text-[#E5552D]"
            >
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open && rows.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows.length ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled}
          value={text}
          placeholder={full ? `Maximum of ${max} hashtags` : (placeholder ?? (value.length ? "Add another…" : "Type a hashtag, e.g. #streetwear"))}
          onChange={(e) => {
            setText(e.target.value.replace(/^#+/, ""));
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (toHashtag(text)) add([text]); // don't silently drop a tag the user typed but didn't confirm
          }}
          className="min-w-[160px] flex-1 bg-transparent font-ui text-[14px] text-[#111111] placeholder:text-[#A3A3A3] focus:outline-none disabled:cursor-not-allowed"
        />
        <span className="ml-auto font-ui text-[11px] text-[#8A8A8A]" aria-live="polite">
          {value.length}/{max}
        </span>
      </div>

      {open && rows.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1.5 max-h-72 overflow-auto rounded-[12px] border border-[#EAEAEA] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {rows.map((row, i) => (
            <li
              key={row.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown (not click) so it fires before the input's blur handler closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                add([row.name]);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 ${i === activeIndex ? "bg-[#FAF6F2]" : ""}`}
            >
              <span className="font-ui text-[14px] font-semibold text-[#111111]">
                {row.isNew ? "Create " : ""}#{row.name}
              </span>
              <span className={`font-ui text-[12px] ${row.isNew ? "font-semibold text-[#E5552D]" : "text-[#8A8A8A]"}`}>{row.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
