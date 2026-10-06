import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useListMyCompanies } from "../../lib/api/generated/companies/companies";
import { useCreateJob, useSubmitJob, useUpdateJob } from "../../lib/api/generated/employer/employer";
import { useGetJob } from "../../lib/api/generated/jobs/jobs";
import {
  JobInputApplyMode,
  JobInputEmploymentType,
  JobInputFunction,
  JobInputSalaryPeriod,
  JobInputSeniority,
  JobInputWorkplace,
  type Job,
  type JobInput,
} from "../../lib/api/generated/model";
import { Btn, LinkBtn } from "../../components/Btn";
import { ErrorNotice, Notice, Spinner } from "../../components/Feedback";
import { Checkbox, SelectInput, TextArea, TextInput } from "../../components/FormFields";
import { StatusPill } from "../../components/StatusPill";
import { TagInput } from "../../components/TagInput";
import { countryName, opt } from "../../lib/format";
import { invalidatePrefixes } from "../../lib/invalidate";
import { COUNTRIES, CURRENCIES, isOneOf, useTaxonomyOptions } from "../../lib/options";
import { card, h1, h2, muted, pageWrap } from "../../lib/styles";
import { useDocumentTitle } from "../../lib/useDocumentTitle";

const DESC_MAX = 12000;
const DESC_MIN = 20;

interface Question {
  prompt: string;
  required: boolean;
}

