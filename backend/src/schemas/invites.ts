import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";

const UserRoleEnum = z.enum(["member", "creator", "editor", "admin"]);

export const InvitePreviewSchema = registry.register(
  "InvitePreview",
  z.object({
    email: z.string(),
    role: UserRoleEnum,
    valid: z.boolean(),
  }),
);

export const InviteSchema = registry.register(
  "Invite",
  z.object({
    id: z.string(),
    email: z.string(),
    role: UserRoleEnum,
    status: z.enum(["pending", "accepted", "revoked"]),
    expiresAt: z.string(),
    acceptedAt: z.string().nullable(),
    createdAt: z.string(),
  }),
);

export const CreateInviteInputSchema = registry.register(
  "CreateInviteInput",
  z.object({
    email: z.string().email(),
    role: UserRoleEnum,
  }),
);

export const InviteListSchema = registry.register(
  "InviteList",
  z.object({ invites: z.array(InviteSchema) }),
);

export function registerInvitePaths(): void {
  registry.registerPath({
    method: "post",
    path: "/admin/invites",
    tags: ["admin"],
    operationId: "createInvite",
    request: { body: jsonBody(CreateInviteInputSchema) },
    responses: {
      201: jsonResponse("Invite created and emailed", InviteSchema),
      409: errorResponse("Pending invite already exists for this email"),
    },
  });
  registry.registerPath({
    method: "get",
    path: "/admin/invites",
    tags: ["admin"],
    operationId: "listInvites",
    responses: {
      200: jsonResponse("List of all invites", InviteListSchema),
    },
  });
  registry.registerPath({
    method: "delete",
    path: "/admin/invites/{id}",
    tags: ["admin"],
    operationId: "revokeInvite",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      204: { description: "Invite revoked" },
      404: errorResponse("Invite not found"),
    },
  });
  registry.registerPath({
    method: "get",
    path: "/auth/invite/{token}",
    tags: ["auth"],
    operationId: "getInvitePreview",
    request: { params: z.object({ token: z.string() }) },
    responses: {
      200: jsonResponse("Invite preview (valid field indicates whether it can be used)", InvitePreviewSchema),
    },
  });
}
