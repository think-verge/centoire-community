import type { Request, Response } from "express";
import * as uploadService from "../services/uploadService.js";
import { ApiError } from "../utils/api-error.js";

export async function uploadImage(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw new ApiError(422, "Attach an image file");
  const result = await uploadService.uploadImage(
    file.buffer,
    file.mimetype,
    req.user!.userId,
  );
  res.status(201).json(result);
}
