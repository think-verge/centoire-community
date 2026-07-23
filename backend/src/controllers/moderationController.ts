import type { Request, Response } from "express";
import * as moderationService from "../services/moderationService.js";
import * as policyService from "../services/policyService.js";
import { serializePostCard } from "../services/postSerializer.js";

// Queue
export async function listQueue(req: Request, res: Response): Promise<void> {
  const cursor = req.query.cursor as string | undefined;
  const page = await moderationService.listQueue(cursor);
  res.json({
    items: page.items.map((p) => serializePostCard(p)),
    nextCursor: page.nextCursor,
  });
}

export async function approvePost(req: Request, res: Response): Promise<void> {
  const post = await moderationService.approve(req.user!.userId, req.params.id);
  res.json(serializePostCard(post));
}

export async function rejectPost(req: Request, res: Response): Promise<void> {
  const post = await moderationService.reject(req.user!.userId, req.params.id, req.body.reason);
  res.json(serializePostCard(post));
}

// Policies
export async function listPolicies(_req: Request, res: Response): Promise<void> {
  const policies = await policyService.listPolicies();
  res.json({ policies });
}

export async function createPolicy(req: Request, res: Response): Promise<void> {
  const policy = await policyService.createPolicy(req.user!.userId, req.body);
  res.status(201).json(policy);
}

export async function updatePolicy(req: Request, res: Response): Promise<void> {
  const policy = await policyService.updatePolicy(req.params.id, req.body);
  res.json(policy);
}

export async function deletePolicy(req: Request, res: Response): Promise<void> {
  await policyService.deletePolicy(req.params.id);
  res.status(204).end();
}
