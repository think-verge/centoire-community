import { Router, type Request, type Response } from "express";
import { hasPermission } from "@centoire/contracts";
import { ApiError, asyncHandler, validate } from "@centoire/server-kit";
import { optionalAuth, requireAuth, requireVerified } from "../auth.js";
import {
  ApplicationUpdateSchema,
  ApplyInputSchema,
  CandidateProfileInputSchema,
  CompanyInputSchema,
  CompanyUpdateSchema,
  CursorQuerySchema,
  HandleParamsSchema,
  IdParamsSchema,
  JobInputSchema,
  JobListQuerySchema,
  JobUpdateSchema,
  MemberInputSchema,
  RejectInputSchema,
  SlugParamsSchema,
} from "../schemas/jobs.js";
import * as applicationService from "../services/applicationService.js";
import * as companyService from "../services/companyService.js";
import * as jobService from "../services/jobService.js";
import * as profileService from "../services/profileService.js";
import { getTaxonomy } from "../services/taxonomyService.js";

export const jobsRouter = Router();

const id = (req: Request) => req.params.id as string;
const slug = (req: Request) => req.params.slug as string;
const query = <T>(req: Request) => (req.validatedQuery ?? {}) as T;
const noContent = (res: Response) => void res.status(204).end();

jobsRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

// ─── Public ──────────────────────────────────────────────────────────────────
// Static paths (`/meta/taxonomy`) are registered before `/:id` so they are never read as an id.
jobsRouter.get("/meta/taxonomy", (_req, res) => void res.json(getTaxonomy()));
jobsRouter.get(
  "/",
  optionalAuth,
  validate({ query: JobListQuerySchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.listPublic(query(req), req.user))),
);

// ─── Candidate ───────────────────────────────────────────────────────────────
jobsRouter.get("/me/profile", requireAuth, asyncHandler(async (req, res) => void res.json(await profileService.getMine(req.user!))));
jobsRouter.put(
  "/me/profile",
  requireAuth,
  validate({ body: CandidateProfileInputSchema }),
  asyncHandler(async (req, res) => void res.json(await profileService.updateMine(req.user!, req.body))),
);
jobsRouter.get("/me/applications", requireAuth, asyncHandler(async (req, res) => void res.json(await applicationService.listMine(req.user!))));
jobsRouter.get(
  "/me/applications/:id",
  requireAuth,
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await applicationService.getMine(req.user!, id(req)))),
);
jobsRouter.post(
  "/me/applications/:id/withdraw",
  requireAuth,
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => {
    await applicationService.withdraw(req.user!, id(req));
    noContent(res);
  }),
);
jobsRouter.get("/me/saved-jobs", requireAuth, asyncHandler(async (req, res) => void res.json(await jobService.listSaved(req.user!))));
jobsRouter.get("/me/companies", requireAuth, asyncHandler(async (req, res) => void res.json(await companyService.listMyCompanies(req.user!.userId))));
jobsRouter.get(
  "/candidates/:handle",
  optionalAuth,
  validate({ params: HandleParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await profileService.getByHandle(req.params.handle as string, req.user))),
);

// ─── Companies ───────────────────────────────────────────────────────────────
jobsRouter.get(
  "/companies/:slug",
  optionalAuth,
  validate({ params: SlugParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await companyService.getCompany(slug(req), req.user?.userId))),
);
jobsRouter.get(
  "/companies/:slug/jobs",
  optionalAuth,
  validate({ params: SlugParamsSchema, query: CursorQuerySchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.listForCompany(slug(req), query<{ cursor?: string }>(req).cursor, req.user))),
);

// ─── Job actions ─────────────────────────────────────────────────────────────
jobsRouter.get(
  "/:id",
  optionalAuth,
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.getJob(id(req), req.user))),
);
jobsRouter.put(
  "/:id/save",
  requireAuth,
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => {
    await jobService.saveJob(req.user!, id(req));
    noContent(res);
  }),
);
jobsRouter.delete(
  "/:id/save",
  requireAuth,
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => {
    await jobService.unsaveJob(req.user!, id(req));
    noContent(res);
  }),
);
jobsRouter.post(
  "/:id/applications",
  requireAuth,
  requireVerified,
  validate({ params: IdParamsSchema, body: ApplyInputSchema }),
  asyncHandler(async (req, res) => void res.status(201).json(await applicationService.apply(req.user!, id(req), req.body))),
);

