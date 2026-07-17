import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { cloudinary, cloudinaryEnabled } from "../config/cloudinary.js";
import { env } from "../config/env.js";

export interface UploadedImage {
  url: string;
  width: number | null;
  height: number | null;
}

const LOCAL_UPLOAD_DIR = resolve(process.cwd(), env.UPLOAD_DIR);

/**
 * Uploads to Cloudinary when configured; otherwise writes to local disk
 * (served at /uploads) so development works without credentials.
 */
export async function uploadImage(
  buffer: Buffer,
  mimetype: string,
  userId: string,
): Promise<UploadedImage> {
  if (cloudinaryEnabled) {
    const result = await new Promise<{ secure_url: string; width: number; height: number }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder: `centoire/${userId}`, resource_type: "image" },
            (error, uploaded) => {
              if (error || !uploaded) reject(error ?? new Error("Upload failed"));
              else resolve(uploaded);
            },
          )
          .end(buffer);
      },
    );
    return { url: result.secure_url, width: result.width, height: result.height };
  }

  const ext = mimetype === "image/png" ? "png" : mimetype === "image/webp" ? "webp" : "jpg";
  const name = `${userId}-${randomBytes(8).toString("hex")}.${ext}`;
  mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  writeFileSync(join(LOCAL_UPLOAD_DIR, name), buffer);
  const base = env.NODE_ENV === "development" ? `http://localhost:${env.PORT}` : "";
  return { url: `${base}/uploads/${name}`, width: null, height: null };
}
