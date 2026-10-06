/** Fashion-industry job taxonomy; single source for models, validation, filters and the UI. */
export const JOB_FUNCTIONS = [
  "design",
  "pattern_making",
  "merchandising",
  "buying",
  "sourcing",
  "production",
  "marketing",
  "retail",
  "styling",
  "photography",
  "textile",
  "tech",
  "other",
] as const;

export const SENIORITIES = ["intern", "junior", "mid", "senior", "lead", "director"] as const;
export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "freelance", "internship"] as const;
export const WORKPLACES = ["onsite", "hybrid", "remote"] as const;
export const COMPANY_SEGMENTS = [
  "luxury",
  "premium",
  "fast_fashion",
  "textiles",
  "manufacturing",
  "retail",
  "beauty",
  "media",
  "agency",
  "other",
] as const;
export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export const SALARY_PERIODS = ["year", "month", "hour", "project"] as const;
export const JOB_STATUSES = ["draft", "pending_review", "published", "rejected", "closed", "expired"] as const;
export const APPLICATION_STATUSES = [
  "submitted",
  "viewed",
  "shortlisted",
  "rejected",
  "withdrawn",
  "hired",
] as const;
export const COMPANY_ROLES = ["owner", "admin", "recruiter"] as const;
export const PROFILE_VISIBILITIES = ["public", "recruiters", "private"] as const;

export type JobFunction = (typeof JOB_FUNCTIONS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type CompanyRole = (typeof COMPANY_ROLES)[number];
export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
