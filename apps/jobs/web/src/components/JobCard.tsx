import { Link } from "react-router-dom";
import type { Job } from "../lib/api/generated/model";
import { jobPath, formatLocation, formatSalary, prettify, timeAgo } from "../lib/format";
import { pillMeta } from "../lib/styles";
import { CompanyLogo, VerifiedBadge } from "./CompanyBadge";
import { SaveButton } from "./SaveButton";

export function JobCard({ job, showSave = true }: { job: Job; showSave?: boolean }) {
  const salary = formatSalary(job.salary);
  return (
    <article className="flex gap-4 rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)]">
      <Link to={`/companies/${job.company.slug}`} aria-label={job.company.name} tabIndex={-1}>
        <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-editorial text-[19px] font-bold leading-snug text-[var(--color-charcoal)]">
              <Link to={jobPath(job)} className="hover:text-[var(--color-coral)] focus-visible:outline-2 focus-visible:outline-[var(--color-coral)]">
                {job.title}
              </Link>
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 font-ui text-[13px] text-[var(--color-stone)]">
              <Link to={`/companies/${job.company.slug}`} className="font-semibold hover:underline">
                {job.company.name}
              </Link>
              {job.company.verified && <VerifiedBadge />}
              <span aria-hidden>·</span>
              <span>{formatLocation(job.location, job.workplace)}</span>
            </p>
          </div>
          {showSave && <SaveButton jobId={job.id} saved={job.viewer.saved} />}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={pillMeta}>{prettify(job.employmentType)}</span>
          <span className={pillMeta}>{prettify(job.workplace)}</span>
          <span className={pillMeta}>{prettify(job.seniority)}</span>
          <span className={pillMeta}>{prettify(job.function)}</span>
          {salary && <span className="font-ui text-[12px] font-bold text-[var(--color-charcoal)]">{salary}</span>}
          <span className="ml-auto font-ui text-[12px] text-[var(--color-taupe)]">{timeAgo(job.publishedAt ?? job.createdAt)}</span>
        </div>
        {job.viewer.applied && <p className="mt-2 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-coral)]">Applied</p>}
      </div>
    </article>
  );
}
