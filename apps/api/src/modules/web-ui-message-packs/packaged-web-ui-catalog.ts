/**
 * Packaged WEB_UI locale catalogs under apps/api/assets.
 *
 * Filename stems retain Registry/Web canonical casing (e.g. zh-Hant.json).
 * Lookup indexes stems by normalizeLanguageRegistryLocaleKey so activation
 * locale keys (e.g. zh-hant) resolve the same identity without allowlists.
 * Never reads apps/web/src at runtime.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeLanguageRegistryLocaleKey, type WebUiMessageTree } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Build-time packaged catalogs under apps/api/assets (never apps/web/src at runtime). */
export const PACKAGED_WEB_UI_CATALOGS_DIR = path.resolve(
  here,
  "../../../assets/packaged-web-ui-catalogs",
);

let catalogsDirForTests: string | null = null;
let indexCache: PackagedCatalogIndex | null = null;

type PackagedCatalogIndex = {
  /** localeKey → unique filename stem (canonical casing on disk). */
  readonly unique: ReadonlyMap<string, string>;
  /** localeKey → colliding stems (2+ files normalize to the same identity). */
  readonly collisions: ReadonlyMap<string, readonly string[]>;
};

export type PackagedWebUiCatalogResolveResult =
  | {
      readonly outcome: "found";
      readonly localeKey: string;
      readonly fileStem: string;
      readonly filePath: string;
    }
  | { readonly outcome: "absent"; readonly localeKey: string }
  | {
      readonly outcome: "collision";
      readonly localeKey: string;
      readonly fileStems: readonly string[];
      readonly detail: string;
    };

function catalogsDir(): string {
  return catalogsDirForTests ?? PACKAGED_WEB_UI_CATALOGS_DIR;
}

/** Test-only — point the loader at a fixture directory. */
export function setPackagedWebUiCatalogsDirForTests(dir: string | null): void {
  catalogsDirForTests = dir;
  indexCache = null;
}

/** Test-only — clear the packaged catalog index cache. */
export function resetPackagedWebUiCatalogIndexForTests(): void {
  indexCache = null;
}

/**
 * Test-only — install a synthetic index (e.g. collision) without relying on
 * case-sensitive filesystem filename variants.
 */
export function setPackagedWebUiCatalogIndexForTests(
  index: {
    readonly unique?: ReadonlyMap<string, string>;
    readonly collisions?: ReadonlyMap<string, readonly string[]>;
  } | null,
): void {
  if (index == null) {
    indexCache = null;
    return;
  }
  indexCache = {
    unique: index.unique ?? new Map(),
    collisions: index.collisions ?? new Map(),
  };
}

function buildIndex(dir: string): PackagedCatalogIndex {
  const byKey = new Map<string, string[]>();
  if (!existsSync(dir)) {
    return { unique: new Map(), collisions: new Map() };
  }
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return { unique: new Map(), collisions: new Map() };
  }
  for (const name of names) {
    const stem = name.slice(0, -".json".length);
    if (!stem) {
      continue;
    }
    const localeKey = normalizeLanguageRegistryLocaleKey(stem);
    if (!localeKey) {
      continue;
    }
    const list = byKey.get(localeKey) ?? [];
    list.push(stem);
    byKey.set(localeKey, list);
  }
  const unique = new Map<string, string>();
  const collisions = new Map<string, readonly string[]>();
  for (const [localeKey, stems] of byKey) {
    const distinct = [...new Set(stems)].sort();
    if (distinct.length === 1) {
      unique.set(localeKey, distinct[0]!);
    } else {
      collisions.set(localeKey, distinct);
    }
  }
  return { unique, collisions };
}

function getIndex(): PackagedCatalogIndex {
  if (!indexCache) {
    indexCache = buildIndex(catalogsDir());
  }
  return indexCache;
}

/**
 * Resolve a packaged catalog file for any Registry/activation locale tag.
 * Uses the same locale-key normalization as activation (`normalizeLanguageRegistryLocaleKey`).
 */
export function resolvePackagedWebUiCatalog(locale: string): PackagedWebUiCatalogResolveResult {
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    return { outcome: "absent", localeKey: "" };
  }
  const index = getIndex();
  const collision = index.collisions.get(localeKey);
  if (collision) {
    return {
      outcome: "collision",
      localeKey,
      fileStems: collision,
      detail: `Packaged WEB_UI catalog collision for locale key "${localeKey}": ${collision
        .map((stem) => `${stem}.json`)
        .join(", ")}. Remove duplicate packaged assets.`,
    };
  }
  const fileStem = index.unique.get(localeKey);
  if (!fileStem) {
    return { outcome: "absent", localeKey };
  }
  const filePath = path.join(catalogsDir(), `${fileStem}.json`);
  if (!existsSync(filePath)) {
    indexCache = null;
    return { outcome: "absent", localeKey };
  }
  return { outcome: "found", localeKey, fileStem, filePath };
}

/**
 * Load a packaged locale WEB_UI message tree when present in API assets.
 * Returns null when absent or when a normalized-filename collision makes the
 * packaged source unusable (call resolvePackagedWebUiCatalog for diagnostics).
 */
export function loadPackagedWebUiCatalog(locale: string): WebUiMessageTree | null {
  const resolved = resolvePackagedWebUiCatalog(locale);
  if (resolved.outcome !== "found") {
    return null;
  }
  try {
    return JSON.parse(readFileSync(resolved.filePath, "utf8")) as WebUiMessageTree;
  } catch {
    return null;
  }
}

export function hasPackagedWebUiCatalog(locale: string): boolean {
  return resolvePackagedWebUiCatalog(locale).outcome === "found";
}
