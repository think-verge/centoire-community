import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ children, className = "", ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-paper shadow-card">
      <table className={`w-full border-collapse text-sm ${className}`} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead {...rest}>
      <tr className="border-b border-line">{children}</tr>
    </thead>
  );
}

export function TableHeaderCell({
  children,
  className = "",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

export function TableBody({ children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...rest}>{children}</tbody>;
}

export function TableRow({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`border-b border-line last:border-0 hover:bg-cream/40 ${className}`} {...rest}>
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = "",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 align-top ${className}`} {...rest}>
      {children}
    </td>
  );
}
