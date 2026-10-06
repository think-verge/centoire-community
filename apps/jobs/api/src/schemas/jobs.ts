import { registry, z } from "./registry.js";
import {
  APPLICATION_STATUSES,
  COMPANY_ROLES,
  COMPANY_SEGMENTS,
  COMPANY_SIZES,
  EMPLOYMENT_TYPES,
  JOB_FUNCTIONS,
  JOB_STATUSES,
  PROFILE_VISIBILITIES,
  SALARY_PERIODS,
  SENIORITIES,
  WORKPLACES,
} from "../taxonomy.js";

const countryCode = z.string().length(2);
const urlOrNull = z.string().nullable();

// ─── Shared building blocks ──────────────────────────────────────────────────

export const UserSummarySchema = registry.register(
  "UserSummary",
  z.object({
    id: z.string(),
    handle: z.string().nullable(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
);

export const CompanyRefSchema = registry.register(
  "CompanyRef",
  z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    logoUrl: urlOrNull,
    verified: z.boolean(),
  }),
);

export const CompanySchema = registry.register(
  "Company",
  CompanyRefSchema.extend({
    coverUrl: urlOrNull,
    website: urlOrNull,
    about: z.string().nullable(),
    segment: z.enum(COMPANY_SEGMENTS),
    sizeRange: z.enum(COMPANY_SIZES).nullable(),
    hq: z.object({ city: z.string().nullable(), countryCode: z.string().nullable() }).nullable(),
    openJobCount: z.number(),
    viewerRole: z.enum(COMPANY_ROLES).nullable(),
    createdAt: z.string(),
  }),
);

const LocationSchema = z.object({ city: z.string().nullable(), countryCode: z.string().nullable() });
const SalarySchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  currency: z.string().nullable(),
  period: z.enum(SALARY_PERIODS).nullable(),
});
const ScreeningQuestionSchema = z.object({ id: z.string(), prompt: z.string(), required: z.boolean() });

export const JobSchema = registry.register(
  "Job",
  z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    company: CompanyRefSchema,
    function: z.enum(JOB_FUNCTIONS),
    seniority: z.enum(SENIORITIES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    workplace: z.enum(WORKPLACES),
    location: LocationSchema.nullable(),
    salary: SalarySchema.nullable(),
    skills: z.array(z.string()),
    applyMode: z.enum(["internal", "external"]),
    externalApplyUrl: urlOrNull,
    screeningQuestions: z.array(ScreeningQuestionSchema),
    status: z.enum(JOB_STATUSES),
    rejectionReason: z.string().nullable(),
    publishedAt: z.string().nullable(),
    expiresAt: z.string().nullable(),
    applicationCount: z.number(),
    createdAt: z.string(),
    viewer: z.object({ saved: z.boolean(), applied: z.boolean(), canManage: z.boolean() }),
  }),
);

export const JobPageSchema = registry.register(
  "JobPage",
  z.object({ items: z.array(JobSchema), nextCursor: z.string().nullable() }),
);

export const TaxonomySchema = registry.register(
  "Taxonomy",
  z.object({
    functions: z.array(z.string()),
    seniorities: z.array(z.string()),
    employmentTypes: z.array(z.string()),
    workplaces: z.array(z.string()),
    companySegments: z.array(z.string()),
    companySizes: z.array(z.string()),
    salaryPeriods: z.array(z.string()),
  }),
);

export const CompanyMemberSchema = registry.register(
  "CompanyMember",
  z.object({ user: UserSummarySchema, role: z.enum(COMPANY_ROLES) }),
);

export const JobRefSchema = registry.register(
  "JobRef",
  z.object({
    id: z.string(),
    slug: z.string(),
    title: z.string(),
    status: z.enum(JOB_STATUSES),
    company: CompanyRefSchema,
  }),
);

export const ApplicationSchema = registry.register(
  "Application",
  z.object({
    id: z.string(),
    job: JobRefSchema,
    applicant: UserSummarySchema.nullable(),
    headline: z.string().nullable(),
    coverNote: z.string().nullable(),
    answers: z.array(z.object({ questionId: z.string(), answer: z.string() })),
    portfolioUrl: z.string().nullable(),
    status: z.enum(APPLICATION_STATUSES),
    statusHistory: z.array(z.object({ status: z.enum(APPLICATION_STATUSES), at: z.string() })),
    /** Only present for the hiring team. */
    recruiterNotes: z.string().nullable(),
    createdAt: z.string(),
  }),
);

const ExperienceSchema = z.object({
  title: z.string().max(120),
  companyName: z.string().max(120),
  start: z.string().nullish(),
  end: z.string().nullish(),
  description: z.string().max(2000).nullish(),
});
const EducationSchema = z.object({
  school: z.string().max(120),
  degree: z.string().max(120).nullish(),
  start: z.string().nullish(),
  end: z.string().nullish(),
});

