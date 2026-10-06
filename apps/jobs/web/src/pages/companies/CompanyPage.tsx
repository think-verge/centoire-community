import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useGetCompany, listCompanyJobs, getListCompanyJobsQueryKey } from "../../lib/api/generated/companies/companies";
import type { Job } from "../../lib/api/generated/model";
import { LinkBtn } from "../../components/Btn";
import { CompanyLogo, VerifiedBadge } from "../../components/CompanyBadge";
import { EmptyState, ErrorNotice, ListSkeleton, LoadMore, Spinner } from "../../components/Feedback";
import { JobCard } from "../../components/JobCard";
import { countryName, prettify } from "../../lib/format";
import { card, h2, pillMeta } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

/** Pages accumulate in local state; each page is fetched through the generated query so keys stay shared. */
function OpenRoles({ slug }: { slug: string }) {
  const [cursors, setCursors] = useState<string[]>([]);
  const pages = [undefined, ...cursors];
  return (
    <div className="space-y-3">
      {pages.map((cursor, i) => (
        <RolesPage
          key={cursor ?? "first"}
          slug={slug}
          cursor={cursor}
          isLast={i === pages.length - 1}
          onMore={(next) => setCursors((c) => [...c, next])}
        />
      ))}
    </div>
  );
}

function RolesPage({ slug, cursor, isLast, onMore }: { slug: string; cursor: string | undefined; isLast: boolean; onMore: (next: string) => void }) {
  const params = cursor ? { cursor } : undefined;
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: getListCompanyJobsQueryKey(slug, params),
    queryFn: ({ signal }) => listCompanyJobs(slug, params, signal),
  });
  if (isLoading) return <ListSkeleton count={2} />;
  if (error) return <ErrorNotice error={error} />;
  const items: Job[] = data?.items ?? [];
  if (!cursor && items.length === 0) return <EmptyState title="No open roles right now" body="Check back soon, or save this company page." />;
  return (
    <>
      {items.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
      {isLast && <LoadMore hasMore={Boolean(data?.nextCursor)} loading={isFetching} onClick={() => data?.nextCursor && onMore(data.nextCursor)} />}
    </>
  );
}

export function CompanyPage() {
  const { slug = "" } = useParams();
  const { data: company, isLoading, error } = useGetCompany(slug);
  useDocumentTitle(company?.name);

  if (isLoading) return <Spinner />;
  if (error || !company) {
    return (
      <div className="mx-auto max-w-[900px] space-y-4 px-4 py-10">
        <ErrorNotice error={error} />
        <EmptyState title="Company not found" action={{ to: "/", label: "Browse jobs" }} />
      </div>
    );
  }

  const hq = [company.hq?.city, company.hq?.countryCode ? countryName(company.hq.countryCode) : null].filter(Boolean).join(", ");

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-8">
      <section className={`${card} overflow-hidden`}>
        <div className="h-36 bg-[var(--color-blush)] sm:h-48">
          {company.coverUrl && <img src={company.coverUrl} alt="" className="size-full object-cover" />}
        </div>
        <div className="p-6">
          <div className="-mt-14 flex items-end gap-4">
            <div className="rounded-2xl bg-white p-1 shadow-[0_4px_16px_rgba(0,0,0,0.1)]">
              <CompanyLogo name={company.name} logoUrl={company.logoUrl} size={72} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex flex-wrap items-center gap-3 font-editorial text-[30px] font-bold text-[var(--color-charcoal)]">
                {company.name}
                {company.verified && <VerifiedBadge />}
              </h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className={pillMeta}>{prettify(company.segment)}</span>
                {company.sizeRange && <span className={pillMeta}>{company.sizeRange} people</span>}
                {hq && <span className={pillMeta}>{hq}</span>}
              </div>
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block font-ui text-[13px] font-semibold text-[var(--color-coral)] hover:underline">
                  {company.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
            {company.viewerRole && (
              <LinkBtn to={`/employer/companies/${company.slug}/settings`} variant="secondary" size="sm">
                Company settings
              </LinkBtn>
            )}
          </div>
          {company.about && <p className="mt-5 max-w-3xl whitespace-pre-wrap break-words font-ui text-[14px] leading-relaxed text-[var(--color-charcoal)]">{company.about}</p>}
        </div>
      </section>

      <h2 className={`${h2} mb-4 mt-8`}>
        Open roles <span className="font-ui text-[14px] font-semibold text-[var(--color-taupe)]">({company.openJobCount})</span>
      </h2>
      <OpenRoles slug={company.slug} />
      <p className="mt-8 text-center font-ui text-[12px] text-[var(--color-taupe)]">
        <Link to="/" className="hover:underline">
          Browse all jobs
        </Link>
      </p>
    </div>
  );
}
