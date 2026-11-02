import { claimsToHeaders, HDR_INTERNAL_SECRET, type Claims } from "./auth.js";

export interface ServiceClientOptions {
  /** Internal gateway base URL, e.g. http://127.0.0.1:8001 */
  baseUrl: string;
  internalSecret: string;
  caller: string;
  apiPrefix?: string;
}

/** Service-to-service HTTP through the internal gateway, with claims propagation. */
export class ServiceClient {
  constructor(private opts: ServiceClientOptions) {}

  async request<T = unknown>(
    method: string,
    path: string,
    o: { body?: unknown; claims?: Claims; query?: Record<string, string> } = {},
  ): Promise<T> {
    const url = new URL(`${this.opts.baseUrl}${this.opts.apiPrefix ?? "/api/v1"}${path}`);
    for (const [k, v] of Object.entries(o.query ?? {})) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        [HDR_INTERNAL_SECRET]: this.opts.internalSecret,
        "x-internal-caller": this.opts.caller,
        ...(o.claims ? claimsToHeaders(o.claims) : {}),
      },
      body: o.body === undefined ? undefined : JSON.stringify(o.body),
    });
    if (!res.ok) {
      const detail = await res.json().then((j) => (j as { detail?: string }).detail).catch(() => undefined);
      throw new Error(`${method} ${path} -> ${res.status}${detail ? `: ${detail}` : ""}`);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
}
