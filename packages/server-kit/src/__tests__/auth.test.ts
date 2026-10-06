import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTokenVerifier } from "../auth.js";

const claims = { userId: "u1", email: "a@b.co", role: "member" as const };
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privatePem = rsa.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicPem = rsa.publicKey.export({ type: "spki", format: "pem" }).toString();

afterEach(() => vi.unstubAllGlobals());

describe("createTokenVerifier", () => {
  it("accepts HS256 tokens signed with the shared secret", async () => {
    const verify = createTokenVerifier({ hs256Secret: "s3cret" });
    const token = jwt.sign(claims, "s3cret", { expiresIn: "1h" });
    await expect(verify(token)).resolves.toMatchObject(claims);
  });

  it("rejects a wrong secret, an expired token and garbage with a 401", async () => {
    const verify = createTokenVerifier({ hs256Secret: "s3cret" });
    const bad = [
      jwt.sign(claims, "other"),
      jwt.sign(claims, "s3cret", { expiresIn: -10 }),
      "not-a-jwt",
    ];
    for (const token of bad) {
      await expect(verify(token)).rejects.toMatchObject({ statusCode: 401 });
    }
  });

  it("refuses an HS256 token when only a public key is configured (no algorithm confusion)", async () => {
    // An attacker signing HS256 with the *public key text* as the secret must not pass.
    const verify = createTokenVerifier({ publicKeyPem: publicPem });
    const forged = jwt.sign(claims, publicPem, { algorithm: "HS256" });
    await expect(verify(forged)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("accepts RS256 tokens against a static public key", async () => {
    const verify = createTokenVerifier({ publicKeyPem: publicPem });
    const token = jwt.sign(claims, privatePem, { algorithm: "RS256", keyid: "k1" });
    await expect(verify(token)).resolves.toMatchObject(claims);
  });

  it("verifies RS256 via JWKS and refetches once for an unknown kid", async () => {
    const jwk = { ...rsa.publicKey.export({ format: "jwk" }), kid: "k2", alg: "RS256", use: "sig" };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] })));
    vi.stubGlobal("fetch", fetchMock);
    const verify = createTokenVerifier({ jwksUrl: "http://core/jwks" });
    const token = jwt.sign(claims, privatePem, { algorithm: "RS256", keyid: "k2" });
    await expect(verify(token)).resolves.toMatchObject(claims);
    await expect(verify(token)).resolves.toMatchObject(claims);
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached after the first fetch
  });

  it("fails closed when the JWKS endpoint is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const verify = createTokenVerifier({ jwksUrl: "http://core/jwks" });
    const token = jwt.sign(claims, privatePem, { algorithm: "RS256", keyid: "k3" });
    await expect(verify(token)).rejects.toMatchObject({ statusCode: 401 });
  });
});
