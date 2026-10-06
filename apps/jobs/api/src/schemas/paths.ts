import { errorResponse, jsonBody, jsonResponse, registry, z } from "./registry.js";
import {
  ApplicationSchema,
  ApplicationUpdateSchema,
  ApplyInputSchema,
  CandidateProfileInputSchema,
  CandidateProfileSchema,
  CompanyInputSchema,
  CompanyMemberSchema,
  CompanySchema,
  CompanyUpdateSchema,
  CursorQuerySchema,
  HandleParamsSchema,
  IdParamsSchema,
  JobInputSchema,
  JobListQuerySchema,
  JobPageSchema,
  JobSchema,
  JobUpdateSchema,
  MemberInputSchema,
  RejectInputSchema,
  SlugParamsSchema,
  TaxonomySchema,
} from "./jobs.js";

type Method = "get" | "post" | "put" | "patch" | "delete";

interface Route {
  method: Method;
  path: string;
  operationId: string;
  tag: string;
  params?: z.ZodObject<z.ZodRawShape>;
  query?: z.ZodObject<z.ZodRawShape>;
  body?: z.ZodType;
  ok: { status: 200 | 201 | 204; description: string; schema?: z.ZodType };
  errors?: Array<[number, string]>;
}

const AUTH: Array<[number, string]> = [[401, "Not signed in"]];

