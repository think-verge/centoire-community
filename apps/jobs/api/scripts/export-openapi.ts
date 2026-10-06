import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registry, registerPaths } from "../src/schemas/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

registerPaths();

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.0.3",
  info: { title: "Centoire Jobs API", version: "0.1.0", description: "Jobs mini-app API" },
  servers: [{ url: "/api/v1" }],
});

const outPath = join(__dirname, "..", "openapi", "openapi.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(document, null, 2));
console.log(`[openapi] wrote ${outPath}`);
