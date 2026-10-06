import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { hasPermission, type AuthPayload } from "@centoire/contracts";
import { ApiError, decodeCursor, encodeCursor } from "@centoire/server-kit";
import { env } from "../config/env.js";
import { Application, Company, Job, SavedJob, type ICompany, type IJob } from "../models/index.js";
import { emitPlatformEvent } from "../outbox.js";
import type { JobInput, JobListQuery } from "../schemas/jobs.js";
import { slugify } from "../utils/slugify.js";
import { getCompanyOr404, isPlatformAdmin, memberCompanyIds, requireCompanyRole } from "./access.js";
import { refreshOpenJobCount } from "./companyService.js";
import { serializeJob, type JobViewer } from "./serializers.js";

const PAGE_SIZE = 20;

interface KeysetCursor extends Record<string, unknown> {
  publishedAt: string;
  id: string;
}

/** Viewer flags for a batch of jobs in 3 queries, so list endpoints stay O(1) in round trips. */
async function viewerStates(jobs: IJob[], user?: AuthPayload): Promise<Map<string, JobViewer>> {
  const states = new Map<string, JobViewer>();
  const manageable = await memberCompanyIds(user?.userId);
  const admin = isPlatformAdmin(user);
  let saved = new Set<string>();
  let applied = new Set<string>();
  if (user && jobs.length > 0) {
    const ids = jobs.map((j) => j._id);
    const [s, a] = await Promise.all([
      SavedJob.find({ userId: user.userId, jobId: { $in: ids } }).select("jobId"),
      Application.find({ applicantId: user.userId, jobId: { $in: ids }, status: { $ne: "withdrawn" } }).select("jobId"),
    ]);
    saved = new Set(s.map((r) => r.jobId.toString()));
    applied = new Set(a.map((r) => r.jobId.toString()));
  }
  for (const job of jobs) {
    states.set(job._id.toString(), {
      saved: saved.has(job._id.toString()),
      applied: applied.has(job._id.toString()),
      canManage: admin || manageable.has(job.companyId.toString()),
    });
  }
  return states;
}

async function companiesFor(jobs: IJob[]): Promise<Map<string, ICompany>> {
  const companies = await Company.find({ _id: { $in: [...new Set(jobs.map((j) => j.companyId.toString()))] } });
  return new Map(companies.map((c) => [c._id.toString(), c]));
}

export async function serializeJobs(jobs: IJob[], user?: AuthPayload) {
  const [states, companies] = await Promise.all([viewerStates(jobs, user), companiesFor(jobs)]);
  return jobs.flatMap((job) => {
    const company = companies.get(job.companyId.toString());
    return company ? [serializeJob(job, company, states.get(job._id.toString()) as JobViewer)] : [];
  });
}

export async function listPublic(query: JobListQuery, user?: AuthPayload) {
  const filter: Record<string, unknown> = { status: "published", expiresAt: { $gt: new Date() } };
  if (query.function) filter.function = query.function;
  if (query.seniority) filter.seniority = query.seniority;
  if (query.type) filter.employmentType = query.type;
  if (query.workplace) filter.workplace = query.workplace;
  if (query.country) filter["location.countryCode"] = query.country.toUpperCase();
  if (query.q) filter.$text = { $search: query.q };
  if (query.company) {
    const company = await Company.findOne({ slug: query.company.toLowerCase() }).select("_id");
    if (!company) return { items: [], nextCursor: null };
    filter.companyId = company._id;
  }
  return page(filter, query.cursor, user);
}

export async function listForCompany(slug: string, cursor: string | undefined, user?: AuthPayload) {
  const company = await getCompanyOr404(slug);
  return page({ status: "published", expiresAt: { $gt: new Date() }, companyId: company._id }, cursor, user);
}

async function page(base: Record<string, unknown>, cursor: string | undefined, user?: AuthPayload) {
  const filter = { ...base };
  const decoded = decodeCursor<KeysetCursor>(cursor);
  if (decoded) {
    const at = new Date(decoded.publishedAt);
    filter.$or = [{ publishedAt: { $lt: at } }, { publishedAt: at, _id: { $lt: new Types.ObjectId(decoded.id) } }];
  }
  const jobs = await Job.find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(PAGE_SIZE + 1);
  const hasMore = jobs.length > PAGE_SIZE;
  const items = hasMore ? jobs.slice(0, PAGE_SIZE) : jobs;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last?.publishedAt ? encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: last._id.toString() }) : null;
  return { items: await serializeJobs(items, user), nextCursor };
}

