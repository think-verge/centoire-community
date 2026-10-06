import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useGetEmployerApplication, useUpdateApplication } from "../../lib/api/generated/employer/employer";
import { useGetJob } from "../../lib/api/generated/jobs/jobs";
import type { Application } from "../../lib/api/generated/model";
import { Avatar } from "../../components/Avatar";
import { Btn } from "../../components/Btn";
import { ErrorNotice, Notice, Spinner } from "../../components/Feedback";
import { StatusPill } from "../../components/StatusPill";
import { TextArea } from "../../components/FormFields";
import { formatDate, prettify } from "../../lib/format";
import { invalidatePrefixes } from "../../lib/invalidate";
import { card, h1, h2, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

function Detail({ app }: { app: Application }) {
  const queryClient = useQueryClient();
  const { data: job } = useGetJob(app.job.id);
  const [notes, setNotes] = useState(app.recruiterNotes ?? "");
  const [savedNotes, setSavedNotes] = useState(false);
  const update = useUpdateApplication({ mutation: { onSuccess: () => invalidatePrefixes(queryClient, "/jobs") } });
  const markedViewed = useRef(false);
  const prompts = new Map(job?.screeningQuestions.map((q) => [q.id, q.prompt]));

  // Opening a fresh application marks it as viewed once.
  useEffect(() => {
    if (app.status === "submitted" && !markedViewed.current) {
      markedViewed.current = true;
      update.mutate({ id: app.id, data: { status: "viewed" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id, app.status]);

  const name = app.applicant?.displayName ?? "Candidate";
  const decided = app.status === "withdrawn";
  const setStatus = (status: "shortlisted" | "rejected" | "hired") => update.mutate({ id: app.id, data: { status } });

  return (
    <div className={`${pageWrap} max-w-[800px]`}>
      <Link to={`/employer/jobs/${app.job.id}/applicants`} className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
        ← Applicants
      </Link>
      <header className={`${card} mt-4 flex flex-wrap items-center gap-4 p-6`}>
        <Avatar name={name} url={app.applicant?.avatarUrl} size={60} />
        <div className="min-w-0 flex-1">
          <h1 className={`${h1} !text-[26px]`}>{name}</h1>
          <p className="font-ui text-[14px] text-[var(--color-stone)]">{app.headline ?? "No headline"}</p>
          <p className="font-ui text-[12px] text-[var(--color-taupe)]">
            Applied for {app.job.title} on {formatDate(app.createdAt)}
          </p>
          {app.applicant?.handle && (
            <Link to={`/candidates/${app.applicant.handle}`} className="mt-1 inline-block font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-coral)]">
              View candidate profile →
            </Link>
          )}
        </div>
        <StatusPill status={app.status} />
      </header>

      <div className="mt-4 flex flex-wrap gap-3">
        <Btn disabled={update.isPending || decided || app.status === "shortlisted"} onClick={() => setStatus("shortlisted")}>
          Shortlist
        </Btn>
        <Btn variant="secondary" disabled={update.isPending || decided || app.status === "hired"} onClick={() => setStatus("hired")}>
          Mark hired
        </Btn>
        <Btn variant="danger" disabled={update.isPending || decided || app.status === "rejected"} onClick={() => setStatus("rejected")}>
          Reject
        </Btn>
      </div>
      {decided && <p className="mt-2 font-ui text-[12px] text-[var(--color-taupe)]">The candidate withdrew this application.</p>}
      <div className="mt-3">
        <ErrorNotice error={update.error} />
      </div>

      <section className={`${card} mt-6 space-y-5 p-6`}>
        <h2 className={h2}>Application</h2>
        <div>
          <h3 className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">Cover note</h3>
          <p className="mt-1 whitespace-pre-wrap break-words font-ui text-[14px]">{app.coverNote || "No cover note."}</p>
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
            <p className="mt-1 whitespace-pre-wrap break-words font-ui text-[14px]">{a.answer}</p>
          </div>
        ))}
      </section>

      <section className={`${card} mt-6 p-6`}>
        <h2 className={h2}>Status history</h2>
        <ul className="mt-3 space-y-1 font-ui text-[13px] text-[var(--color-stone)]">
          {app.statusHistory.map((h) => (
            <li key={`${h.status}-${h.at}`}>
              <strong className="text-[var(--color-charcoal)]">{prettify(h.status)}</strong> · {new Date(h.at).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>

      <section className={`${card} mt-6 space-y-3 p-6`}>
        <h2 className={h2}>Private notes</h2>
        <p className="font-ui text-[12px] text-[var(--color-taupe)]">Only your hiring team can see these. Candidates never do.</p>
        <TextArea label="Notes" rows={5} maxLength={4000} value={notes} onChange={(e) => { setNotes(e.target.value); setSavedNotes(false); }} hint={`${notes.length}/4000`} />
        {savedNotes && <Notice>Notes saved.</Notice>}
        <Btn
          variant="secondary"
          loading={update.isPending && update.variables?.data.recruiterNotes !== undefined}
          disabled={update.isPending || notes === (app.recruiterNotes ?? "")}
          onClick={() => update.mutate({ id: app.id, data: { recruiterNotes: notes } }, { onSuccess: () => setSavedNotes(true) })}
        >
          Save notes
        </Btn>
      </section>
    </div>
  );
}

export function ApplicantDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading, error } = useGetEmployerApplication(id);
  useDocumentTitle(data?.applicant ? `Applicant: ${data.applicant.displayName}` : "Applicant");
  if (isLoading) return <Spinner />;
  if (error || !data) return <div className={pageWrap}><ErrorNotice error={error ?? new Error("Application not found")} /></div>;
  // Key on the notes so the editor resets after the server copy changes elsewhere.
  return <Detail key={data.id} app={data} />;
}
