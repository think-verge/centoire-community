import { randomUUID } from "node:crypto";
import os from "node:os";
import type { Bus } from "./bus.js";

export const GATEWAY_SERVICES_SUBJECT = "gateway.services";

export interface RouteInfo {
  /** Absolute path prefix, e.g. /api/v1/notifications. */
  path: string;
  /** Private routes are only exposed on the gateway's internal listener. */
  private?: boolean;
}

export interface ServicePing {
  type: "hello" | "goodbye";
  instanceId: string;
  name: string;
  address: string;
  routes: RouteInfo[];
  load: number;
  sentAt: number;
}

/** Announces this instance to the gateway: hello every `intervalMs`, goodbye on stop. */
export function startRegistration(
  bus: Pick<Bus<any>, "publishRaw">,
  info: { name: string; address: string; routes: () => RouteInfo[] },
  intervalMs = 5000,
): { stop(): void } {
  const instanceId = randomUUID();
  const ping = (type: ServicePing["type"]): ServicePing => ({
    type,
    instanceId,
    name: info.name,
    address: info.address,
    routes: info.routes(),
    load: os.loadavg()[0]! / os.cpus().length,
    sentAt: Date.now(),
  });
  bus.publishRaw(GATEWAY_SERVICES_SUBJECT, ping("hello"));
  const timer = setInterval(() => bus.publishRaw(GATEWAY_SERVICES_SUBJECT, ping("hello")), intervalMs);
  timer.unref();
  return {
    stop() {
      clearInterval(timer);
      bus.publishRaw(GATEWAY_SERVICES_SUBJECT, ping("goodbye"));
    },
  };
}
