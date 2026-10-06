import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useApproveJob, useListPendingJobs, useRejectJob } from "../../lib/api/generated/admin/admin";
import type { Job } from "../../lib/api/generated/model";
import { Btn } from "../../components/Btn";
import { CompanyLogo, VerifiedBadge } from "../../components/CompanyBadge";
import { EmptyState, ErrorNotice, ListSkeleton } from "../../components/Feedback";
import { TextArea } from "../../components/FormFields";
import { Modal } from "../../components/Modal";
import { formatLocation, formatSalary, prettify, timeAgo } from "../../lib/format";
import { invalidatePrefixes } from "../../lib/invalidate";
import { card, h1, muted, pageWrap, pillMeta } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

function RejectDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const reject = useRejectJob({
    mutation: {
      onSuccess: async () => {
        await invalidatePrefixes(queryClient, "/jobs");
        onClose();
      },
    },
  });
  const valid = reason.trim().length >= 3;
  return (
    <Modal title="Reject job" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) reject.mutate({ id: job.id, data: { reason: reason.trim() } });
        }}
        className="space-y-4"
      >
        <p className="font-ui text-[13px] text-[var(--color-stone)]">
          The employer will see this reason for <strong>{job.title}</strong> and can edit and resubmit.
        </p>
        <TextArea label="Reason" rows={4} maxLength={300} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} hint={`${reason.length}/300 (minimum 3)`} />
        <ErrorNotice error={reject.error} />
        <div className="flex justify-end gap-3">
          <Btn variant="ghost" onClick={onClose} disabled={reject.isPending}>Cancel</Btn>
          <Btn type="submit" variant="danger" loading={reject.isPending} disabled={!valid}>Reject job</Btn>
        </div>
      </form>
    </Modal>
  );
}

export function ReviewQueuePage() {
  useDocumentTitle("Review queue");
  const queryClient = useQueryClient();
  const pending = useListPendingJobs();
  const approve = useApproveJob({ mutation: { onSettled: () => invalidatePrefixes(queryClient, "/jobs") } });
  const [rejecting, setRejecting] = useState<Job | null>(null);

  return (
    <div className={pageWrap}>
      <h1 className={h1}>Review queue</h1>
      <p className={`${muted} mb-6 mt-1`}>Jobs from unverified companies waiting for approval.</p>
      {pending.isLoading && <ListSkeleton />}
      <ErrorNotice error={pending.error} />
      <ErrorNotice error={approve.error} />
      {pending.isSuccess && pending.data.length === 0 && <EmptyState title="Queue is empty" body="Nothing is waiting for review." />}
      <ul className="space-y-4">
        {pending.data?.map((job) => {
          const salary = formatSalary(job.salary);
          return (
            <li key={job.id} className={`${card} p-5`}>
              <div className="flex flex-wrap items-start gap-4">
                <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} />
                <div className="min-w-0 flex-1">
                  <Link to={`/jobs/${job.id}/${job.slug}`} className="font-editorial text-[20px] font-bold text-[var(--color-charcoal)] hover:text-[var(--color-coral)]">
                    {job.title}
                  </Link>
                  <p className="flex flex-wrap items-center gap-2 font-ui text-[13px] text-[var(--color-stone)]">
                    {job.company.name}
                    {job.company.verified && <VerifiedBadge />} · {formatLocation(job.location, job.workplace)} · Submitted {timeAgo(job.createdAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={pillMeta}>{prettify(job.function)}</span>
                    <span className={pillMeta}>{prettify(job.seniority)}</span>
                    <span className={pillMeta}>{prettify(job.employmentType)}</span>
                    <span className={pillMeta}>{prettify(job.workplace)}</span>
                    {salary && <span className={pillMeta}>{salary}</span>}
                  </div>
                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words font-ui text-[13px] text-[var(--color-charcoal)]">{job.description}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <Btn variant="danger" size="sm" disabled={approve.isPending} onClick={() => setRejecting(job)}>
                  Reject
                </Btn>
                <Btn size="sm" loading={approve.isPending && approve.variables?.id === job.id} disabled={approve.isPending} onClick={() => approve.mutate({ id: job.id })}>
                  Approve
                </Btn>
              </div>
            </li>
          );
        })}
      </ul>
      {rejecting && <RejectDialog job={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}