const routes: Route[] = [
  { method: "get", path: "/jobs/meta/taxonomy", operationId: "getTaxonomy", tag: "meta", ok: { status: 200, description: "Filter options", schema: TaxonomySchema } },
  { method: "get", path: "/jobs", operationId: "listJobs", tag: "jobs", query: JobListQuerySchema, ok: { status: 200, description: "A page of published jobs", schema: JobPageSchema } },
  { method: "get", path: "/jobs/{id}", operationId: "getJob", tag: "jobs", params: IdParamsSchema, ok: { status: 200, description: "Job detail", schema: JobSchema }, errors: [[404, "Job not found"]] },
  { method: "put", path: "/jobs/{id}/save", operationId: "saveJob", tag: "jobs", params: IdParamsSchema, ok: { status: 204, description: "Saved" }, errors: [...AUTH, [404, "Job not found"]] },
  { method: "delete", path: "/jobs/{id}/save", operationId: "unsaveJob", tag: "jobs", params: IdParamsSchema, ok: { status: 204, description: "Removed from saved" }, errors: AUTH },
  { method: "post", path: "/jobs/{id}/applications", operationId: "applyToJob", tag: "applications", params: IdParamsSchema, body: ApplyInputSchema, ok: { status: 201, description: "Application submitted", schema: ApplicationSchema }, errors: [...AUTH, [403, "Email not verified"], [404, "Job not found"], [409, "Already applied"], [422, "Job is not accepting applications"]] },

  { method: "get", path: "/companies/{slug}", operationId: "getCompany", tag: "companies", params: SlugParamsSchema, ok: { status: 200, description: "Company page", schema: CompanySchema }, errors: [[404, "Company not found"]] },
  { method: "get", path: "/companies/{slug}/jobs", operationId: "listCompanyJobs", tag: "companies", params: SlugParamsSchema, query: CursorQuerySchema, ok: { status: 200, description: "Company's open jobs", schema: JobPageSchema }, errors: [[404, "Company not found"]] },

  { method: "get", path: "/me/profile", operationId: "getMyProfile", tag: "candidates", ok: { status: 200, description: "My candidate profile", schema: CandidateProfileSchema }, errors: AUTH },
  { method: "put", path: "/me/profile", operationId: "updateMyProfile", tag: "candidates", body: CandidateProfileInputSchema, ok: { status: 200, description: "Updated profile", schema: CandidateProfileSchema }, errors: [...AUTH, [422, "Invalid input"]] },
  { method: "get", path: "/me/applications", operationId: "listMyApplications", tag: "applications", ok: { status: 200, description: "My applications", schema: z.array(ApplicationSchema) }, errors: AUTH },
  { method: "get", path: "/me/applications/{id}", operationId: "getMyApplication", tag: "applications", params: IdParamsSchema, ok: { status: 200, description: "One of my applications", schema: ApplicationSchema }, errors: [...AUTH, [404, "Application not found"]] },
  { method: "post", path: "/me/applications/{id}/withdraw", operationId: "withdrawApplication", tag: "applications", params: IdParamsSchema, ok: { status: 204, description: "Withdrawn" }, errors: [...AUTH, [404, "Application not found"]] },
  { method: "get", path: "/me/saved-jobs", operationId: "listSavedJobs", tag: "jobs", ok: { status: 200, description: "Saved jobs", schema: z.array(JobSchema) }, errors: AUTH },
  { method: "get", path: "/me/companies", operationId: "listMyCompanies", tag: "companies", ok: { status: 200, description: "Companies I belong to", schema: z.array(CompanySchema) }, errors: AUTH },
  { method: "get", path: "/candidates/{handle}", operationId: "getCandidate", tag: "candidates", params: HandleParamsSchema, ok: { status: 200, description: "Candidate profile", schema: CandidateProfileSchema }, errors: [[403, "Profile is not visible to you"], [404, "Candidate not found"]] },

  { method: "post", path: "/employer/companies", operationId: "createCompany", tag: "employer", body: CompanyInputSchema, ok: { status: 201, description: "Company created", schema: CompanySchema }, errors: [...AUTH, [403, "Not allowed to create companies"], [409, "Company name taken"], [422, "Invalid input"]] },
  { method: "patch", path: "/employer/companies/{slug}", operationId: "updateCompany", tag: "employer", params: SlugParamsSchema, body: CompanyUpdateSchema, ok: { status: 200, description: "Company updated", schema: CompanySchema }, errors: [...AUTH, [403, "Not a company admin"], [404, "Company not found"]] },
  { method: "get", path: "/employer/companies/{slug}/members", operationId: "listCompanyMembers", tag: "employer", params: SlugParamsSchema, ok: { status: 200, description: "Hiring team", schema: z.array(CompanyMemberSchema) }, errors: [...AUTH, [403, "Not a company member"], [404, "Company not found"]] },
  { method: "post", path: "/employer/companies/{slug}/members", operationId: "addCompanyMember", tag: "employer", params: SlugParamsSchema, body: MemberInputSchema, ok: { status: 201, description: "Member added", schema: CompanyMemberSchema }, errors: [...AUTH, [403, "Not a company admin"], [404, "User or company not found"], [409, "Already a member"]] },
  { method: "delete", path: "/employer/companies/{slug}/members/{userId}", operationId: "removeCompanyMember", tag: "employer", params: SlugParamsSchema.extend({ userId: z.string() }), ok: { status: 204, description: "Member removed" }, errors: [...AUTH, [403, "Not a company admin"], [422, "Cannot remove the owner"]] },
  { method: "get", path: "/employer/jobs", operationId: "listEmployerJobs", tag: "employer", query: z.object({ company: z.string().optional(), status: z.string().optional() }), ok: { status: 200, description: "Jobs of my companies", schema: z.array(JobSchema) }, errors: AUTH },
  { method: "post", path: "/employer/companies/{slug}/jobs", operationId: "createJob", tag: "employer", params: SlugParamsSchema, body: JobInputSchema, ok: { status: 201, description: "Draft created", schema: JobSchema }, errors: [...AUTH, [403, "Not a company recruiter"], [404, "Company not found"], [422, "Invalid input"]] },
  { method: "patch", path: "/employer/jobs/{id}", operationId: "updateJob", tag: "employer", params: IdParamsSchema, body: JobUpdateSchema, ok: { status: 200, description: "Job updated", schema: JobSchema }, errors: [...AUTH, [403, "Not a company recruiter"], [404, "Job not found"], [422, "Job cannot be edited"]] },
  { method: "post", path: "/employer/jobs/{id}/submit", operationId: "submitJob", tag: "employer", params: IdParamsSchema, ok: { status: 200, description: "Submitted for review (or published)", schema: JobSchema }, errors: [...AUTH, [403, "Email not verified or not a recruiter"], [404, "Job not found"], [422, "Job is incomplete"]] },
  { method: "post", path: "/employer/jobs/{id}/close", operationId: "closeJob", tag: "employer", params: IdParamsSchema, ok: { status: 200, description: "Job closed", schema: JobSchema }, errors: [...AUTH, [403, "Not a company recruiter"], [404, "Job not found"]] },
  { method: "get", path: "/employer/jobs/{id}/applications", operationId: "listJobApplications", tag: "employer", params: IdParamsSchema, ok: { status: 200, description: "Applicants", schema: z.array(ApplicationSchema) }, errors: [...AUTH, [403, "Not a company recruiter"], [404, "Job not found"]] },
  { method: "get", path: "/employer/applications/{id}", operationId: "getEmployerApplication", tag: "employer", params: IdParamsSchema, ok: { status: 200, description: "Application detail", schema: ApplicationSchema }, errors: [...AUTH, [403, "Not a company recruiter"], [404, "Application not found"]] },
  { method: "patch", path: "/employer/applications/{id}", operationId: "updateApplication", tag: "employer", params: IdParamsSchema, body: ApplicationUpdateSchema, ok: { status: 200, description: "Application updated", schema: ApplicationSchema }, errors: [...AUTH, [403, "Not a company recruiter"], [404, "Application not found"]] },

  { method: "get", path: "/admin/jobs/pending", operationId: "listPendingJobs", tag: "admin", ok: { status: 200, description: "Jobs awaiting review", schema: z.array(JobSchema) }, errors: [...AUTH, [403, "Insufficient permissions"]] },
  { method: "post", path: "/admin/jobs/{id}/approve", operationId: "approveJob", tag: "admin", params: IdParamsSchema, ok: { status: 200, description: "Approved and published", schema: JobSchema }, errors: [...AUTH, [403, "Insufficient permissions"], [404, "Job not found"], [422, "Job is not pending review"]] },
  { method: "post", path: "/admin/jobs/{id}/reject", operationId: "rejectJob", tag: "admin", params: IdParamsSchema, body: RejectInputSchema, ok: { status: 200, description: "Rejected", schema: JobSchema }, errors: [...AUTH, [403, "Insufficient permissions"], [404, "Job not found"], [422, "Job is not pending review"]] },
  { method: "get", path: "/admin/companies", operationId: "listAllCompanies", tag: "admin", ok: { status: 200, description: "All companies, newest first", schema: z.array(CompanySchema) }, errors: [...AUTH, [403, "Insufficient permissions"]] },
  { method: "post", path: "/admin/companies/{slug}/verify", operationId: "verifyCompany", tag: "admin", params: SlugParamsSchema, ok: { status: 200, description: "Company verified", schema: CompanySchema }, errors: [...AUTH, [403, "Insufficient permissions"], [404, "Company not found"]] },
];

export function registerPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/jobs/health",
    tags: ["meta"],
    operationId: "getJobsHealth",
    responses: { 200: jsonResponse("Service is up", z.object({ status: z.string(), uptimeSeconds: z.number() })) },
  });
  for (const r of routes) {
    const responses: Record<number, ReturnType<typeof jsonResponse> | { description: string }> = {
      [r.ok.status]: r.ok.schema ? jsonResponse(r.ok.description, r.ok.schema) : { description: r.ok.description },
    };
    for (const [status, description] of r.errors ?? []) responses[status] = errorResponse(description);
    registry.registerPath({
      method: r.method,
      // Every endpoint lives under /jobs so one nginx rule routes the whole API to this process.
      path: r.path.startsWith("/jobs") ? r.path : `/jobs${r.path}`,
      tags: [r.tag],
      operationId: r.operationId,
      request: {
        ...(r.params ? { params: r.params } : {}),
        ...(r.query ? { query: r.query } : {}),
        ...(r.body ? { body: jsonBody(r.body) } : {}),
      },
      responses,
    });
  }
}
