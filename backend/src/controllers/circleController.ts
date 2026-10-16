import type { Request, Response } from "express";
import * as circleService from "../services/circleService.js";
import * as feedService from "../services/feedService.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = (req.validatedQuery ?? {}) as { q?: string; hashtag?: string; limit?: number };
  res.json(await circleService.listCircles(query, req.user?.userId));
}

export async function getBySlug(req: Request, res: Response): Promise<void> {
  const inviteToken =
    (req.query.invite as string) ||
    (req.headers["x-invite-token"] as string) ||
    undefined;
  const circle = await circleService.getBySlug(
    req.params.slug as string,
    req.user?.userId,
    inviteToken,
  );
  const viewerRole = await circleService.getViewerRole(
    circle._id.toString(),
    req.user?.userId,
  );
  res.json(circleService.serializeCircle(circle, viewerRole));
}

export async function create(req: Request, res: Response): Promise<void> {
  const circle = await circleService.createCircle(req.user!.userId, req.body);
  res.status(201).json(circleService.serializeCircle(circle, "owner"));
}

export async function join(req: Request, res: Response): Promise<void> {
  const inviteToken =
    (req.body?.inviteToken as string) ||
    (req.query.invite as string) ||
    (req.headers["x-invite-token"] as string) ||
    undefined;
  const circle = await circleService.getBySlug(
    req.params.slug as string,
    req.user?.userId,
    inviteToken,
  );
  await circleService.joinCircle(circle._id.toString(), req.user!.userId, inviteToken);
  res.status(204).end();
}

export async function leave(req: Request, res: Response): Promise<void> {
  const circle = await circleService.getBySlug(req.params.slug as string, req.user?.userId);
  await circleService.leaveCircle(circle._id.toString(), req.user!.userId);
  res.status(204).end();
}

export async function posts(req: Request, res: Response): Promise<void> {
  const { cursor } = (req.validatedQuery ?? {}) as { cursor?: string };
  const inviteToken =
    (req.query.invite as string) ||
    (req.headers["x-invite-token"] as string) ||
    undefined;
  const circle = await circleService.getBySlug(
    req.params.slug as string,
    req.user?.userId,
    inviteToken,
  );
  res.json(await feedService.circleFeed(circle._id, cursor, req.user?.userId));
}

export async function members(req: Request, res: Response): Promise<void> {
  const inviteToken =
    (req.query.invite as string) ||
    (req.headers["x-invite-token"] as string) ||
    undefined;
  const circle = await circleService.getBySlug(
    req.params.slug as string,
    req.user?.userId,
    inviteToken,
  );
  res.json(await circleService.listMembers(circle._id));
}

export async function createInvite(req: Request, res: Response): Promise<void> {
  const result = await circleService.createCircleInvite(
    req.params.slug as string,
    req.user!.userId,
    req.body.email as string,
  );
  res.status(201).json(result);
}

export async function previewInvite(req: Request, res: Response): Promise<void> {
  const result = await circleService.previewCircleInvite(req.params.token as string);
  res.json(result);
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const result = await circleService.acceptCircleInvite(
    req.params.token as string,
    req.user!.userId,
  );
  res.json(result);
}
