import "dotenv/config";
import { createBus, GATEWAY_SERVICES_SUBJECT, loadServiceConfig, readEnv, type ServicePing } from "@centoire/bahamut";
import { buildPrivateListener, buildPublicListener } from "./gateway.js";
import { RouteTable } from "./routeTable.js";

const cfg = loadServiceConfig("gateway", { port: 8100 });
const privatePort = Number(readEnv("gateway", "PRIVATE_PORT", "8101"));

// Prefixes owned by extracted services; they 503 when their owner is down rather than falling back to core.
const reserved = (readEnv("gateway", "RESERVED", "/api/v1/notifications,/api/v1/search")!)
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const url = cfg.natsUrl ?? "nats://127.0.0.1:4222";
const bus = await createBus({ service: "gateway", url });
const table = new RouteTable();
bus.subscribeRaw(GATEWAY_SERVICES_SUBJECT, (msg) => table.apply(msg as ServicePing));

buildPublicListener(table, cfg, reserved).listen(cfg.port, cfg.host, () =>
  console.log(`[gateway] public  listening on ${cfg.host}:${cfg.port}`),
);
buildPrivateListener(table, cfg, reserved).listen(privatePort, cfg.host, () =>
  console.log(`[gateway] private listening on ${cfg.host}:${privatePort}`),
);

process.once("SIGINT", async () => {
  await bus.close();
  process.exit(0);
});
