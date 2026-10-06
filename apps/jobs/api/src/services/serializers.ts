import type { UserSummary } from "@centoire/contracts";
import type { IApplication, ICandidateProfile, ICompany, IJob } from "../models/index.js";
import type { CompanyRole } from "../taxonomy.js";

export const iso = (d?: Date | null) => (d ? d.toISOString() : null);

export function serializeUser(user: UserSummary) {
  return { id: user.id, handle: user.handle, displayName: user.displayName, avatarUrl: user.avatarUrl };
}

export function serializeCompanyRef(c: ICompany) {
  return {
    id: c._id.toString(),
    slug: c.slug,
    name: c.name,
    logoUrl: c.logoUrl ?? null,
    verified: c.verified,
  };
}

export function serializeCompany(c: ICompany, viewerRole: CompanyRole | null = null) {
  return {
    ...serializeCompanyRef(c),
    coverUrl: c.coverUrl ?? null,
    website: c.website ?? null,
    about: c.about ?? null,
    segment: c.segment,
    sizeRange: c.sizeRange ?? null,
    hq: c.hq && (c.hq.city || c.hq.countryCode) ? { city: c.hq.city ?? null, countryCode: c.hq.countryCode ?? null } : null,
    openJobCount: c.openJobCount,
    viewerRole,
    createdAt: c.createdAt.toISOString(),
  };
}

export interface JobViewer {
  saved: boolean;
  applied: boolean;
  canManage: boolean;
}

export function serializeJob(job: IJob, company: ICompany, viewer: JobViewer) {
  const salary = job.salary;
  const showSalary = Boolean(salary && (salary.min != null || salary.max != null) && (salary.visible || viewer.canManage));
  return {
    id: job._id.toString(),
    slug: job.slug,
    title: job.title,
    description: job.description,
    company: serializeCompanyRef(company),
    function: job.function,
    seniority: job.seniority,
    employmentType: job.employmentType,
    workplace: job.workplace,
    location:
      job.location && (job.location.city || job.location.countryCode)
        ? { city: job.location.city ?? null, countryCode: job.location.countryCode ?? null }
        : null,
    salary: showSalary
      ? {
          min: salary?.min ?? null,
          max: salary?.max ?? null,
          currency: salary?.currency ?? null,
          period: salary?.period ?? null,
        }
      : null,
    skills: job.skills,
    applyMode: job.applyMode,
    externalApplyUrl: job.externalApplyUrl ?? null,
    screeningQuestions: job.screeningQuestions.map((q) => ({ id: q.id, prompt: q.prompt, required: q.required })),
    status: job.status,
    rejectionReason: viewer.canManage ? (job.rejectionReason ?? null) : null,
    publishedAt: iso(job.publishedAt),
    expiresAt: iso(job.expiresAt),
    applicationCount: job.applicationCount,
    createdAt: job.createdAt.toISOString(),
    viewer,
  };
}

export function serializeApplication(
  app: IApplication,
  job: IJob,
  company: ICompany,
  opts: { applicant: UserSummary | null; forHiringTeam: boolean },
) {
  return {
    id: app._id.toString(),
    job: {
      id: job._id.toString(),
      slug: job.slug,
      title: job.title,
      status: job.status,
      company: serializeCompanyRef(company),
    },
    applicant: opts.applicant ? serializeUser(opts.applicant) : null,
    headline: app.profileSnapshot?.headline ?? null,
    coverNote: app.coverNote ?? null,
    answers: app.answers.map((a) => ({ questionId: a.questionId, answer: a.answer })),
    portfolioUrl: app.portfolioUrl ?? null,
    status: app.status,
    statusHistory: app.statusHistory.map((h) => ({ status: h.status, at: h.at.toISOString() })),
    recruiterNotes: opts.forHiringTeam ? (app.recruiterNotes ?? null) : null,
    createdAt: app.createdAt.toISOString(),
  };
}

export function serializeProfile(p: ICandidateProfile | null, user: UserSummary | null) {
  return {
    user: user ? serializeUser(user) : null,
    headline: p?.headline ?? null,
    location: p?.location ?? null,
    openToWork: p?.openToWork ?? false,
    visibility: p?.visibility ?? "recruiters",
    desiredFunctions: (p?.desiredFunctions ?? []) as never[],
    desiredLocations: p?.desiredLocations ?? [],
    workplacePrefs: (p?.workplacePrefs ?? []) as never[],
    experience: (p?.experience ?? []).map((e) => ({
      title: e.title,
      companyName: e.companyName,
      start: e.start ?? null,
      end: e.end ?? null,
      description: e.description ?? null,
    })),
    education: (p?.education ?? []).map((e) => ({
      school: e.school,
      degree: e.degree ?? null,
      start: e.start ?? null,
      end: e.end ?? null,
    })),
    skills: p?.skills ?? [],
    portfolioUrl: p?.portfolioUrl ?? null,
    links: p?.links ?? [],
  };
}
