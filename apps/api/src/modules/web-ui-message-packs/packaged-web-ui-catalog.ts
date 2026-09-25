import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { WebUiMessageTree } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Build-time packaged catalogs under apps/api/assets (never apps/web/src at runtime). */
export const PACKAGED_WEB_UI_CATALOGS_DIR = path.resolve(
  here,
  "../../../assets/packaged-web-ui-catalogs",
);

function packagedCatalogPath(locale: string): string {
  return path.join(PACKAGED_WEB_UI_CATALOGS_DIR, `${locale}.json`);
}

/**
 * Load a packaged locale WEB_UI message tree when present in API assets.
 * Returns null when no packaged file exists for the locale (universal; no allowlist).
 */
export function loadPackagedWebUiCatalog(locale: string): WebUiMessageTree | null {
  const filePath = packagedCatalogPath(locale);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as WebUiMessageTree;
  } catch {
    return null;
  }
}

export function hasPackagedWebUiCatalog(locale: string): boolean {
  return existsSync(packagedCatalogPath(locale));
}
