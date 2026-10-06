import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useListJobApplications } from "../../lib/api/generated/employer/employer";
import { useGetJob } from "../../lib/api/generated/jobs/jobs";
import { ApplicationStatus } from "../../lib/api/generated/model";
import { Avatar } from "../../components/Avatar";
import { EmptyState, ErrorNotice, ListSkeleton } from "../../components/Feedback";
import { StatusPill } from "../../components/StatusPill";
import { prettify, timeAgo } from "../../lib/format";
import { card, h1, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

export function ApplicantsPage() {
  const { id = "" } = useParams();
  const [status, setStatus] = useState("");
  const { data: job } = useGetJob(id);
  const apps = useListJobApplications(id);
  useDocumentTitle(job ? `Applicants: ${job.title}` : "Applicants");

  const items = (apps.data ?? []).filter((a) => !status || a.status === status);

  return (
    <div className={pageWrap}>
      <Link to="/employer" className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
        ← Employer
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={h1}>Applicants</h1>
          <p className={`${muted} mt-1`}>{job ? `${job.title} at ${job.company.name}` : ""}</p>
        </div>
        <label>
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-full border border-[#EAEAEA] bg-white px-4 py-2 font-ui text-[13px]">
            <option value="">All statuses</option>
            {Object.values(ApplicationStatus).map((s) => (
              <option key={s} value={s}>{prettify(s)}</option>
            ))}
          </select>
        </label>
      </div>
      {apps.isLoading && <ListSkeleton />}
      <ErrorNotice error={apps.error} />
      {apps.isSuccess && items.length === 0 && (
        <EmptyState title={apps.data.length === 0 ? "No applicants yet" : "No applicants with that status"} body={apps.data.length === 0 ? "Applications will appear here as candidates apply." : undefined} />
      )}
      <ul className="space-y-3">
        {items.map((a) => {
          const name = a.applicant?.displayName ?? "Candidate";
          return (
            <li key={a.id} className={`${card} flex flex-wrap items-center gap-4 p-5`}>
              <Avatar name={name} url={a.applicant?.avatarUrl} size={44} />
              <div className="min-w-0 flex-1">
                <Link to={`/employer/applications/${a.id}`} className="font-editorial text-[18px] font-bold text-[var(--color-charcoal)] hover:text-[var(--color-coral)]">
                  {name}
                </Link>
                <p className="truncate font-ui text-[13px] text-[var(--color-stone)]">{a.headline ?? "No headline"} · Applied {timeAgo(a.createdAt)}</p>
              </div>
              <StatusPill status={a.status} />
              <Link to={`/employer/applications/${a.id}`} className="rounded-full border border-[#EAEAEA] px-4 py-1.5 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-charcoal)] hover:border-[#999]">
                Open
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
