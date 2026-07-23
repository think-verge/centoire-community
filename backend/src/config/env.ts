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
  INGESTION_CRON: process.env.INGESTION_CRON ?? "*/30 * * * *",
  AI_SERVICE_URL: process.env.AI_SERVICE_URL ?? "http://localhost:8001",
  AI_INTERNAL_SECRET: process.env.AI_INTERNAL_SECRET ?? "dev-internal-secret",
};

export const isProduction = env.NODE_ENV === "production";
