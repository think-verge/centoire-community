import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
export { z };

export const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({ detail: z.string() }),
);

export const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorResponseSchema } },
});

export const jsonBody = (schema: z.ZodType) => ({
  content: { "application/json": { schema } },
});

export const jsonResponse = (description: string, schema: z.ZodType) => ({
  description,
  content: { "application/json": { schema } },
});
