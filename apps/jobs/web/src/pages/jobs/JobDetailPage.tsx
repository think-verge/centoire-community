import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSession } from "@centoire/web-platform";
import { useGetJob } from "../../lib/api/generated/jobs/jobs";
import { Btn, ExtBtn, LinkBtn } from "../../components/Btn";
import { CompanyLogo, VerifiedBadge } from "../../components/CompanyBadge";
import { EmptyState, ErrorNotice, Spinner } from "../../components/Feedback";
import { SaveButton } from "../../components/SaveButton";
import { StatusPill } from "../../components/StatusPill";
import { goToLogin } from "../../lib/auth";
import { formatDate, formatLocation, formatSalary, prettify, timeAgo } from "../../lib/format";
import { card, h2, pillMeta } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { useGetCompany } from "../../lib/api/generated/companies/companies";
import { ApplyModal } from "./ApplyModal";
import { useJobPostingJsonLd } from "./JobPostingJsonLd";

export function JobDetailPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const { data: job, isLoading, error } = useGetJob(id);
  const { data: company } = useGetCompany(job?.company.slug ?? "", { query: { enabled: Boolean(job) } });
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  useDocumentTitle(job ? `${job.title} at ${job.company.name}` : "Job");
  useJobPostingJsonLd(job);

  if (isLoading) return <Spinner />;
  if (error || !job) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 px-4 py-10">
        <ErrorNotice error={error} />
        <EmptyState title="This job is not available" body="It may have been closed or removed." action={{ to: "/", label: "Browse jobs" }} />
      </div>
    );
  }

  const salary = formatSalary(job.salary);
  const open = job.status === "published";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", window.location.href);
    }
  };
  const onApply = () => {
    if (!user) return goToLogin();
    setApplying(true);
  };

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-6 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header className={`${card} p-6`}>
          <div className="flex items-start gap-4">
            <Link to={`/companies/${job.company.slug}`}>
              <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} size={60} />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="font-editorial text-[28px] font-bold leading-tight text-[var(--color-charcoal)] sm:text-[34px]">{job.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 font-ui text-[14px] text-[var(--color-stone)]">
                <Link to={`/companies/${job.company.slug}`} className="font-semibold hover:underline">
                  {job.company.name}
                </Link>
                {job.company.verified && <VerifiedBadge />}
                <span aria-hidden>·</span>
                <span>{formatLocation(job.location, job.workplace)}</span>
                {job.publishedAt && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Posted {timeAgo(job.publishedAt)}</span>
                  </>
                )}
              </p>
            </div>
            {!open && <StatusPill status={job.status} />}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={pillMeta}>{prettify(job.employmentType)}</span>
            <span className={pillMeta}>{prettify(job.workplace)}</span>
            <span className={pillMeta}>{prettify(job.seniority)}</span>
            <span className={pillMeta}>{prettify(job.function)}</span>
            {salary && <span className="font-ui text-[14px] font-bold text-[var(--color-charcoal)]">{salary}</span>}
          </div>
          {job.status === "rejected" && job.rejectionReason && job.viewer.canManage && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 font-ui text-[13px] text-red-700">Rejected: {job.rejectionReason}</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {job.viewer.applied ? (
              <>
                <Btn disabled>Applied</Btn>
                <LinkBtn to="/me/applications" variant="secondary">
                  View my applications
                </LinkBtn>
              </>
            ) : job.applyMode === "external" && job.externalApplyUrl ? (
              <ExtBtn href={job.externalApplyUrl}>Apply on company site ↗</ExtBtn>
            ) : (
              <Btn onClick={onApply} disabled={!open}>
                Apply now
              </Btn>
            )}
            <SaveButton jobId={job.id} saved={job.viewer.saved} variant="full" />
            <Btn variant="ghost" onClick={() => void copy()}>
              {copied ? "Link copied" : "Copy link"}
            </Btn>
            {job.viewer.canManage && (
              <LinkBtn to={`/employer/jobs/${job.id}/applicants`} variant="secondary">
                Manage
              </LinkBtn>
            )}
          </div>
          {!open && <p className="mt-3 font-ui text-[12px] text-[var(--color-taupe)]">This role is not currently accepting applications.</p>}
        </header>

        <section className={`${card} p-6`}>
          <h2 className={h2}>About the role</h2>
          <div className="mt-3 whitespace-pre-wrap break-words font-ui text-[14px] leading-relaxed text-[var(--color-charcoal)]">{job.description}</div>
          {job.skills.length > 0 && (
            <>
              <h3 className="mt-6 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">Skills</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {job.skills.map((s) => (
                  <li key={s} className="rounded-full bg-[var(--color-blush)]/60 px-3 py-1 font-ui text-[12px] font-semibold text-[var(--color-charcoal)]">
                    {s}
                  </li>
                ))}
              </ul>
            </>
          )}
          {job.expiresAt && <p className="mt-6 font-ui text-[12px] text-[var(--color-taupe)]">Applications close {formatDate(job.expiresAt)}.</p>}
        </section>
      </div>

      <aside className="space-y-6">
        <section className={`${card} p-6`}>
          <h2 className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">About the company</h2>
          <div className="mt-3 flex items-center gap-3">
            <CompanyLogo name={job.company.name} logoUrl={job.company.logoUrl} />
            <div>
              <p className="font-editorial text-[18px] font-bold text-[var(--color-charcoal)]">{job.company.name}</p>
              {job.company.verified && <VerifiedBadge />}
            </div>
          </div>
          {company?.about && <p className="mt-3 line-clamp-5 whitespace-pre-wrap font-ui text-[13px] text-[var(--color-stone)]">{company.about}</p>}
          <Link to={`/companies/${job.company.slug}`} className="mt-4 inline-block font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
            View company{company ? ` · ${company.openJobCount} open` : ""} →
          </Link>
        </section>
      </aside>

      {applying && <ApplyModal job={job} onClose={() => setApplying(false)} />}
    </div>
  );
}
