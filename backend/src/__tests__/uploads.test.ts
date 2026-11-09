import { readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { uploadImage } from "../services/uploadService.js";

describe("uploadService", () => {
  afterAll(() => {
    try {
      const uploadDir = resolve(process.cwd(), env.UPLOAD_DIR);
      const files = readdirSync(uploadDir);
      for (const f of files) {
        if (f.startsWith("testuser123-")) {
          unlinkSync(join(uploadDir, f));
        }
      }
    } catch {
      // ignore
    }
  });
  it("saves image buffer and returns file url with image extension", async () => {
    const dummyBuffer = Buffer.from("fake-image-bytes");
    const result = await uploadImage(dummyBuffer, "image/jpeg", "testuser123");
    expect(result.url).toMatch(/\/uploads\/testuser123-[a-f0-9]+\.jpg$/);
  });

  it("saves png and webp with correct extension", async () => {
    const dummyBuffer = Buffer.from("fake-png-bytes");
    const pngResult = await uploadImage(dummyBuffer, "image/png", "testuser123");
    expect(pngResult.url).toMatch(/\/uploads\/testuser123-[a-f0-9]+\.png$/);

    const webpResult = await uploadImage(dummyBuffer, "image/webp", "testuser123");
    expect(webpResult.url).toMatch(/\/uploads\/testuser123-[a-f0-9]+\.webp$/);
  });

  it("saves video buffer and returns file url with mp4 or webm extension", async () => {
    const dummyBuffer = Buffer.from("fake-video-bytes");
    const mp4Result = await uploadImage(dummyBuffer, "video/mp4", "testuser123");
    expect(mp4Result.url).toMatch(/\/uploads\/testuser123-[a-f0-9]+\.mp4$/);

    const webmResult = await uploadImage(dummyBuffer, "video/webm", "testuser123");
    expect(webmResult.url).toMatch(/\/uploads\/testuser123-[a-f0-9]+\.webm$/);
  });
});
