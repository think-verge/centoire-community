// Composable env config: <PREFIX>_<KEY> wins over bare <KEY> for shared settings (MONGODB_URI,
// NATS_URL, JWT_SECRET...), so one .env can serve several services in dev.
export function readEnv(
  prefix: string,
  key: string,
  fallback?: string,
  opts: { shared?: boolean } = {},
): string | undefined {
  const p = prefix.toUpperCase().replace(/-/g, "_");
  const shared = opts.shared ?? !SERVICE_LOCAL_KEYS.has(key);
  return process.env[`${p}_${key}`] ?? (shared ? process.env[key] : undefined) ?? fallback;
}

// Per-process settings must never fall back to the bare name: a shared .env (e.g. the
// monolith's PORT=8000) would otherwise make every service try to bind the same port.
const SERVICE_LOCAL_KEYS = new Set(["HOST", "PORT", "PRIVATE_PORT", "ANNOUNCE_ADDRESS"]);

export function requireEnv(prefix: string, key: string): string {
  const v = readEnv(prefix, key);
  if (!v) throw new Error(`Missing required env ${prefix.toUpperCase()}_${key}`);
  return v;
}

export interface ServiceConfig {
  name: string;
  host: string;
  port: number;
  /** Address other services/gateway should use to reach this one. */
  announceAddress: string;
  natsUrl?: string;
  jwtSecret: string;
  internalSecret: string;
  gatewaySecret: string;
  clientOrigin: string;
}

export function loadServiceConfig(name: string, defaults: { port: number }): ServiceConfig {
  const host = readEnv(name, "HOST", "127.0.0.1")!;
  const port = Number(readEnv(name, "PORT", String(defaults.port)));
  return {
    name,
    host,
    port,
    announceAddress: readEnv(name, "ANNOUNCE_ADDRESS", `http://${host}:${port}`)!,
    natsUrl: readEnv(name, "NATS_URL"),
    jwtSecret: readEnv(name, "JWT_SECRET", "dev-secret-change-me")!,
    internalSecret: readEnv(name, "INTERNAL_SECRET", "dev-internal-secret")!,
    gatewaySecret: readEnv(name, "GATEWAY_SECRET", "dev-gateway-secret")!,
    clientOrigin: readEnv(name, "CLIENT_ORIGIN", "http://localhost:5173")!,
  };
}
