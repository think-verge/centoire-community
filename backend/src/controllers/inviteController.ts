import type { Request, Response } from "express";
import * as inviteService from "../services/inviteService.js";

export async function createInvite(req: Request, res: Response): Promise<void> {
  const invite = await inviteService.createInvite(req.user!.userId, req.body);
  res.status(201).json(invite);
}

export async function listInvites(_req: Request, res: Response): Promise<void> {
  const invites = await inviteService.listInvites();
  res.json({ invites });
}

export async function revokeInvite(req: Request, res: Response): Promise<void> {
  await inviteService.revokeInvite(req.params.id as string);
  res.status(204).end();
}

export async function previewInvite(req: Request, res: Response): Promise<void> {
  const preview = await inviteService.previewInvite(req.params.token as string);
  res.json(preview);
}
