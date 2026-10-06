import { useId, useState, type KeyboardEvent } from "react";
import { inputCls, labelCls } from "../lib/styles";

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  maxLength?: number;
  placeholder?: string;
}

export function TagInput({ label, value, onChange, max, maxLength = 40, placeholder = "Type and press Enter" }: TagInputProps) {
  const id = useId();
  const [draft, setDraft] = useState("");

  const commit = () => {
    const parts = draft.split(",").map((s) => s.trim().slice(0, maxLength)).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label} <span className="font-normal normal-case tracking-normal text-[var(--color-taupe)]">({value.length}/{max})</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-blush)]/60 px-3 py-1 font-ui text-[12px] font-semibold text-[var(--color-charcoal)]">
            {tag}
            <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((v) => v !== tag))} className="text-[var(--color-stone)] hover:text-[var(--color-coral)]">
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={commit}
        disabled={value.length >= max}
        maxLength={maxLength * 3}
        placeholder={value.length >= max ? `Maximum of ${max} reached` : placeholder}
        className={`${inputCls} mt-2`}
      />
    </div>
  );
}
