import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useListMyApplications, useWithdrawApplication } from "../../lib/api/generated/applications/applications";
import { Btn } from "../../components/Btn";
import { CompanyLogo } from "../../components/CompanyBadge";
import { EmptyState, ErrorNotice, ListSkeleton } from "../../components/Feedback";
import { StatusPill } from "../../components/StatusPill";
import { timeAgo } from "../../lib/format";
import { invalidatePrefixes } from "../../lib/invalidate";
import { card, h1, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

export function MyApplicationsPage() {
  useDocumentTitle("My applications");
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useListMyApplications();
  const withdraw = useWithdrawApplication({ mutation: { onSettled: () => invalidatePrefixes(queryClient, "/jobs") } });

  return (
    <div className={pageWrap}>
      <h1 className={h1}>My applications</h1>
      <p className={`${muted} mb-6 mt-1`}>Track where each application stands.</p>
      {isLoading && <ListSkeleton />}
      <ErrorNotice error={error} />
      <ErrorNotice error={withdraw.error} />
      {data && data.length === 0 && <EmptyState title="No applications yet" body="When you apply to a role it shows up here." action={{ to: "/", label: "Browse jobs" }} />}
      <ul className="space-y-3">
        {data?.map((app) => {
          const canWithdraw = app.status !== "withdrawn" && app.status !== "hired" && app.status !== "rejected";
          return (
            <li key={app.id} className={`${card} flex flex-wrap items-center gap-4 p-5`}>
              <CompanyLogo name={app.job.company.name} logoUrl={app.job.company.logoUrl} />
              <div className="min-w-0 flex-1">
                <Link to={`/me/applications/${app.id}`} className="font-editorial text-[18px] font-bold text-[var(--color-charcoal)] hover:text-[var(--color-coral)]">
                  {app.job.title}
                </Link>
                <p className="font-ui text-[13px] text-[var(--color-stone)]">
                  {app.job.company.name} · Applied {timeAgo(app.createdAt)}
                </p>
              </div>
              <StatusPill status={app.status} />
              <div className="flex gap-2">
                <Link to={`/me/applications/${app.id}`} className="rounded-full border border-[#EAEAEA] px-4 py-1.5 font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-charcoal)] hover:border-[#999]">
                  Details
                </Link>
                {canWithdraw && (
                  <Btn
                    variant="danger"
                    size="sm"
                    loading={withdraw.isPending && withdraw.variables?.id === app.id}
                    disabled={withdraw.isPending}
                    onClick={() => {
                      if (window.confirm("Withdraw this application? This cannot be undone.")) withdraw.mutate({ id: app.id });
                    }}
                  >
                    Withdraw
                  </Btn>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
