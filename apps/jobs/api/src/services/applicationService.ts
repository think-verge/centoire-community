import { Types } from "mongoose";
import type { AuthPayload } from "@centoire/contracts";
import { ApiError } from "@centoire/server-kit";
import { Application, CandidateProfile, Company, CompanyMember, Job, type IApplication, type IJob } from "../models/index.js";
import { emitPlatformEvent } from "../outbox.js";
import { getUserSummaries } from "../platform.js";
import type { ApplyInput } from "../schemas/jobs.js";
import { requireCompanyRole } from "./access.js";
import { serializeApplication } from "./serializers.js";

async function hydrate(apps: IApplication[], forHiringTeam: boolean) {
  const [jobs, companies, users] = await Promise.all([
    Job.find({ _id: { $in: apps.map((a) => a.jobId) } }),
    Company.find({ _id: { $in: apps.map((a) => a.companyId) } }),
    forHiringTeam ? getUserSummaries(apps.map((a) => a.applicantId)) : Promise.resolve(new Map()),
  ]);
  const jobById = new Map(jobs.map((j) => [j._id.toString(), j]));
  const companyById = new Map(companies.map((c) => [c._id.toString(), c]));
  return apps.flatMap((app) => {
    const job = jobById.get(app.jobId.toString());
    const company = companyById.get(app.companyId.toString());
    if (!job || !company) return [];
    return [serializeApplication(app, job, company, { applicant: users.get(app.applicantId) ?? null, forHiringTeam })];
  });
}

export async function apply(user: AuthPayload, jobId: string, input: ApplyInput) {
  if (!Types.ObjectId.isValid(jobId)) throw new ApiError(404, "Job not found");
  const job = await Job.findById(jobId);
  if (!job) throw new ApiError(404, "Job not found");
  const company = await Company.findById(job.companyId);
  if (!company) throw new ApiError(404, "Job not found");
  if (job.status !== "published" || (job.expiresAt && job.expiresAt < new Date())) {
    throw new ApiError(422, "This job is no longer accepting applications");
  }
  if (job.applyMode !== "internal") throw new ApiError(422, "Apply through the company's own link for this job");

  const answers = input.answers ?? [];
  for (const q of job.screeningQuestions) {
    const answer = answers.find((a) => a.questionId === q.id)?.answer.trim();
    if (q.required && !answer) throw new ApiError(422, `answers: please answer "${q.prompt}"`);
  }

  const existing = await Application.findOne({ jobId: job._id, applicantId: user.userId });
  if (existing && existing.status !== "withdrawn") throw new ApiError(409, "You have already applied to this job");

  const profile = await CandidateProfile.findOne({ userId: user.userId });
  const snapshot = { headline: profile?.headline, location: profile?.location, skills: profile?.skills ?? [] };
  const now = new Date();
  // A withdrawn application can be re-submitted; reuse the row (the unique index is per job+applicant).
  const application =
    existing ??
    new Application({ jobId: job._id, companyId: company._id, applicantId: user.userId });
  application.coverNote = input.coverNote;
  application.portfolioUrl = input.portfolioUrl ?? profile?.portfolioUrl;
  application.answers = answers.filter((a) => job.screeningQuestions.some((q) => q.id === a.questionId));
  application.profileSnapshot = snapshot;
  application.status = "submitted";
  application.statusHistory.push({ status: "submitted", at: now, by: user.userId });
  await application.save();
  await Job.updateOne({ _id: job._id }, { $inc: { applicationCount: 1 } });

  const team = await CompanyMember.find({ companyId: company._id }).select("userId");
  await emitPlatformEvent("jobs.application.submitted", {
    actorId: user.userId,
    recipientIds: team.map((m) => m.userId),
    jobId: job._id.toString(),
    applicationId: application._id.toString(),
    jobTitle: job.title,
    companyName: company.name,
  });
  return (await hydrate([application], false))[0];
}

export async function listMine(user: AuthPayload) {
  const apps = await Application.find({ applicantId: user.userId }).sort({ createdAt: -1 }).limit(100);
  return hydrate(apps, false);
}

export async function getMine(user: AuthPayload, id: string) {
  const app = Types.ObjectId.isValid(id) ? await Application.findOne({ _id: id, applicantId: user.userId }) : null;
  if (!app) throw new ApiError(404, "Application not found");
  return (await hydrate([app], false))[0];
}

export async function withdraw(user: AuthPayload, id: string) {
  const app = Types.ObjectId.isValid(id) ? await Application.findOne({ _id: id, applicantId: user.userId }) : null;
  if (!app) throw new ApiError(404, "Application not found");
  if (app.status === "withdrawn") return;
  app.status = "withdrawn";
  app.statusHistory.push({ status: "withdrawn", at: new Date(), by: user.userId });
  await app.save();
  await Job.updateOne({ _id: app.jobId, applicationCount: { $gt: 0 } }, { $inc: { applicationCount: -1 } });
}

// ─── Hiring team ─────────────────────────────────────────────────────────────

async function loadForTeam(user: AuthPayload, applicationId: string) {
  const app = Types.ObjectId.isValid(applicationId) ? await Application.findById(applicationId) : null;
  if (!app) throw new ApiError(404, "Application not found");
  const company = await Company.findById(app.companyId);
  if (!company) throw new ApiError(404, "Application not found");
  await requireCompanyRole(company, user, "recruiter");
  return { app, company };
}

export async function listForJob(user: AuthPayload, jobId: string) {
  const job: IJob | null = Types.ObjectId.isValid(jobId) ? await Job.findById(jobId) : null;
  if (!job) throw new ApiError(404, "Job not found");
  const company = await Company.findById(job.companyId);
  if (!company) throw new ApiError(404, "Job not found");
  await requireCompanyRole(company, user, "recruiter");
  const apps = await Application.find({ jobId: job._id, status: { $ne: "withdrawn" } }).sort({ createdAt: -1 }).limit(200);
  return hydrate(apps, true);
}

export async function getForTeam(user: AuthPayload, id: string) {
  const { app } = await loadForTeam(user, id);
  return (await hydrate([app], true))[0];
}

export async function update(user: AuthPayload, id: string, input: { status?: "viewed" | "shortlisted" | "rejected" | "hired"; recruiterNotes?: string }) {
  const { app, company } = await loadForTeam(user, id);
  if (input.recruiterNotes !== undefined) app.recruiterNotes = input.recruiterNotes;
  const statusChanged = input.status !== undefined && input.status !== app.status && app.status !== "withdrawn";
  if (statusChanged && input.status) {
    // "viewed" must never downgrade a decision the team already made.
    const decided = ["shortlisted", "rejected", "hired"].includes(app.status);
    if (!(input.status === "viewed" && decided)) {
      app.status = input.status;
      app.statusHistory.push({ status: input.status, at: new Date(), by: user.userId });
    }
  }
  await app.save();
  if (statusChanged && input.status && input.status !== "viewed" && app.status === input.status) {
    const job = await Job.findById(app.jobId).select("title");
    await emitPlatformEvent("jobs.application.status_changed", {
      actorId: user.userId,
      recipientId: app.applicantId,
      jobId: app.jobId.toString(),
      applicationId: app._id.toString(),
      jobTitle: job?.title ?? "your application",
      companyName: company.name,
      status: input.status,
    });
  }
  return (await hydrate([app], true))[0];
}