async function loadJob(id: string): Promise<IJob> {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Job not found");
  const job = await Job.findById(id);
  if (!job) throw new ApiError(404, "Job not found");
  return job;
}

/** Loads a job and the company; throws 403 unless the user is at least a recruiter there. */
async function loadManageable(id: string, user: AuthPayload) {
  const job = await loadJob(id);
  const company = await Company.findById(job.companyId);
  if (!company) throw new ApiError(404, "Job not found");
  await requireCompanyRole(company, user, "recruiter");
  return { job, company };
}

export async function getJob(id: string, user?: AuthPayload) {
  const job = await loadJob(id);
  const [view] = await serializeJobs([job], user);
  if (!view) throw new ApiError(404, "Job not found");
  const publicStatus = ["published", "closed", "expired"].includes(job.status);
  if (!publicStatus && !view.viewer.canManage) throw new ApiError(404, "Job not found");
  if (!view.viewer.canManage) void Job.updateOne({ _id: job._id }, { $inc: { viewCount: 1 } }).catch(() => undefined);
  return view;
}

function applyInput(job: IJob, input: Partial<JobInput>): void {
  const { title, description, function: fn, seniority, employmentType, workplace, location, salary, skills, applyMode, externalApplyUrl, screeningQuestions } = input;
  if (title !== undefined) {
    job.title = title;
    job.slug = slugify(title);
  }
  if (description !== undefined) job.description = description;
  if (fn !== undefined) job.function = fn;
  if (seniority !== undefined) job.seniority = seniority;
  if (employmentType !== undefined) job.employmentType = employmentType;
  if (workplace !== undefined) job.workplace = workplace;
  if (location !== undefined) job.location = location;
  if (salary !== undefined) job.salary = { ...salary, visible: salary.visible ?? true };
  if (skills !== undefined) job.skills = [...new Set(skills)];
  if (applyMode !== undefined) job.applyMode = applyMode;
  if (externalApplyUrl !== undefined) job.externalApplyUrl = externalApplyUrl;
  if (screeningQuestions !== undefined) {
    job.screeningQuestions = screeningQuestions.map((q) => ({ id: randomUUID().slice(0, 8), prompt: q.prompt, required: q.required ?? false }));
  }
}

function assertSalary(job: IJob): void {
  const s = job.salary;
  if (s?.min != null && s.max != null && s.min > s.max) throw new ApiError(422, "salary: minimum cannot exceed maximum");
}

export async function createJob(user: AuthPayload, companySlug: string, input: JobInput) {
  const company = await getCompanyOr404(companySlug);
  await requireCompanyRole(company, user, "recruiter");
  const job = new Job({ companyId: company._id, postedBy: user.userId, status: "draft", slug: slugify(input.title) });
  applyInput(job, input);
  assertSalary(job);
  await job.save();
  const [view] = await serializeJobs([job], user);
  return view;
}

const EDITABLE: IJob["status"][] = ["draft", "rejected", "published"];

export async function updateJob(user: AuthPayload, id: string, input: Partial<JobInput>) {
  const { job } = await loadManageable(id, user);
  if (!EDITABLE.includes(job.status)) throw new ApiError(422, "This job can't be edited in its current state");
  applyInput(job, input);
  assertSalary(job);
  // Editing a live job keeps it live; rejected jobs go back to draft so they can be resubmitted.
  if (job.status === "rejected") {
    job.status = "draft";
    job.rejectionReason = undefined;
  }
  await job.save();
  const [view] = await serializeJobs([job], user);
  return view;
}

function validateForSubmit(job: IJob): void {
  if (job.applyMode === "external" && !job.externalApplyUrl) {
    throw new ApiError(422, "externalApplyUrl: provide the link candidates should apply through");
  }
}

function publish(job: IJob, reviewer?: string): void {
  job.status = "published";
  job.publishedAt = new Date();
  job.expiresAt = new Date(Date.now() + env.JOB_TTL_DAYS * 24 * 60 * 60 * 1000);
  job.rejectionReason = undefined;
  if (reviewer) {
    job.reviewedBy = reviewer;
    job.reviewedAt = new Date();
  }
}