// ─── Employer ────────────────────────────────────────────────────────────────
export const employerRouter = Router();
employerRouter.use(requireAuth);

employerRouter.post(
  "/companies",
  requireVerified,
  validate({ body: CompanyInputSchema }),
  asyncHandler(async (req, res) => void res.status(201).json(await companyService.createCompany(req.user!, req.body))),
);
employerRouter.patch(
  "/companies/:slug",
  validate({ params: SlugParamsSchema, body: CompanyUpdateSchema }),
  asyncHandler(async (req, res) => void res.json(await companyService.updateCompany(req.user!, slug(req), req.body))),
);
employerRouter.get(
  "/companies/:slug/members",
  validate({ params: SlugParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await companyService.listMembers(req.user!, slug(req)))),
);
employerRouter.post(
  "/companies/:slug/members",
  validate({ params: SlugParamsSchema, body: MemberInputSchema }),
  asyncHandler(async (req, res) => void res.status(201).json(await companyService.addMember(req.user!, slug(req), req.body))),
);
employerRouter.delete(
  "/companies/:slug/members/:userId",
  asyncHandler(async (req, res) => {
    await companyService.removeMember(req.user!, slug(req), req.params.userId as string);
    noContent(res);
  }),
);
employerRouter.get(
  "/jobs",
  asyncHandler(async (req, res) => void res.json(await jobService.listEmployerJobs(req.user!, req.query as { company?: string; status?: string }))),
);
employerRouter.post(
  "/companies/:slug/jobs",
  validate({ params: SlugParamsSchema, body: JobInputSchema }),
  asyncHandler(async (req, res) => void res.status(201).json(await jobService.createJob(req.user!, slug(req), req.body))),
);
employerRouter.patch(
  "/jobs/:id",
  validate({ params: IdParamsSchema, body: JobUpdateSchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.updateJob(req.user!, id(req), req.body))),
);
employerRouter.post(
  "/jobs/:id/submit",
  requireVerified,
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.submitJob(req.user!, id(req)))),
);
employerRouter.post(
  "/jobs/:id/close",
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.closeJob(req.user!, id(req)))),
);
employerRouter.get(
  "/jobs/:id/applications",
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await applicationService.listForJob(req.user!, id(req)))),
);
employerRouter.get(
  "/applications/:id",
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await applicationService.getForTeam(req.user!, id(req)))),
);
employerRouter.patch(
  "/applications/:id",
  validate({ params: IdParamsSchema, body: ApplicationUpdateSchema }),
  asyncHandler(async (req, res) => void res.json(await applicationService.update(req.user!, id(req), req.body))),
);

// ─── Admin (permission-checked inside the services) ──────────────────────────
export const adminRouter = Router();
adminRouter.use(requireAuth);

adminRouter.get("/jobs/pending", asyncHandler(async (req, res) => void res.json(await jobService.listPending(req.user!))));
adminRouter.post(
  "/jobs/:id/approve",
  validate({ params: IdParamsSchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.approveJob(req.user!, id(req)))),
);
adminRouter.post(
  "/jobs/:id/reject",
  validate({ params: IdParamsSchema, body: RejectInputSchema }),
  asyncHandler(async (req, res) => void res.json(await jobService.rejectJob(req.user!, id(req), req.body.reason))),
);
adminRouter.get(
  "/companies",
  asyncHandler(async (req, res) => {
    requireCompanyAdmin(req);
    res.json(await companyService.listAllCompanies());
  }),
);
adminRouter.post(
  "/companies/:slug/verify",
  validate({ params: SlugParamsSchema }),
  asyncHandler(async (req, res) => {
    requireCompanyAdmin(req);
    res.json(await companyService.verifyCompany(req.user!, slug(req)));
  }),
);


function requireCompanyAdmin(req: Request): void {
  if (!req.user || !hasPermission(req.user.role, "company.verify")) throw new ApiError(403, "Insufficient permissions");
}
