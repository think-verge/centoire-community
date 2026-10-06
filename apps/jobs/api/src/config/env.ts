import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

dotenv.config();

/**
 * Local dev convenience: borrow the keys that must match core (database cluster, session secret,
 * internal secret) from backend/.env when this app has no value of its own. Never PORT/HOST.
 * Skipped in production, where /etc/centoire-community/jobs-api.env is the source of truth.
 */
if (process.env.NODE_ENV !== "production") {
  const backendEnv = fileURLToPath(new URL("../../../../../backend/.env", import.meta.url));
  if (existsSync(backendEnv)) {
    const shared = dotenv.parse(readFileSync(backendEnv));
    for (const key of ["MONGODB_URI", "JWT_SECRET", "JWT_PUBLIC_KEY", "AI_INTERNAL_SECRET"]) {
      if (process.env[key] === undefined && shared[key]) process.env[key] = shared[key];
    }
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: Number(process.env.PORT ?? 8010),
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
  /** Own logical database: the jobs process never touches the core `centoire` database. */
  JOBS_DB_NAME: process.env.JOBS_DB_NAME ?? "centoire_jobs",
  /** Session verification: HS256 secret (dev) and/or core's JWKS / public key (production, RS256). */
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-me",
  JWT_PUBLIC_KEY: (process.env.JWT_PUBLIC_KEY ?? "").replace(/\\n/g, "\n") || undefined,
  JWKS_URL: process.env.JWKS_URL || undefined,
  /** Core API, for user lookups (x-internal-secret). */
  CORE_API_URL: process.env.CORE_API_URL ?? "http://127.0.0.1:8000",
  AI_INTERNAL_SECRET: process.env.AI_INTERNAL_SECRET ?? "dev-internal-secret",
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGINS ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /** "admin_only" (launch default, invite-first) or "open" (any verified user may create a company). */
  COMPANY_CREATION: process.env.COMPANY_CREATION === "open" ? "open" : "admin_only",
  JOB_TTL_DAYS: Number(process.env.JOB_TTL_DAYS ?? 30),
} as const;

export const isProduction = env.NODE_ENV === "production";
