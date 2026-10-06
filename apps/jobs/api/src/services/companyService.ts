import type { AuthPayload } from "@centoire/contracts";
import { ApiError } from "@centoire/server-kit";
import { env } from "../config/env.js";
import { Company, CompanyMember, Job, type ICompany } from "../models/index.js";
import { emitPlatformEvent } from "../outbox.js";
import { getUserByHandle, getUserSummaries } from "../platform.js";
import type { CompanyInput } from "../schemas/jobs.js";
import { slugify } from "../utils/slugify.js";
import { getCompanyOr404, getMemberRole, isPlatformAdmin, requireCompanyRole } from "./access.js";
import { serializeCompany, serializeUser } from "./serializers.js";

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

export async function getCompany(slug: string, viewerId?: string) {
  const company = await getCompanyOr404(slug);
  return serializeCompany(company, await getMemberRole(company._id, viewerId));
}

export async function createCompany(user: AuthPayload, input: CompanyInput) {
  const admin = isPlatformAdmin(user);
  if (env.COMPANY_CREATION === "admin_only" && !admin) {
    throw new ApiError(403, "Companies are added by the Centoire team during launch. Contact support to get yours listed.");
  }
  // Admins create companies on behalf of a brand; otherwise the creator owns it.
  let ownerId = user.userId;
  if (input.ownerHandle) {
    if (!admin) throw new ApiError(403, "Only Centoire admins can assign another owner");
    const owner = await getUserByHandle(input.ownerHandle);
    if (!owner) throw new ApiError(404, `No Centoire user with handle @${input.ownerHandle}`);
    ownerId = owner.id;
  }

  const baseSlug = slugify(input.name);
  for (let attempt = 1; attempt <= 8; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    try {
      const company = await Company.create({
        slug,
        name: input.name,
        logoUrl: input.logoUrl,
        coverUrl: input.coverUrl,
        website: input.website,
        about: input.about,
        segment: input.segment ?? "other",
        sizeRange: input.sizeRange,
        hq: input.hq,
        // Admin-created companies are vouched for by the team; self-serve ones await verification.
        verified: admin,
        verifiedAt: admin ? new Date() : undefined,
        verifiedBy: admin ? user.userId : undefined,
        createdBy: user.userId,
      });
      await CompanyMember.create({ companyId: company._id, userId: ownerId, role: "owner", invitedBy: user.userId });
      if (ownerId !== user.userId) {
        await emitPlatformEvent("jobs.company.member_invited", {
          actorId: user.userId,
          recipientId: ownerId,
          companyId: company._id.toString(),
          companyName: company.name,
        });
      }
      return serializeCompany(company, ownerId === user.userId ? "owner" : null);
    } catch (err) {
      if (isDuplicateKey(err)) continue;
      throw err;
    }
  }
  throw new ApiError(409, "A company with this name already exists");
}

export async function updateCompany(user: AuthPayload, slug: string, input: Partial<Omit<CompanyInput, "ownerHandle">>) {
  const company = await getCompanyOr404(slug);
  const role = await requireCompanyRole(company, user, "admin");
  const { name, logoUrl, coverUrl, website, about, segment, sizeRange, hq } = input;
  Object.assign(company, {
    ...(name !== undefined && { name }),
    ...(logoUrl !== undefined && { logoUrl }),
    ...(coverUrl !== undefined && { coverUrl }),
    ...(website !== undefined && { website }),
    ...(about !== undefined && { about }),
    ...(segment !== undefined && { segment }),
    ...(sizeRange !== undefined && { sizeRange }),
    ...(hq !== undefined && { hq }),
  });
  await company.save();
  return serializeCompany(company, role);
}

export async function listMyCompanies(userId: string) {
  const memberships = await CompanyMember.find({ userId });
  const companies = await Company.find({ _id: { $in: memberships.map((m) => m.companyId) } }).sort({ name: 1 });
  const roles = new Map(memberships.map((m) => [m.companyId.toString(), m.role]));
  return companies.map((c) => serializeCompany(c, roles.get(c._id.toString()) ?? null));
}

export async function listAllCompanies() {
  const companies = await Company.find().sort({ createdAt: -1 }).limit(200);
  return companies.map((c) => serializeCompany(c, null));
}

export async function listMembers(user: AuthPayload, slug: string) {
  const company = await getCompanyOr404(slug);
  await requireCompanyRole(company, user, "recruiter");
  const members = await CompanyMember.find({ companyId: company._id }).sort({ createdAt: 1 });
  const users = await getUserSummaries(members.map((m) => m.userId));
  return members.flatMap((m) => {
    const u = users.get(m.userId);
    return u ? [{ user: serializeUser(u), role: m.role }] : [];
  });
}

export async function addMember(user: AuthPayload, slug: string, input: { handle: string; role: "admin" | "recruiter" }) {
  const company = await getCompanyOr404(slug);
  await requireCompanyRole(company, user, "admin");
  const target = await getUserByHandle(input.handle);
  if (!target) throw new ApiError(404, `No Centoire user with handle @${input.handle}`);
  try {
    await CompanyMember.create({ companyId: company._id, userId: target.id, role: input.role, invitedBy: user.userId });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ApiError(409, "This person is already on the hiring team");
    throw err;
  }
  await emitPlatformEvent("jobs.company.member_invited", {
    actorId: user.userId,
    recipientId: target.id,
    companyId: company._id.toString(),
    companyName: company.name,
  });
  return { user: serializeUser(target), role: input.role };
}

export async function removeMember(user: AuthPayload, slug: string, userId: string) {
  const company = await getCompanyOr404(slug);
  await requireCompanyRole(company, user, "admin");
  const member = await CompanyMember.findOne({ companyId: company._id, userId });
  if (!member) return;
  if (member.role === "owner") throw new ApiError(422, "The company owner cannot be removed");
  await member.deleteOne();
}

export async function verifyCompany(user: AuthPayload, slug: string) {
  const company = await getCompanyOr404(slug);
  company.verified = true;
  company.verifiedAt = new Date();
  company.verifiedBy = user.userId;
  await company.save();
  return serializeCompany(company, null);
}

/** openJobCount is derived, never incremented, so it can't drift. */
export async function refreshOpenJobCount(company: ICompany): Promise<void> {
  company.openJobCount = await Job.countDocuments({ companyId: company._id, status: "published" });
  await company.save();
}
