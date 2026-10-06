import type { ReactNode } from "react";
import { SETTINGS_URL } from "../lib/auth";
import { errorMessage, httpStatus } from "../lib/format";
import { card } from "../lib/styles";
import { LinkBtn } from "./Btn";

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: { to: string; label: string } }) {
  return (
    <div className={`${card} flex flex-col items-center px-6 py-14 text-center`}>
      <h3 className="font-editorial text-[22px] font-bold italic text-[var(--color-charcoal)]">{title}</h3>
      {body && <p className="mt-2 max-w-md font-ui text-[14px] text-[var(--color-stone)]">{body}</p>}
      {action && (
        <LinkBtn to={action.to} className="mt-5">
          {action.label}
        </LinkBtn>
      )}
    </div>
  );
}

/** Inline error. On 403 (e.g. email not verified) it also points the user to their Centoire settings. */
export function ErrorNotice({ error, verifyHint = false }: { error: unknown; verifyHint?: boolean }) {
  if (!error) return null;
  const status = httpStatus(error);
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-ui text-[13px] text-red-700">
      {errorMessage(error)}
      {verifyHint && status === 403 && (
        <>
          {" "}
          <a href={SETTINGS_URL} target="_blank" rel="noopener noreferrer" className="font-bold underline">
            Open Centoire settings
          </a>
        </>
      )}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-ui text-[13px] text-emerald-800">
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex justify-center py-16">
      <span className="size-7 animate-spin rounded-full border-2 border-[var(--color-coral)] border-t-transparent" />
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-[#EDE9E4] ${className}`} />;
}

export function JobCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-[#EAEAEA] bg-white p-5">
      <div className="size-12 shrink-0 animate-pulse rounded-xl bg-[#EDE9E4]" />
      <div className="flex-1 space-y-3">
        <Bar className="h-4 w-2/3" />
        <Bar className="h-3 w-1/3" />
        <div className="flex gap-2">
          <Bar className="h-5 w-16" />
          <Bar className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LoadMore({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center pt-4">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-full border border-[#EAEAEA] bg-white px-8 py-2.5 font-ui text-[13px] font-bold uppercase tracking-wider text-[var(--color-charcoal)] hover:border-[#999] disabled:opacity-50"
      >
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