function JobForm({ job, defaultCompany }: { job?: Job; defaultCompany: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const options = useTaxonomyOptions();
  const companies = useListMyCompanies();
  const create = useCreateJob();
  const update = useUpdateJob();
  const submitJob = useSubmitJob();

  const [companySlug, setCompanySlug] = useState(job?.company.slug ?? defaultCompany);
  const [title, setTitle] = useState(job?.title ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [fn, setFn] = useState<string>(job?.function ?? "");
  const [seniority, setSeniority] = useState<string>(job?.seniority ?? "");
  const [employmentType, setEmploymentType] = useState<string>(job?.employmentType ?? "");
  const [workplace, setWorkplace] = useState<string>(job?.workplace ?? "");
  const [city, setCity] = useState(job?.location?.city ?? "");
  const [country, setCountry] = useState(job?.location?.countryCode ?? "");
  const [salaryMin, setSalaryMin] = useState(job?.salary?.min != null ? String(job.salary.min) : "");
  const [salaryMax, setSalaryMax] = useState(job?.salary?.max != null ? String(job.salary.max) : "");
  const [currency, setCurrency] = useState(job?.salary?.currency ?? "USD");
  const [period, setPeriod] = useState<string>(job?.salary?.period ?? "year");
  // The API does not echo `salary.visible`; a salary present on a managed job is treated as shown.
  const [showSalary, setShowSalary] = useState(job ? job.salary != null : true);
  const [skills, setSkills] = useState<string[]>(job?.skills ?? []);
  const [applyMode, setApplyMode] = useState<string>(job?.applyMode ?? "internal");
  const [externalUrl, setExternalUrl] = useState(job?.externalApplyUrl ?? "");
  const [questions, setQuestions] = useState<Question[]>(job?.screeningQuestions.map((q) => ({ prompt: q.prompt, required: q.required })) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const company = companies.data?.find((c) => c.slug === companySlug);
  const editable = !job || job.status === "draft" || job.status === "rejected" || job.status === "published" || job.status === "pending_review";
  const canSubmit = !job || job.status === "draft" || job.status === "rejected";

  /** Client-side checks mirroring the API limits; returns the payload or null. */
  const build = (): JobInput | null => {
    const e: Record<string, string> = {};
    if (!job && !companySlug) e.company = "Choose a company.";
    if (title.trim().length < 3) e.title = "Title must be at least 3 characters.";
    if (description.trim().length < DESC_MIN) e.description = `Description must be at least ${DESC_MIN} characters.`;
    if (description.length > DESC_MAX) e.description = `Description must be at most ${DESC_MAX} characters.`;
    const fnV = isOneOf(Object.values(JobInputFunction), fn) ? fn : null;
    const senV = isOneOf(Object.values(JobInputSeniority), seniority) ? seniority : null;
    const typeV = isOneOf(Object.values(JobInputEmploymentType), employmentType) ? employmentType : null;
    const wpV = isOneOf(Object.values(JobInputWorkplace), workplace) ? workplace : null;
    if (!fnV) e.function = "Choose a function.";
    if (!senV) e.seniority = "Choose a seniority.";
    if (!typeV) e.employmentType = "Choose an employment type.";
    if (!wpV) e.workplace = "Choose a workplace.";
    const min = salaryMin.trim() === "" ? undefined : Number(salaryMin);
    const max = salaryMax.trim() === "" ? undefined : Number(salaryMax);
    if ((min !== undefined && (Number.isNaN(min) || min < 0)) || (max !== undefined && (Number.isNaN(max) || max < 0))) e.salary = "Salary must be a positive number.";
    else if (min !== undefined && max !== undefined && min > max) e.salary = "Minimum salary cannot exceed the maximum.";
    const external = applyMode === "external";
    if (external && !/^https?:\/\//.test(externalUrl.trim())) e.externalApplyUrl = "Enter the full URL (https://…) of your application page.";
    const qs = questions.map((q) => ({ prompt: q.prompt.trim(), required: q.required })).filter((q) => q.prompt);
    if (qs.some((q) => q.prompt.length < 3)) e.questions = "Screening questions need at least 3 characters.";
    setErrors(e);
    if (Object.keys(e).length || !fnV || !senV || !typeV || !wpV) return null;

    const hasSalary = min !== undefined || max !== undefined;
    const periodV = isOneOf(Object.values(JobInputSalaryPeriod), period) ? period : undefined;
    const cityV = opt(city);
    return {
      title: title.trim(),
      description: description.trim(),
      function: fnV,
      seniority: senV,
      employmentType: typeV,
      workplace: wpV,
      ...(cityV || country ? { location: { ...(cityV ? { city: cityV } : {}), ...(country ? { countryCode: country } : {}) } } : {}),
      ...(hasSalary
        ? { salary: { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}), currency, ...(periodV ? { period: periodV } : {}), visible: showSalary } }
        : {}),
      skills,
      applyMode: external ? JobInputApplyMode.external : JobInputApplyMode.internal,
      ...(external ? { externalApplyUrl: externalUrl.trim() } : {}),
      screeningQuestions: qs,
    };
  };

  const persist = async (data: JobInput): Promise<Job> => {
    if (job) return update.mutateAsync({ id: job.id, data });
    return create.mutateAsync({ slug: companySlug, data });
  };

  const run = async (submit: boolean) => {
    setNotice(null);
    setFailure(null);
    const data = build();
    if (!data) return;
    setBusy(true);
    try {
      let saved = await persist(data);
      if (submit) saved = await submitJob.mutateAsync({ id: saved.id });
      await invalidatePrefixes(queryClient, "/jobs");
      if (submit) {
        navigate("/employer", { replace: true });
        return;
      }
      if (!job) {
        navigate(`/employer/jobs/${saved.id}/edit`, { replace: true });
      } else {
        setNotice("Changes saved.");
      }
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  const patchQ = (i: number, change: Partial<Question>) => setQuestions(questions.map((q, idx) => (idx === i ? { ...q, ...change } : q)));

  return (
    <div className={`${pageWrap} max-w-[800px]`}>
      <Link to="/employer" className="font-ui text-[12px] font-bold uppercase tracking-wider text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
        ← Employer
      </Link>
      <div className="mb-6 mt-3 flex flex-wrap items-center gap-3">
        <h1 className={h1}>{job ? "Edit job" : "Post a job"}</h1>
        {job && <StatusPill status={job.status} />}
      </div>
      {job?.status === "rejected" && job.rejectionReason && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-ui text-[13px] text-red-700">
          Rejected by the review team: {job.rejectionReason}. Update the job and submit it again.
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
        className="space-y-6"
      >
        <section className={`${card} space-y-4 p-6`}>
          <h2 className={h2}>The role</h2>
          {job ? (
            <p className={muted}>Company: <strong>{job.company.name}</strong></p>
          ) : (
            <SelectInput
              label="Company"
              value={companySlug}
              onChange={setCompanySlug}
              options={Array.from(new Set([...(companies.data?.map((c) => c.slug) ?? []), ...(companySlug ? [companySlug] : [])]))}
              format={(slug) => companies.data?.find((c) => c.slug === slug)?.name ?? slug}
              placeholder="Select a company…"
            />
          )}
          {errors.company && <p role="alert" className="font-ui text-[12px] text-red-600">{errors.company}</p>}
          <TextInput label="Job title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} placeholder="Senior Pattern Maker" />
          <TextArea
            label="Description"
            rows={12}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            hint={
              <span className={description.length > DESC_MAX ? "text-red-600" : ""}>
                {description.length}/{DESC_MAX} characters (minimum {DESC_MIN}). Plain text only; line breaks are kept.
              </span>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div><SelectInput label="Function" value={fn} onChange={setFn} options={options.functions} placeholder="Select…" />{errors.function && <p role="alert" className="mt-1 font-ui text-[12px] text-red-600">{errors.function}</p>}</div>
            <div><SelectInput label="Seniority" value={seniority} onChange={setSeniority} options={options.seniorities} placeholder="Select…" />{errors.seniority && <p role="alert" className="mt-1 font-ui text-[12px] text-red-600">{errors.seniority}</p>}</div>
            <div><SelectInput label="Employment type" value={employmentType} onChange={setEmploymentType} options={options.employmentTypes} placeholder="Select…" />{errors.employmentType && <p role="alert" className="mt-1 font-ui text-[12px] text-red-600">{errors.employmentType}</p>}</div>
            <div><SelectInput label="Workplace" value={workplace} onChange={setWorkplace} options={options.workplaces} placeholder="Select…" />{errors.workplace && <p role="alert" className="mt-1 font-ui text-[12px] text-red-600">{errors.workplace}</p>}</div>
            <TextInput label="City" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} />
            <SelectInput label="Country" value={country} onChange={setCountry} options={COUNTRIES} placeholder="Select…" format={countryName} />
          </div>
          <TagInput label="Skills" value={skills} onChange={setSkills} max={15} placeholder="e.g. Tech packs, Clo3D" />
        </section>

        <section className={`${card} space-y-4 p-6`}>
          <h2 className={h2}>Compensation</h2>
          <div className="grid gap-4 sm:grid-cols-4">
            <TextInput label="Min" type="number" min={0} inputMode="decimal" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
            <TextInput label="Max" type="number" min={0} inputMode="decimal" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
            <SelectInput label="Currency" value={currency} onChange={setCurrency} options={CURRENCIES} format={(v) => v} />
            <SelectInput label="Per" value={period} onChange={setPeriod} options={options.salaryPeriods} />
          </div>
          {errors.salary && <p role="alert" className="font-ui text-[12px] text-red-600">{errors.salary}</p>}
          <Checkbox label="Show salary on the public listing" checked={showSalary} onChange={setShowSalary} />
        </section>

        <section className={`${card} space-y-4 p-6`}>
          <h2 className={h2}>How to apply</h2>
          <SelectInput
            label="Application method"
            value={applyMode}
            onChange={setApplyMode}
            options={Object.values(JobInputApplyMode)}
            format={(v) => (v === "internal" ? "Apply on Centoire" : "Apply on my own site")}
          />
          {applyMode === "external" ? (
            <TextInput label="Application URL" type="url" maxLength={500} value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} error={errors.externalApplyUrl} placeholder="https://" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-ui text-[11px] font-bold uppercase tracking-wider text-[var(--color-stone)]">Screening questions ({questions.length}/5)</h3>
                <Btn variant="secondary" size="sm" disabled={questions.length >= 5} onClick={() => setQuestions([...questions, { prompt: "", required: false }])}>
                  Add question
                </Btn>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="space-y-2 rounded-xl border border-[var(--color-hairline)] p-4">
                  <TextInput label={`Question ${i + 1}`} maxLength={300} value={q.prompt} onChange={(e) => patchQ(i, { prompt: e.target.value })} />
                  <div className="flex items-center justify-between">
                    <Checkbox label="Required" checked={q.required} onChange={(v) => patchQ(i, { required: v })} />
                    <button type="button" onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))} className="font-ui text-[12px] font-bold uppercase tracking-wider text-red-600">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {errors.questions && <p role="alert" className="font-ui text-[12px] text-red-600">{errors.questions}</p>}
            </div>
          )}
        </section>

        {canSubmit && (
          <p className="rounded-xl bg-[var(--color-sand-warm)] px-4 py-3 font-ui text-[13px] text-[var(--color-stone)]">
            {!companySlug || !company
              ? "Verified companies publish instantly; jobs from other companies go to the Centoire team for review first."
              : company.verified
                ? `${company.name} is verified, so submitting publishes this job immediately.`
                : `${company.name} is not verified yet, so submitting sends this job to the Centoire team for review before it goes live.`}
          </p>
        )}
        <ErrorNotice error={failure} verifyHint />
        {notice && <Notice>{notice}</Notice>}
        <div className="sticky bottom-20 flex flex-wrap items-center gap-3 md:bottom-4">
          {editable && (
            <Btn type="submit" variant="secondary" disabled={busy} loading={busy}>
              {job && job.status !== "draft" ? "Save changes" : "Save draft"}
            </Btn>
          )}
          {canSubmit && (
            <Btn disabled={busy} onClick={() => void run(true)}>
              Submit for review
            </Btn>
          )}
          {job && (
            <LinkBtn to={`/employer/jobs/${job.id}/applicants`} variant="ghost">
              Applicants
            </LinkBtn>
          )}
        </div>
      </form>
    </div>
  );
}

export function JobFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { data: job, isLoading, error } = useGetJob(id ?? "", { query: { enabled: Boolean(id) } });
  useDocumentTitle(id ? "Edit job" : "Post a job");

  if (id) {
    if (isLoading) return <Spinner />;
    if (error || !job) return <div className={pageWrap}><ErrorNotice error={error ?? new Error("Job not found")} /></div>;
    if (!job.viewer.canManage) return <div className={pageWrap}><ErrorNotice error={new Error("You do not have permission to edit this job.")} /></div>;
    return <JobForm key={job.id} job={job} defaultCompany="" />;
  }
  return <JobForm defaultCompany={searchParams.get("company") ?? ""} />;
}
