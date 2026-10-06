import { Link, useParams } from "react-router-dom";
import { useGetMyApplication } from "../../lib/api/generated/applications/applications";
import { useGetJob } from "../../lib/api/generated/jobs/jobs";
import { CompanyLogo } from "../../components/CompanyBadge";
import { ErrorNotice, Spinner } from "../../components/Feedback";
import { StatusPill } from "../../components/StatusPill";
import { formatDate, prettify } from "../../lib/format";
import { card, h1, h2, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

export function MyApplicationPage() {
  const { id = "" } = useParams();
  const { data: app, isLoading, error } = useGetMyApplication(id);
  const { data: job } = useGetJob(app?.job.id ?? "", { query: { enabled: Boolean(app) } });
  useDocumentTitle(app ? `Application: ${app.job.title}` : "Application");

  if (isLoading) return <Spinner />;
  if (error || !app) {
    return (
      <div className={pageWrap}>
        <ErrorNotice error={error ?? new Error("Application not found")} />
      </div>
    );
  }
  const prompts = new Map(job?.screeningQuestions.map((q) => [q.id, q.prompt]));
  const history = [...app.statusHistory].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className={`${pageWrap} max-w-[800px]`}>
      <Link to="/me/applications" className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
        ← My applications
      </Link>
      <header className={`${card} mt-4 flex flex-wrap items-center gap-4 p-6`}>
        <CompanyLogo name={app.job.company.name} logoUrl={app.job.company.logoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className={`${h1} !text-[26px] sm:!text-[30px]`}>{app.job.title}</h1>
          <p className="font-ui text-[14px] text-[var(--color-stone)]">
            <Link to={`/companies/${app.job.company.slug}`} className="font-semibold hover:underline">
              {app.job.company.name}
            </Link>{" "}
            · Applied {formatDate(app.createdAt)}
          </p>
        </div>
        <StatusPill status={app.status} />
        {app.job.status === "published" && (
          <Link to={`/jobs/${app.job.id}/${app.job.slug}`} className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
            View job →
          </Link>
        )}
      </header>

      <section className={`${card} mt-6 p-6`}>
        <h2 className={h2}>Status</h2>
        <ol className="mt-4 space-y-4 border-l-2 border-[var(--color-hairline)] pl-5">
          {history.map((h, i) => (
            <li key={`${h.status}-${h.at}`} className="relative">
              <span className={`absolute -left-[27px] top-1 size-3 rounded-full ${i === history.length - 1 ? "bg-[var(--color-coral)]" : "bg-[#CFCFCF]"}`} aria-hidden />
              <p className="font-ui text-[14px] font-semibold text-[var(--color-charcoal)]">{prettify(h.status)}</p>
              <p className="font-ui text-[12px] text-[var(--color-taupe)]">{new Date(h.at).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${card} mt-6 space-y-5 p-6`}>
        <h2 className={h2}>What you sent</h2>
        <div>
          <h3 className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">Cover note</h3>
          <p className="mt-1 whitespace-pre-wrap break-words font-ui text-[14px] text-[var(--color-charcoal)]">{app.coverNote || "No cover note."}</p>
        </div>
        {app.portfolioUrl && (
          <div>
            <h3 className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">Portfolio</h3>
            <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-ui text-[14px] text-[var(--color-coral)] hover:underline">
              {app.portfolioUrl}
            </a>
          </div>
        )}
        {app.answers.map((a, i) => (
          <div key={a.questionId}>
            <h3 className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">{prompts.get(a.questionId) ?? `Question ${i + 1}`}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words font-ui text-[14px] text-[var(--color-charcoal)]">{a.answer}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
