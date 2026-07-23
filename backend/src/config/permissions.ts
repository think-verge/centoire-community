import type { UserRole } from "../models/User.js";

export type Permission =
  | "post.bypass_queue"
  | "moderation.review"
  | "moderation.manage_policies"
  | "user.invite"
  | "user.promote";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  member: [],
  creator: ["post.bypass_queue"],
  editor: ["post.bypass_queue", "moderation.review", "moderation.manage_policies"],
  admin: [
    "post.bypass_queue",
    "moderation.review",
    "moderation.manage_policies",
    "user.invite",
    "user.promote",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
