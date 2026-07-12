import type { Request, Response } from "express";
import { env, isProduction } from "../config/env.js";
import * as authService from "../services/authService.js";
import { serializeUser } from "../services/userSerializer.js";
import type { IUser } from "../models/User.js";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setSessionCookie(res: Response, user: IUser): void {
  res.cookie("token", authService.signSessionToken(user), {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

export async function signup(req: Request, res: Response): Promise<void> {
  const user = await authService.signup(req.body);
  setSessionCookie(res, user);
  res.status(201).json(serializeUser(user, { private: true }));
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const user = await authService.login(email, password);
  setSessionCookie(res, user);
  res.json(serializeUser(user, { private: true }));
}

export async function google(req: Request, res: Response): Promise<void> {
  const user = await authService.loginWithGoogle(req.body.idToken);
  setSessionCookie(res, user);
  res.json(serializeUser(user, { private: true }));
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("token");
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.user!.userId);
  res.json(serializeUser(user, { private: true }));
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const user = await authService.verifyEmail(req.body.token);
  setSessionCookie(res, user);
  res.json(serializeUser(user, { private: true }));
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  await authService.resendVerification(req.user!.userId);
  res.status(202).json({ sent: true });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.forgotPassword(req.body.email);
  res.status(202).json({ sent: true });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const user = await authService.resetPassword(req.body.token, req.body.password);
  setSessionCookie(res, user);
  res.json(serializeUser(user, { private: true }));
}

export function googleEnabled(_req: Request, res: Response): void {
  res.json({ enabled: Boolean(env.GOOGLE_CLIENT_ID), clientId: env.GOOGLE_CLIENT_ID || null });
}
