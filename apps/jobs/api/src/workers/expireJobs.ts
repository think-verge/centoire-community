import cron from "node-cron";
import { Company, Job } from "../models/index.js";

/** Marks published jobs past their expiry as `expired` and refreshes each company's open-job count. */
export async function expireJobs(now = new Date()): Promise<number> {
  const stale = await Job.find({ status: "published", expiresAt: { $lte: now } }).select("companyId");
  if (stale.length === 0) return 0;
  await Job.updateMany({ _id: { $in: stale.map((j) => j._id) } }, { $set: { status: "expired" } });
  for (const companyId of new Set(stale.map((j) => j.companyId.toString()))) {
    const open = await Job.countDocuments({ companyId, status: "published" });
    await Company.updateOne({ _id: companyId }, { $set: { openJobCount: open } });
  }
  return stale.length;
}

export function startExpiryCron(): void {
  cron.schedule("17 * * * *", () => {
    expireJobs()
      .then((n) => n > 0 && console.log(`[cron] expired ${n} job(s)`))
      .catch((err) => console.error("[cron] expiry failed:", err.message));
  });
  console.log("[cron] job expiry scheduled: hourly");
}
