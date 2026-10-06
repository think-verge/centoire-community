import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@centoire/web-platform";
import { BookmarkIcon } from "@centoire/ui";
import { useSaveJob, useUnsaveJob } from "../lib/api/generated/jobs/jobs";
import { goToLogin } from "../lib/auth";
import { invalidatePrefixes } from "../lib/invalidate";

interface Props {
  jobId: string;
  saved: boolean;
  /** "icon" for cards, "full" shows a text label. */
  variant?: "icon" | "full";
}

export function SaveButton({ jobId, saved, variant = "icon" }: Props) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const onSettled = () => invalidatePrefixes(queryClient, "/jobs", "/me/saved-jobs", "/companies");
  const save = useSaveJob({ mutation: { onSettled } });
  const unsave = useUnsaveJob({ mutation: { onSettled } });
  const busy = save.isPending || unsave.isPending;
  const label = saved ? "Remove from saved jobs" : "Save job";

  const toggle = () => {
    if (!user) return goToLogin();
    if (saved) unsave.mutate({ id: jobId });
    else save.mutate({ id: jobId });
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--color-charcoal)] bg-white px-6 py-2.5 font-ui text-[13px] font-bold uppercase tracking-wider text-[var(--color-charcoal)] hover:bg-[var(--color-sand)] disabled:opacity-50"
      >
        <BookmarkIcon className={`size-4 ${saved ? "fill-[var(--color-coral)] text-[var(--color-coral)]" : ""}`} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className="rounded-full p-2 text-[var(--color-stone)] hover:bg-[var(--color-sand)] disabled:opacity-50"
    >
      <BookmarkIcon className={`size-5 ${saved ? "fill-[var(--color-coral)] text-[var(--color-coral)]" : ""}`} />
    </button>
  );
}
