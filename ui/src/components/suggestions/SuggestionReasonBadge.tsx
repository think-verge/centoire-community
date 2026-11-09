export function SuggestionReasonBadge({ reason }: { reason?: string }) {
  if (!reason) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(228,87,46,0.08)] px-2.5 py-0.5 text-[11px] font-medium text-[#E4572E]">
      <svg className="size-3 text-[#E4572E] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <span className="truncate max-w-[220px]">{reason}</span>
    </div>
  );
}
