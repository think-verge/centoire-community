import { registry, z, jsonResponse } from "./registry.js";

export const HealthSchema = registry.register(
  "Health",
  z.object({
    status: z.literal("ok"),
    uptimeSeconds: z.number(),
  }),
);

export function registerHealthPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/health",
    tags: ["health"],
    operationId: "getHealth",
    responses: {
      200: jsonResponse("Service health", HealthSchema),
    },
  });
}
