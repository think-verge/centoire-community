import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useListAllCompanies, useVerifyCompany } from "../../lib/api/generated/admin/admin";
import { Btn, LinkBtn } from "../../components/Btn";
import { CompanyLogo, VerifiedBadge } from "../../components/CompanyBadge";
import { EmptyState, ErrorNotice, ListSkeleton } from "../../components/Feedback";
import { prettify } from "../../lib/format";
import { invalidatePrefixes } from "../../lib/invalidate";
import { card, h1, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

export function AdminCompaniesPage() {
  useDocumentTitle("Companies admin");
  const queryClient = useQueryClient();
  const companies = useListAllCompanies();
  const verify = useVerifyCompany({ mutation: { onSettled: () => invalidatePrefixes(queryClient, "/jobs") } });

  return (
    <div className={pageWrap}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={h1}>Companies</h1>
          <p className={`${muted} mt-1`}>Verify brands so their jobs publish instantly.</p>
        </div>
        <LinkBtn to="/employer/companies/new" variant="secondary">New company</LinkBtn>
      </div>
      <div className="mt-6">
        {companies.isLoading && <ListSkeleton />}
        <ErrorNotice error={companies.error} />
        <ErrorNotice error={verify.error} />
        {companies.isSuccess && companies.data.length === 0 && <EmptyState title="No companies yet" />}
        <ul className="space-y-3">
          {companies.data?.map((c) => (
            <li key={c.id} className={`${card} flex flex-wrap items-center gap-4 p-5`}>
              <CompanyLogo name={c.name} logoUrl={c.logoUrl} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-editorial text-[18px] font-bold text-[var(--color-charcoal)]">
                  <Link to={`/companies/${c.slug}`} className="hover:text-[var(--color-coral)]">{c.name}</Link>
                  {c.verified && <VerifiedBadge />}
                </p>
                <p className="font-ui text-[12px] text-[var(--color-stone)]">
                  {prettify(c.segment)} · {c.openJobCount} open {c.openJobCount === 1 ? "job" : "jobs"}
                </p>
              </div>
              <div className="flex gap-2">
                <LinkBtn to={`/employer/companies/${c.slug}/settings`} variant="secondary" size="sm">Settings</LinkBtn>
                {!c.verified && (
                  <Btn size="sm" loading={verify.isPending && verify.variables?.slug === c.slug} disabled={verify.isPending} onClick={() => verify.mutate({ slug: c.slug })}>
                    Verify
                  </Btn>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
