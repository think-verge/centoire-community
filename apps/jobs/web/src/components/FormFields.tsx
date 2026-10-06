import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { inputCls, labelCls } from "../lib/styles";
import { prettify } from "../lib/format";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (id: string) => ReactNode;
  className?: string;
}

export function FieldShell({ label, hint, error, children, className = "" }: FieldShellProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 font-ui text-[12px] text-[var(--color-taupe)]">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 font-ui text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

type TextProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string; wrapClass?: string };
export function TextInput({ label, hint, error, wrapClass, className = "", ...rest }: TextProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapClass}>
      {(id) => <input id={id} className={`${inputCls} ${className}`} {...rest} />}
    </FieldShell>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string; wrapClass?: string };
export function TextArea({ label, hint, error, wrapClass, className = "", ...rest }: AreaProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapClass}>
      {(id) => <textarea id={id} className={`${inputCls} ${className}`} {...rest} />}
    </FieldShell>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  format?: (value: string) => string;
  hint?: ReactNode;
  wrapClass?: string;
};
export function SelectInput({ label, value, onChange, options, placeholder, format = prettify, hint, wrapClass, className = "", ...rest }: SelectProps) {
  return (
    <FieldShell label={label} hint={hint} className={wrapClass}>
      {(id) => (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} ${className}`} {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {format(o)}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

interface CheckProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}
export function Checkbox({ label, checked, onChange, disabled }: CheckProps) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-ui text-[13px] text-[var(--color-charcoal)]">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-[#CFCFCF] accent-[var(--color-coral)]"
      />
      {label}
    </label>
  );
}

/** Toggle chips for small multi-select enums (workplace prefs, desired functions). */
export function ChipToggleGroup({ label, options, selected, onToggle, max }: { label: string; options: readonly string[]; selected: readonly string[]; onToggle: (v: string) => void; max?: number }) {
  return (
    <fieldset>
      <legend className={labelCls}>{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          const blocked = !on && max !== undefined && selected.length >= max;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              disabled={blocked}
              onClick={() => onToggle(o)}
              className={`rounded-full border px-3.5 py-1.5 font-ui text-[12px] font-semibold transition-colors disabled:opacity-40 ${
                on ? "border-[var(--color-coral)] bg-[var(--color-coral)] text-white" : "border-[#EAEAEA] bg-white text-[var(--color-stone)] hover:border-[#999]"
              }`}
            >
              {prettify(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
