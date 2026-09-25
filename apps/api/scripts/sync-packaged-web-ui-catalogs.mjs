/**
 * Sync packaged WEB_UI locale catalogs from the Web i18n messages tree into
 * apps/api/assets/packaged-web-ui-catalogs for API activation adoption.
 *
 * Universal: copies every *.json present (no locale allowlist).
 * API runtime must never read apps/web/src directly.
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const sourceDir = path.resolve(apiRoot, "../web/src/features/i18n/messages");
const targetDir = path.resolve(apiRoot, "assets/packaged-web-ui-catalogs");

mkdirSync(targetDir, { recursive: true });
const files = readdirSync(sourceDir).filter((name) => name.endsWith(".json"));
for (const name of files) {
  copyFileSync(path.join(sourceDir, name), path.join(targetDir, name));
}
console.log(
  `Synced ${files.length} packaged WEB_UI catalog(s) → ${path.relative(apiRoot, targetDir)}`,
);
