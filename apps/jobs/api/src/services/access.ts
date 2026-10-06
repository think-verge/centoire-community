import { Types } from "mongoose";
import { hasPermission, type AuthPayload } from "@centoire/contracts";
import { ApiError } from "@centoire/server-kit";
import { Company, CompanyMember, type ICompany } from "../models/index.js";
import type { CompanyRole } from "../taxonomy.js";

const RANK: Record<CompanyRole, number> = { recruiter: 1, admin: 2, owner: 3 };

/** Platform admins can manage any company (they verify and seed them at launch). */
export function isPlatformAdmin(user?: AuthPayload): boolean {
  return Boolean(user && hasPermission(user.role, "company.verify"));
}

export async function getMemberRole(companyId: Types.ObjectId | string, userId?: string): Promise<CompanyRole | null> {
  if (!userId) return null;
  const member = await CompanyMember.findOne({ companyId, userId }).select("role");
  return member?.role ?? null;
}

/** Throws unless the user is a member of the company with at least `min` role (or a platform admin). */
export async function requireCompanyRole(
  company: ICompany,
  user: AuthPayload,
  min: CompanyRole,
): Promise<CompanyRole> {
  if (isPlatformAdmin(user)) return "owner";
  const role = await getMemberRole(company._id, user.userId);
  if (!role) throw new ApiError(403, "You are not a member of this company");
  if (RANK[role] < RANK[min]) throw new ApiError(403, "You don't have permission to do this");
  return role;
}

/** Company ids the user can manage jobs for. */
export async function memberCompanyIds(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await CompanyMember.find({ userId }).select("companyId");
  return new Set(rows.map((r) => r.companyId.toString()));
}

export async function getCompanyOr404(slug: string): Promise<ICompany> {
  const company = await Company.findOne({ slug: slug.toLowerCase() });
  if (!company || company.status === "suspended") throw new ApiError(404, "Company not found");
  return company;
}
