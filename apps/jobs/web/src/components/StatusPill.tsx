import { prettify } from "../lib/format";

const TONES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_review: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-700",
  closed: "bg-gray-200 text-gray-700",
  expired: "bg-gray-200 text-gray-700",
  submitted: "bg-sky-100 text-sky-800",
  viewed: "bg-indigo-100 text-indigo-800",
  shortlisted: "bg-emerald-100 text-emerald-800",
  withdrawn: "bg-gray-200 text-gray-700",
  hired: "bg-[var(--color-coral)] text-white",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 font-ui text-[11px] font-bold uppercase tracking-wider ${TONES[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status === "pending_review" ? "Pending review" : prettify(status)}
    </span>
  );
}
