import { createPublicKey } from "node:crypto";
import { env } from "../config/env.js";

/** Public half of the session signing key, for mini-app processes to verify tokens offline. */
export function publicJwks(): { keys: Array<Record<string, unknown>> } {
  if (!env.JWT_PUBLIC_KEY) return { keys: [] };
  const jwk = createPublicKey(env.JWT_PUBLIC_KEY).export({ format: "jwk" });
  return { keys: [{ ...jwk, kid: env.JWT_KEY_ID, alg: "RS256", use: "sig" }] };
}
