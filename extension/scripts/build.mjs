// Builds the extension into dist/<variant>/.
//   prod : Chrome Web Store build. Centoire production origins only, broad access is an OPTIONAL permission, no pinned key.
//   dev  : + localhost origins, pinned key so the extension id is stable, optional permission (load unpacked in your browser).
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const variant = (process.argv.find((a) => a.startsWith("--variant=")) ?? "--variant=prod").split("=")[1];
if (!["prod", "dev"].includes(variant)) throw new Error(`unknown variant ${variant}`);

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}dist/${variant}`;
const { key } = JSON.parse(readFileSync(`${root}src/dev-key.json`, "utf8"));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

const PROD_ORIGINS = ["https://centoire.com", "https://*.centoire.com"];
const ORIGINS = { prod: PROD_ORIGINS, dev: [...PROD_ORIGINS, "http://localhost:*"] }[variant];

// "https://x.com" -> "https://x.com/*", "http://localhost:*" -> "http://localhost:*/*"
const matches = ORIGINS.map((o) => `${o}/*`);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const common = { bundle: true, target: "chrome110", minify: variant === "prod", define: { __ORIGINS__: JSON.stringify(ORIGINS), __DEBUG__: JSON.stringify(variant !== "prod") }, logLevel: "info" };
await build({ ...common, entryPoints: [`${root}src/background.ts`], outfile: `${out}/background.js`, format: "esm" });
await build({ ...common, entryPoints: [`${root}src/frame.ts`], outfile: `${out}/frame.js`, format: "iife" });
cpSync(`${root}src/frame.html`, `${out}/frame.html`);

const manifest = {
  manifest_version: 3,
  name: "Centoire Reader",
  version: pkg.version,
  description: "Read articles shared on Centoire without leaving Centoire.",
  ...(variant === "prod" ? {} : { key }),
  minimum_chrome_version: "110",
  background: { service_worker: "background.js", type: "module" },
  permissions: ["alarms", "storage"],
  optional_permissions: ["declarativeNetRequestWithHostAccess"],
  optional_host_permissions: ["*://*/*"],
  externally_connectable: { matches },
  web_accessible_resources: [{ resources: ["frame.html", "frame.js"], matches }],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
};
writeFileSync(`${out}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`built ${variant} -> ${out}`);
