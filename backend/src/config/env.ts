import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  HOST: process.env.HOST ?? "127.0.0.1",
  PORT: Number(process.env.PORT ?? 8000),
  MONGODB_URI: required("MONGODB_URI", "mongodb://127.0.0.1:27017/centoire"),
  JWT_SECRET: required("JWT_SECRET", "dev-secret-change-me"),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  /** Every origin allowed to call the API with credentials (main app + mini-app frontends). */
  CLIENT_ORIGINS: (process.env.CLIENT_ORIGINS ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  /** ".centoire.com" in production so mini-app subdomains share the session; unset in dev. */
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN || undefined,
  /** RS256 key pair (PEM, "\n" escaped ok). When set, sessions are RS256 and published via JWKS. */
  JWT_PRIVATE_KEY: (process.env.JWT_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  JWT_PUBLIC_KEY: (process.env.JWT_PUBLIC_KEY ?? "").replace(/\\n/g, "\n"),
  JWT_KEY_ID: process.env.JWT_KEY_ID ?? "centoire-1",
  /** Mini-app database the core polls for outbox events. */
  JOBS_DB_NAME: process.env.JOBS_DB_NAME ?? "centoire_jobs",
  JOBS_PUBLIC_URL: process.env.JOBS_PUBLIC_URL ?? "http://localhost:5174",
  COOKIE_SECURE: process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : process.env.NODE_ENV === "production",
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "uploads",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? "",
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? "",
  MAIL_FROM: process.env.MAIL_FROM ?? "Centoire <no-reply@centoire.local>",
  ENABLE_INGESTION: process.env.ENABLE_INGESTION === "true",
  ENABLE_AI_PROCESSING: process.env.ENABLE_AI_PROCESSING !== "false",
  INGESTION_CRON: process.env.INGESTION_CRON ?? "*/30 * * * *",
  AI_SERVICE_URL: process.env.AI_SERVICE_URL ?? "http://localhost:8001",
  AI_INTERNAL_SECRET: process.env.AI_INTERNAL_SECRET ?? "dev-internal-secret",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
};

export const isProduction = env.NODE_ENV === "production";