export const CandidateProfileSchema = registry.register(
  "CandidateProfile",
  z.object({
    user: UserSummarySchema.nullable(),
    headline: z.string().nullable(),
    location: z.string().nullable(),
    openToWork: z.boolean(),
    visibility: z.enum(PROFILE_VISIBILITIES),
    desiredFunctions: z.array(z.enum(JOB_FUNCTIONS)),
    desiredLocations: z.array(z.string()),
    workplacePrefs: z.array(z.enum(WORKPLACES)),
    experience: z.array(ExperienceSchema),
    education: z.array(EducationSchema),
    skills: z.array(z.string()),
    portfolioUrl: z.string().nullable(),
    links: z.array(z.string()),
  }),
);

// ─── Inputs ──────────────────────────────────────────────────────────────────

export const JobListQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  function: z.enum(JOB_FUNCTIONS).optional(),
  seniority: z.enum(SENIORITIES).optional(),
  type: z.enum(EMPLOYMENT_TYPES).optional(),
  workplace: z.enum(WORKPLACES).optional(),
  country: countryCode.optional(),
  company: z.string().optional(),
  cursor: z.string().optional(),
});

export const CursorQuerySchema = z.object({ cursor: z.string().optional() });
export const IdParamsSchema = z.object({ id: z.string().min(1).max(40) });
export const SlugParamsSchema = z.object({ slug: z.string().min(1).max(100) });
export const HandleParamsSchema = z.object({ handle: z.string().min(1).max(40) });

const optionalUrl = z.string().url().max(500);

export const CompanyInputSchema = registry.register(
  "CompanyInput",
  z.object({
    name: z.string().trim().min(2).max(80),
    logoUrl: optionalUrl.optional(),
    coverUrl: optionalUrl.optional(),
    website: optionalUrl.optional(),
    about: z.string().max(4000).optional(),
    segment: z.enum(COMPANY_SEGMENTS).optional(),
    sizeRange: z.enum(COMPANY_SIZES).optional(),
    hq: z.object({ city: z.string().max(80).optional(), countryCode: countryCode.optional() }).optional(),
    /** Platform admins creating a company on a brand's behalf name its first owner here. */
    ownerHandle: z.string().max(40).optional(),
  }),
);
export const CompanyUpdateSchema = registry.register("CompanyUpdate", CompanyInputSchema.omit({ ownerHandle: true }).partial());

export const MemberInputSchema = registry.register(
  "MemberInput",
  z.object({ handle: z.string().min(1).max(40), role: z.enum(["admin", "recruiter"]) }),
);

const JobFieldsSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(20).max(12000),
  function: z.enum(JOB_FUNCTIONS),
  seniority: z.enum(SENIORITIES),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  workplace: z.enum(WORKPLACES),
  location: z.object({ city: z.string().max(80).optional(), countryCode: countryCode.optional() }).optional(),
  salary: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().length(3).optional(),
      period: z.enum(SALARY_PERIODS).optional(),
      visible: z.boolean().optional(),
    })
    .optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
  applyMode: z.enum(["internal", "external"]).optional(),
  externalApplyUrl: optionalUrl.optional(),
  screeningQuestions: z
    .array(z.object({ prompt: z.string().trim().min(3).max(300), required: z.boolean().optional() }))
    .max(5)
    .optional(),
});

export const JobInputSchema = registry.register("JobInput", JobFieldsSchema);
export const JobUpdateSchema = registry.register("JobUpdate", JobFieldsSchema.partial());

export const RejectInputSchema = registry.register(
  "RejectInput",
  z.object({ reason: z.string().trim().min(3).max(300) }),
);

export const ApplyInputSchema = registry.register(
  "ApplyInput",
  z.object({
    coverNote: z.string().max(4000).optional(),
    portfolioUrl: optionalUrl.optional(),
    answers: z.array(z.object({ questionId: z.string(), answer: z.string().max(2000) })).max(5).optional(),
  }),
);

export const ApplicationUpdateSchema = registry.register(
  "ApplicationUpdate",
  z.object({
    status: z.enum(["viewed", "shortlisted", "rejected", "hired"]).optional(),
    recruiterNotes: z.string().max(4000).optional(),
  }),
);

export const CandidateProfileInputSchema = registry.register(
  "CandidateProfileInput",
  z.object({
    headline: z.string().max(120).optional(),
    location: z.string().max(80).optional(),
    openToWork: z.boolean().optional(),
    visibility: z.enum(PROFILE_VISIBILITIES).optional(),
    desiredFunctions: z.array(z.enum(JOB_FUNCTIONS)).max(6).optional(),
    desiredLocations: z.array(z.string().max(80)).max(6).optional(),
    workplacePrefs: z.array(z.enum(WORKPLACES)).max(3).optional(),
    experience: z.array(ExperienceSchema).max(20).optional(),
    education: z.array(EducationSchema).max(10).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    portfolioUrl: optionalUrl.optional(),
    links: z.array(optionalUrl).max(6).optional(),
  }),
);

export type JobListQuery = z.infer<typeof JobListQuerySchema>;
export type JobInput = z.infer<typeof JobInputSchema>;
export type CompanyInput = z.infer<typeof CompanyInputSchema>;
export type ApplyInput = z.infer<typeof ApplyInputSchema>;
export type CandidateProfileInput = z.infer<typeof CandidateProfileInputSchema>;
