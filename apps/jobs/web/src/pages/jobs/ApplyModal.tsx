import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useApplyToJob } from "../../lib/api/generated/applications/applications";
import type { Job } from "../../lib/api/generated/model";
import { Btn } from "../../components/Btn";
import { ErrorNotice } from "../../components/Feedback";
import { TextArea, TextInput } from "../../components/FormFields";
import { Modal } from "../../components/Modal";
import { invalidatePrefixes } from "../../lib/invalidate";
import { opt } from "../../lib/format";

export function ApplyModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [coverNote, setCoverNote] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const apply = useApplyToJob({
    mutation: { onSuccess: () => invalidatePrefixes(queryClient, "/jobs", "/me/applications") },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const unanswered = job.screeningQuestions.filter((q) => q.required && !answers[q.id]?.trim()).map((q) => q.id);
    setMissing(unanswered);
    if (unanswered.length) return;
    apply.mutate({
      id: job.id,
      data: {
        ...(opt(coverNote) ? { coverNote: coverNote.trim() } : {}),
        ...(opt(portfolioUrl) ? { portfolioUrl: portfolioUrl.trim() } : {}),
        answers: job.screeningQuestions
          .filter((q) => answers[q.id]?.trim())
          .map((q) => ({ questionId: q.id, answer: (answers[q.id] ?? "").trim() })),
      },
    });
  };

  if (apply.isSuccess) {
    return (
      <Modal title="Application sent" onClose={onClose}>
        <p className="font-ui text-[14px] text-[var(--color-stone)]">
          Your application to <strong>{job.title}</strong> at {job.company.name} is on its way. You can follow its status any time.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Btn variant="ghost" onClick={onClose}>
            Close
          </Btn>
          <Link to={`/me/applications/${apply.data.id}`} className="inline-flex items-center rounded-full bg-[var(--color-coral)] px-6 py-2.5 font-ui text-[13px] font-bold uppercase tracking-wider text-white">
            View application
          </Link>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Apply to ${job.company.name}`} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <p className="font-ui text-[13px] text-[var(--color-stone)]">
          Applying for <strong className="text-[var(--color-charcoal)]">{job.title}</strong>. Your Centoire profile and candidate headline are shared with the hiring team.
        </p>
        <TextArea label="Cover note (optional)" rows={5} maxLength={4000} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} hint={`${coverNote.length}/4000`} placeholder="Tell them why you are a great fit." />
        <TextInput label="Portfolio URL (optional)" type="url" maxLength={500} value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://" />
        {job.screeningQuestions.map((q) => (
          <TextArea
            key={q.id}
            label={`${q.prompt}${q.required ? " *" : ""}`}
            rows={3}
            maxLength={2000}
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            error={missing.includes(q.id) ? "This question is required." : undefined}
          />
        ))}
        <ErrorNotice error={apply.error} verifyHint />
        <div className="flex justify-end gap-3 pt-2">
          <Btn variant="ghost" onClick={onClose} disabled={apply.isPending}>
            Cancel
          </Btn>
          <Btn type="submit" loading={apply.isPending}>
            Submit application
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
