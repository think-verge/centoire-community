/**
 * Events produced by mini-app processes. They travel through the producer's
 * `platform_outbox` collection; core polls it and re-emits them on its in-process
 * event bus, so notificationService never needs to know a second process exists.
 */
export type JobsEvent =
  | "jobs.application.submitted"
  | "jobs.application.status_changed"
  | "jobs.job.approved"
  | "jobs.job.rejected"
  | "jobs.company.member_invited";

export interface JobsEventPayloads {
  "jobs.application.submitted": {
    actorId: string;
    recipientIds: string[];
    jobId: string;
    applicationId: string;
    jobTitle: string;
    companyName: string;
  };
  "jobs.application.status_changed": {
    actorId: string;
    recipientId: string;
    jobId: string;
    applicationId: string;
    jobTitle: string;
    companyName: string;
    status: string;
  };
  "jobs.job.approved": {
    recipientId: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
  };
  "jobs.job.rejected": {
    recipientId: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
    reason?: string;
  };
  "jobs.company.member_invited": {
    actorId: string;
    recipientId: string;
    companyId: string;
    companyName: string;
  };
}

export const JOBS_EVENTS: JobsEvent[] = [
  "jobs.application.submitted",
  "jobs.application.status_changed",
  "jobs.job.approved",
  "jobs.job.rejected",
  "jobs.company.member_invited",
];

/** A row in a producer's `platform_outbox` collection. */
export interface OutboxRecord<T extends JobsEvent = JobsEvent> {
  type: T;
  payload: JobsEventPayloads[T];
  producer: string;
  createdAt: Date;
}

/** Public subset of a user, served to mini apps by core's internal API. */
export interface UserSummary {
  id: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}
