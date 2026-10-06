import { createPublicKey, type KeyObject } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { hasPermission, type AuthPayload, type Permission } from "@centoire/contracts";
import { ApiError } from "./api-error.js";
import { readSessionToken } from "./session.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export interface VerifierOptions {
  /** HS256 shared secret (dev, and during the RS256 transition in core). */
  hs256Secret?: string;
  /** Static RS256 public key in PEM form (core verifies its own tokens with this). */
  publicKeyPem?: string;
  /** Core's JWKS endpoint; used by mini-app processes that only hold public keys. */
  jwksUrl?: string;
  /** How long fetched JWKS keys are cached. */
  jwksTtlMs?: number;
}

export type TokenVerifier = (token: string) => Promise<AuthPayload>;

interface Jwk {
  kid?: string;
  [k: string]: unknown;
}

/** Verifies session JWTs signed with HS256 or RS256 (the latter via PEM or remote JWKS). */
export function createTokenVerifier(options: VerifierOptions): TokenVerifier {
  const ttl = options.jwksTtlMs ?? 10 * 60 * 1000;
  const staticKey: KeyObject | undefined = options.publicKeyPem
    ? createPublicKey(options.publicKeyPem)
    : undefined;
  let jwksKeys = new Map<string, KeyObject>();
  let fetchedAt = 0;
  let inflight: Promise<void> | null = null;

  async function refreshJwks(): Promise<void> {
    if (!options.jwksUrl) return;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await fetch(options.jwksUrl as string);
        if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
        const body = (await res.json()) as { keys?: Jwk[] };
        const next = new Map<string, KeyObject>();
        for (const jwk of body.keys ?? []) {
          next.set(jwk.kid ?? "", createPublicKey({ key: jwk as never, format: "jwk" }));
        }
        jwksKeys = next;
        fetchedAt = Date.now();
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  async function rsaKey(kid: string | undefined): Promise<KeyObject | undefined> {
    if (staticKey) return staticKey;
    if (!options.jwksUrl) return undefined;
    const stale = Date.now() - fetchedAt > ttl;
    if (stale || !jwksKeys.has(kid ?? "")) {
      // Unknown kid triggers at most one refetch per TTL window per miss burst.
      if (stale || Date.now() - fetchedAt > 5_000) await refreshJwks().catch(() => undefined);
    }
    return jwksKeys.get(kid ?? "") ?? (jwksKeys.size === 1 ? [...jwksKeys.values()][0] : undefined);
  }

  return async (token) => {
    try {
      const decoded = jwt.decode(token, { complete: true });
      const alg = decoded?.header.alg;
      if (alg === "HS256" && options.hs256Secret) {
        return jwt.verify(token, options.hs256Secret, { algorithms: ["HS256"] }) as AuthPayload;
      }
      if (alg === "RS256") {
        const key = await rsaKey(decoded?.header.kid);
        if (key) return jwt.verify(token, key, { algorithms: ["RS256"] }) as AuthPayload;
      }
    } catch {
      // fall through to the generic 401
    }
    throw new ApiError(401, "Invalid or expired session");
  };
}

export function createAuthMiddleware(verify: TokenVerifier) {
  async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = readSessionToken(req);
    if (!token) throw new ApiError(401, "Authentication required");
    req.user = await verify(token);
    next();
  }

  async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = readSessionToken(req);
    if (token) {
      try {
        req.user = await verify(token);
      } catch {
        // invalid token on an optional route: treat as logged out
      }
    }
    next();
  }

  function requirePermission(permission: Permission) {
    return (req: Request, _res: Response, next: NextFunction): void => {
      if (!req.user) throw new ApiError(401, "Authentication required");
      if (!hasPermission(req.user.role, permission)) {
        throw new ApiError(403, "Insufficient permissions");
      }
      next();
    };
  }

  return { requireAuth, optionalAuth, requirePermission };
}
