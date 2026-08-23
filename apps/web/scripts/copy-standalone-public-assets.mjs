/**
 * Pack 10F — Next `output: "standalone"` does not automatically embed `public/`.
 * Copy static assets beside the standalone server so both Docker and native
 * `node apps/web/server.js` runtimes can serve `/data/geography/**` and `/brand/**`.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standaloneWebRoot = path.join(webRoot, ".next/standalone/apps/web");
const publicSrc = path.join(webRoot, "public");
const staticSrc = path.join(webRoot, ".next/static");
const publicDest = path.join(standaloneWebRoot, "public");
const staticDest = path.join(standaloneWebRoot, ".next/static");

function fail(message) {
  console.error(`[copy-standalone-public-assets] ${message}`);
  process.exit(1);
}

if (!existsSync(path.join(webRoot, ".next/standalone"))) {
  fail("missing .next/standalone — run next build first");
}

if (!existsSync(publicSrc)) {
  fail(`missing public directory at ${publicSrc}`);
}

mkdirSync(standaloneWebRoot, { recursive: true });
cpSync(publicSrc, publicDest, { recursive: true });

if (existsSync(staticSrc)) {
  mkdirSync(path.dirname(staticDest), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true });
}

const geographyProbe = path.join(
  publicDest,
  "data/geography/communities/CA/CA-BC.json",
);

if (!existsSync(geographyProbe)) {
  fail(
    `geography asset missing after copy: ${path.relative(webRoot, geographyProbe)}`,
  );
}

console.log(
  `[copy-standalone-public-assets] copied public → ${path.relative(webRoot, publicDest)}`,
);
