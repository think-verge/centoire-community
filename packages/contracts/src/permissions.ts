import type { UserRole } from "./auth.js";

export type Permission =
  | "post.bypass_queue"
  | "moderation.review"
  | "moderation.manage_policies"
  | "user.invite"
  | "user.promote"
  | "jobs.moderate"
  | "company.verify";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  member: [],
  creator: [],
  editor: [
    "post.bypass_queue",
    "moderation.review",
    "moderation.manage_policies",
    "jobs.moderate",
  ],
  admin: [
    "post.bypass_queue",
    "moderation.review",
    "moderation.manage_policies",
    "user.invite",
    "user.promote",
    "jobs.moderate",
    "company.verify",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