export async function submitJob(user: AuthPayload, id: string) {
  const { job, company } = await loadManageable(id, user);
  if (job.status !== "draft") throw new ApiError(422, "Only drafts can be submitted");
  validateForSubmit(job);
  // Verified companies publish instantly; everyone else waits for an editor.
  if (company.verified) publish(job);
  else job.status = "pending_review";
  await job.save();
  await refreshOpenJobCount(company);
  const [view] = await serializeJobs([job], user);
  return view;
}

export async function closeJob(user: AuthPayload, id: string) {
  const { job, company } = await loadManageable(id, user);
  if (job.status === "closed") return (await serializeJobs([job], user))[0];
  job.status = "closed";
  await job.save();
  await refreshOpenJobCount(company);
  return (await serializeJobs([job], user))[0];
}

export async function listEmployerJobs(user: AuthPayload, query: { company?: string; status?: string }) {
  const ids = isPlatformAdmin(user) && !query.company ? null : [...(await memberCompanyIds(user.userId))];
  const filter: Record<string, unknown> = {};
  if (ids) filter.companyId = { $in: ids.map((i) => new Types.ObjectId(i)) };
  if (query.company) {
    const company = await getCompanyOr404(query.company);
    await requireCompanyRole(company, user, "recruiter");
    filter.companyId = company._id;
  }
  if (query.status) filter.status = query.status;
  const jobs = await Job.find(filter).sort({ updatedAt: -1 }).limit(200);
  return serializeJobs(jobs, user);
}

// ─── Review queue (editors/admins with jobs.moderate) ────────────────────────

function assertModerator(user: AuthPayload): void {
  if (!hasPermission(user.role, "jobs.moderate")) throw new ApiError(403, "Insufficient permissions");
}

export async function listPending(user: AuthPayload) {
  assertModerator(user);
  const jobs = await Job.find({ status: "pending_review" }).sort({ updatedAt: 1 }).limit(100);
  return serializeJobs(jobs, user);
}

async function loadPending(user: AuthPayload, id: string) {
  assertModerator(user);
  const job = await loadJob(id);
  if (job.status !== "pending_review") throw new ApiError(422, "This job is not pending review");
  const company = await Company.findById(job.companyId);
  if (!company) throw new ApiError(404, "Job not found");
  return { job, company };
}

export async function approveJob(user: AuthPayload, id: string) {
  const { job, company } = await loadPending(user, id);
  publish(job, user.userId);
  await job.save();
  await refreshOpenJobCount(company);
  await emitPlatformEvent("jobs.job.approved", {
    recipientId: job.postedBy,
    jobId: job._id.toString(),
    jobTitle: job.title,
    companyName: company.name,
  });
  return (await serializeJobs([job], user))[0];
}

export async function rejectJob(user: AuthPayload, id: string, reason: string) {
  const { job, company } = await loadPending(user, id);
  job.status = "rejected";
  job.rejectionReason = reason;
  job.reviewedBy = user.userId;
  job.reviewedAt = new Date();
  await job.save();
  await emitPlatformEvent("jobs.job.rejected", {
    recipientId: job.postedBy,
    jobId: job._id.toString(),
    jobTitle: job.title,
    companyName: company.name,
    reason,
  });
  return (await serializeJobs([job], user))[0];
}

// ─── Saved jobs ──────────────────────────────────────────────────────────────

export async function saveJob(user: AuthPayload, id: string) {
  const job = await loadJob(id);
  await SavedJob.updateOne({ userId: user.userId, jobId: job._id }, { $setOnInsert: { userId: user.userId, jobId: job._id } }, { upsert: true });
}

export async function unsaveJob(user: AuthPayload, id: string) {
  if (!Types.ObjectId.isValid(id)) return;
  await SavedJob.deleteOne({ userId: user.userId, jobId: new Types.ObjectId(id) });
}

export async function listSaved(user: AuthPayload) {
  const saved = await SavedJob.find({ userId: user.userId }).sort({ createdAt: -1 }).limit(100);
  const jobs = await Job.find({ _id: { $in: saved.map((s) => s.jobId) } });
  const byId = new Map(jobs.map((j) => [j._id.toString(), j]));
  const ordered = saved.flatMap((s) => (byId.has(s.jobId.toString()) ? [byId.get(s.jobId.toString()) as IJob] : []));
  return serializeJobs(ordered, user);
}
