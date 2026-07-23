// UX-only permission mirror — NOT the security boundary.
// The authoritative check lives in backend/src/config/permissions.ts.
// These are used only to show/hide nav links and UI elements; the backend
// enforces the real permission check on every request.

export type UserRole = "member" | "creator" | "editor" | "admin";

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

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
