import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { hasPermission } from "@centoire/contracts";
import { useSession } from "@centoire/web-platform";
import { useListMyCompanies } from "../../lib/api/generated/companies/companies";
import { useCloseJob, useListEmployerJobs } from "../../lib/api/generated/employer/employer";
import { Btn, LinkBtn } from "../../components/Btn";
import { CompanyLogo, VerifiedBadge } from "../../components/CompanyBadge";
import { EmptyState, ErrorNotice, ListSkeleton } from "../../components/Feedback";
import { StatusPill } from "../../components/StatusPill";
import { SUPPORT_URL } from "../../lib/auth";
import { prettify, timeAgo } from "../../lib/format";
import { invalidatePrefixes } from "../../lib/invalidate";
import { card, h1, h2, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { JobStatus } from "../../lib/api/generated/model";

export function EmployerDashboardPage() {
  useDocumentTitle("Employer");
  const { user } = useSession();
  const queryClient = useQueryClient();
  const companies = useListMyCompanies();
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const params = { ...(companyFilter ? { company: companyFilter } : {}), ...(statusFilter ? { status: statusFilter } : {}) };
  const jobs = useListEmployerJobs(Object.keys(params).length ? params : undefined);
  const close = useCloseJob({ mutation: { onSettled: () => invalidatePrefixes(queryClient, "/jobs") } });
  const canCreateCompany = Boolean(user && hasPermission(user.role, "company.verify"));
  const noCompany = companies.isSuccess && companies.data.length === 0;

  return (
    <div className={pageWrap}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={h1}>Employer</h1>
          <p className={`${muted} mt-1`}>Post roles, review applicants and manage your hiring team.</p>
        </div>
        {canCreateCompany && (
          <LinkBtn to="/employer/companies/new" variant="secondary">
            New company
          </LinkBtn>
        )}
      </div>

      <h2 className={`${h2} mb-3 mt-8`}>Your companies</h2>
      {companies.isLoading && <ListSkeleton count={1} />}
      <ErrorNotice error={companies.error} />
      {noCompany && (
        <EmptyState
          title="You do not belong to a company yet"
          body={
            <>
              During launch, companies are created by the Centoire team. Tell us about your brand and we will set you up with a hiring team.{" "}
              <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--color-coral)] underline">
                Contact Centoire
              </a>
            </>
          }
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {companies.data?.map((c) => (
          <div key={c.id} className={`${card} p-5`}>
            <div className="flex items-center gap-3">
              <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-editorial text-[18px] font-bold text-[var(--color-charcoal)]">
                  <Link to={`/companies/${c.slug}`} className="hover:text-[var(--color-coral)]">{c.name}</Link>
                  {c.verified && <VerifiedBadge />}
                </p>
                <p className="font-ui text-[12px] text-[var(--color-stone)]">
                  {c.openJobCount} open {c.openJobCount === 1 ? "job" : "jobs"} · {c.viewerRole ? prettify(c.viewerRole) : ""}
                </p>
              </div>
            </div>
            {!c.verified && <p className="mt-3 font-ui text-[12px] text-[var(--color-taupe)]">Not verified yet: new jobs go through review before publishing.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkBtn to={`/employer/jobs/new?company=${c.slug}`} size="sm">
                Post a job
              </LinkBtn>
              <LinkBtn to={`/employer/companies/${c.slug}/settings`} variant="secondary" size="sm">
                Settings
              </LinkBtn>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className={h2}>Your jobs</h2>
        <div className="flex flex-wrap gap-3">
          {(companies.data?.length ?? 0) > 1 && (
            <label className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">
              <span className="sr-only">Company</span>
              <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="rounded-full border border-[#EAEAEA] bg-white px-4 py-1.5 text-[13px] normal-case">
                <option value="">All companies</option>
                {companies.data?.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="sr-only">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-full border border-[#EAEAEA] bg-white px-4 py-1.5 font-ui text-[13px]">
              <option value="">All statuses</option>
              {Object.values(JobStatus).map((s) => (
                <option key={s} value={s}>{s === "pending_review" ? "Pending review" : prettify(s)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {jobs.isLoading && <ListSkeleton count={3} />}
      <ErrorNotice error={jobs.error} />
      <ErrorNotice error={close.error} />
      {jobs.isSuccess && jobs.data.length === 0 && !noCompany && <EmptyState title="No jobs yet" body="Post your first role to start receiving applications." />}
      <ul className="space-y-3">
        {jobs.data?.map((job) => (
          <li key={job.id} className={`${card} flex flex-wrap items-center gap-4 p-5`}>
            <div className="min-w-0 flex-1">
              <p className="font-editorial text-[18px] font-bold text-[var(--color-charcoal)]">
                <Link to={`/jobs/${job.id}/${job.slug}`} className="hover:text-[var(--color-coral)]">{job.title}</Link>
              </p>
              <p className="font-ui text-[12px] text-[var(--color-stone)]">
                {job.company.name} · {job.applicationCount} {job.applicationCount === 1 ? "applicant" : "applicants"} · Created {timeAgo(job.createdAt)}
              </p>
              {job.status === "rejected" && job.rejectionReason && <p className="mt-1 font-ui text-[12px] text-red-600">Rejected: {job.rejectionReason}</p>}
            </div>
            <StatusPill status={job.status} />
            <div className="flex flex-wrap gap-2">
              <LinkBtn to={`/employer/jobs/${job.id}/edit`} variant="secondary" size="sm">Edit</LinkBtn>
              <LinkBtn to={`/employer/jobs/${job.id}/applicants`} variant="secondary" size="sm">Applicants</LinkBtn>
              {job.status === "published" && (
                <Btn
                  variant="danger"
                  size="sm"
                  disabled={close.isPending}
                  onClick={() => {
                    if (window.confirm("Close this job? It will stop accepting applications.")) close.mutate({ id: job.id });
                  }}
                >
                  Close
                </Btn>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
