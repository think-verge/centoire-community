import { createErrorHandler, notFoundHandler } from "@centoire/server-kit";
import { isProduction } from "../config/env.js";

export { notFoundHandler };
export const errorHandler = createErrorHandler({ isProduction });
