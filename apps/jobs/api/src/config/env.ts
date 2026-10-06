import "dotenv/config";

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
