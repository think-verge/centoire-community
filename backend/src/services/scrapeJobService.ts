import type { Types } from "mongoose";
import { env } from "../config/env.js";
import { ScrapeJob, type IScrapeJob, type ScrapeJobType } from "../models/ScrapeJob.js";
import { Source, type ISource, type ScrapeErrorCode } from "../models/Source.js";
import { ApiError } from "../utils/api-error.js";

const OPEN_STATUSES = ["queued", "leased"] as const;
const REDISCOVER_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** Queues a job unless one of the same type is already waiting or running for that source. */
export async function enqueue(
  sourceId: Types.ObjectId | string,
  type: ScrapeJobType,
  requestedBy?: Types.ObjectId | string,
): Promise<{ job: IScrapeJob; created: boolean }> {
  const open = await ScrapeJob.findOne({ sourceId, type, status: { $in: OPEN_STATUSES } });
  if (open) return { job: open, created: false };
  const job = await ScrapeJob.create({ sourceId, type, requestedBy });
  if (type === "discover") await Source.updateOne({ _id: sourceId }, { $set: { "spec.status": "discovering" } });
  return { job, created: true };
}

/**
 * Hands the oldest queued job to a worker (atomically, so two workers never get the same one).
 * Jobs whose lease lapsed are first returned to the queue, or failed after too many attempts.
 */
export async function lease(
  workerId: string,
  types: ScrapeJobType[] = ["discover", "scrape"],
): Promise<{ job: IScrapeJob; source: ISource } | null> {
  const now = new Date();
  await ScrapeJob.updateMany(
    { status: "leased", leaseUntil: { $lt: now }, attempts: { $gte: env.SCRAPE_MAX_ATTEMPTS } },
    { $set: { status: "failed", errorCode: "internal", errorMessage: "Worker stopped responding too many times", finishedAt: now } },
  );
  await ScrapeJob.updateMany(
    { status: "leased", leaseUntil: { $lt: now } },
    { $set: { status: "queued" }, $unset: { leasedBy: "", leaseUntil: "" } },
  );

  // A few passes so a job for a deleted/paused source doesn't block the ones behind it.
  for (let i = 0; i < 5; i++) {
    const job = await ScrapeJob.findOneAndUpdate(
      { status: "queued", type: { $in: types } },
      {
        $set: { status: "leased", leasedBy: workerId, leaseUntil: new Date(Date.now() + env.SCRAPE_LEASE_SECONDS * 1000), startedAt: now },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!job) return null;
    const source = await Source.findById(job.sourceId);
    if (source?.active) return { job, source };
    await ScrapeJob.updateOne(
      { _id: job._id },
      { $set: { status: "failed", errorCode: "internal", errorMessage: source ? "Source is paused" : "Source was deleted", finishedAt: new Date() } },
    );
  }
  return null;
}

async function ownJob(jobId: string, workerId: string): Promise<IScrapeJob> {
  const job = await ScrapeJob.findOne({ _id: jobId, status: "leased", leasedBy: workerId });
  if (!job) throw new ApiError(409, "Job is not leased to this worker");
  return job;
}

export async function heartbeat(jobId: string, workerId: string): Promise<void> {
  const job = await ownJob(jobId, workerId);
  job.leaseUntil = new Date(Date.now() + env.SCRAPE_LEASE_SECONDS * 1000);
  await job.save();
}

export interface CompleteInput {
  ok: boolean;
  stats?: { itemsSeen: number; imported: number; duplicates: number; updated: number };
  errorCode?: ScrapeErrorCode;
  errorMessage?: string;
}

/** Records the outcome on the job and mirrors it onto the source (what the admin UI shows). */
export async function complete(jobId: string, workerId: string, result: CompleteInput): Promise<void> {
  const job = await ownJob(jobId, workerId);
  const now = new Date();
  job.status = result.ok ? "done" : "failed";
  job.finishedAt = now;
  job.stats = result.stats;
  job.errorCode = result.ok ? undefined : (result.errorCode ?? "internal");
  job.errorMessage = result.ok ? undefined : result.errorMessage?.slice(0, 500);
  await job.save();

  const set: Record<string, unknown> = {
    lastFetchedAt: now,
    lastStatus: result.ok ? "ok" : "error",
    lastError: result.ok ? undefined : result.errorMessage?.slice(0, 500),
    lastRun: {
      status: result.ok ? "ok" : "error",
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      itemsSeen: result.stats?.itemsSeen ?? 0,
      imported: result.stats?.imported ?? 0,
      duplicates: result.stats?.duplicates ?? 0,
      finishedAt: now,
    },
  };
  // A broken layout needs a fresh discovery; credentials/captcha problems need a human.
  if (!result.ok) {
    if (job.errorCode === "layout_changed") set["spec.status"] = "needs_rediscovery";
    else if (job.errorCode === "needs_human" || job.errorCode === "login_expired") set["spec.status"] = "needs_human";
    else if (job.type === "discover") set["spec.status"] = "none";
  }
  await Source.updateOne({ _id: job.sourceId }, { $set: set });
}

export async function recentJobs(sourceId: string, limit = 10): Promise<IScrapeJob[]> {
  return ScrapeJob.find({ sourceId }).sort({ createdAt: -1 }).limit(limit);
}

/**
 * Enqueues whatever is due: first-time discovery, re-discovery (with a cool-down so a flapping site
 * can't burn LLM budget), and periodic scrapes for sources whose spec is ready.
 */
export async function scheduleDueJobs(now = new Date()): Promise<{ enqueued: number }> {
  const sources = await Source.find({ active: true, method: "agent" });
  if (sources.length === 0) return { enqueued: 0 };
  const open = await ScrapeJob.find({ status: { $in: OPEN_STATUSES } }).select("sourceId type").lean();
  const openKeys = new Set(open.map((j) => `${j.sourceId}:${j.type}`));
  const recentDiscover = await ScrapeJob.find({ type: "discover", createdAt: { $gt: new Date(now.getTime() - REDISCOVER_COOLDOWN_MS) } })
    .select("sourceId")
    .lean();
  const coolingDown = new Set(recentDiscover.map((j) => String(j.sourceId)));

  let enqueued = 0;
  for (const source of sources) {
    const id = String(source._id);
    const status = source.spec?.status ?? "none";
    if (status === "none" || status === "needs_rediscovery") {
      if (!openKeys.has(`${id}:discover`) && !coolingDown.has(id)) {
        await enqueue(source._id, "discover");
        enqueued += 1;
      }
    } else if (status === "ready") {
      const last = source.lastRun?.finishedAt ?? source.lastFetchedAt;
      const due = !last || now.getTime() - last.getTime() >= (source.scrapeIntervalMin ?? 30) * 60_000;
      if (due && !openKeys.has(`${id}:scrape`)) {
        await enqueue(source._id, "scrape");
        enqueued += 1;
      }
    }
    // "discovering" and "needs_human" wait for the worker / a person.
  }
  return { enqueued };
}
