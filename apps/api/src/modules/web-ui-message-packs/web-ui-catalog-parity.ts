/**
 * WEB source catalogs and API packaged catalogs must carry the same leaves.
 *
 * English WEB (`apps/web/src/features/i18n/messages/en.json`) is the canonical
 * key set. Every other locale file in that directory must have exactly those
 * keys. Each packaged file in `apps/api/assets/packaged-web-ui-catalogs` must
 * match the WEB file of the same locale, path for path and value for value.
 *
 * Locale files are discovered from the directories. There is no locale allowlist.
 * Published Production packs are not compared here: a published pack may keep
 * an approved wording that differs from the packaged catalog.
 *
 * After adding an interface key, copy the WEB catalogs with the copy step in
 * `apps/api/scripts/sync-packaged-web-ui-catalogs.mjs`, then run
 * `pnpm --filter @hu/api check:web-ui-candidate-catalogs` or the parity test.
 * The structure-repair pass in that script rewrites source leaves and is not
 * part of key alignment.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type WebUiCatalogParityKind =
  | "missing-web-file"
  | "missing-packaged-file"
  | "missing-key"
  | "extra-key"
  | "value-mismatch";

export interface WebUiCatalogParityDiscrepancy {
  readonly locale: string;
  readonly path: string;
  readonly kind: WebUiCatalogParityKind;
  readonly detail: string;
}

export interface WebUiCatalogParityReport {
  readonly ok: boolean;
  readonly discrepancies: readonly WebUiCatalogParityDiscrepancy[];
}

export function flattenWebUiCatalogLeaves(tree: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: unknown, prefix: string): void => {
    if (typeof node === "string") {
      out.set(prefix, node);
      return;
    }
    if (node != null && typeof node === "object" && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, prefix ? `${prefix}.${key}` : key);
      }
    }
  };
  walk(tree, "");
  return out;
}

function readTree(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
}

function localeFiles(directory: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const name of readdirSync(directory)) {
    if (!name.endsWith(".json")) continue;
    files.set(name.slice(0, -".json".length), path.join(directory, name));
  }
  return files;
}

function push(
  discrepancies: WebUiCatalogParityDiscrepancy[],
  discrepancy: WebUiCatalogParityDiscrepancy,
): void {
  discrepancies.push(discrepancy);
}

/**
 * Compare WEB message catalogs with API packaged catalogs.
 * `en.json` in the WEB directory defines the canonical key set.
 */
export function compareWebUiCatalogParity(input: {
  readonly webMessagesDir: string;
  readonly packagedDir: string;
}): WebUiCatalogParityReport {
  const discrepancies: WebUiCatalogParityDiscrepancy[] = [];
  const webFiles = localeFiles(input.webMessagesDir);
  const packagedFiles = localeFiles(input.packagedDir);
  const englishPath = webFiles.get("en");
  if (!englishPath) {
    push(discrepancies, {
      locale: "en",
      path: "",
      kind: "missing-web-file",
      detail: "Canonical English WEB catalog en.json is missing.",
    });
    return { ok: false, discrepancies };
  }
  const english = flattenWebUiCatalogLeaves(readTree(englishPath));
  const locales = new Set([...webFiles.keys(), ...packagedFiles.keys()]);

  for (const locale of [...locales].sort()) {
    const webPath = webFiles.get(locale);
    const packagedPath = packagedFiles.get(locale);
    if (!webPath) {
      push(discrepancies, {
        locale,
        path: "",
        kind: "missing-web-file",
        detail: `Packaged catalog ${locale}.json has no WEB source file.`,
      });
      continue;
    }
    if (!packagedPath) {
      push(discrepancies, {
        locale,
        path: "",
        kind: "missing-packaged-file",
        detail: `WEB catalog ${locale}.json has no packaged API file.`,
      });
      continue;
    }
    const web = flattenWebUiCatalogLeaves(readTree(webPath));
    const packaged = flattenWebUiCatalogLeaves(readTree(packagedPath));
    for (const key of english.keys()) {
      if (!web.has(key)) {
        push(discrepancies, {
          locale,
          path: key,
          kind: "missing-key",
          detail: `WEB catalog ${locale}.json is missing canonical key ${key}.`,
        });
      }
    }
    for (const key of web.keys()) {
      if (!english.has(key)) {
        push(discrepancies, {
          locale,
          path: key,
          kind: "extra-key",
          detail: `WEB catalog ${locale}.json has key ${key}, which is absent from English WEB.`,
        });
      }
    }
    for (const key of web.keys()) {
      if (!packaged.has(key)) {
        push(discrepancies, {
          locale,
          path: key,
          kind: "missing-key",
          detail: `Packaged catalog ${locale}.json is missing WEB key ${key}.`,
        });
      }
    }
    for (const key of packaged.keys()) {
      if (!web.has(key)) {
        push(discrepancies, {
          locale,
          path: key,
          kind: "extra-key",
          detail: `Packaged catalog ${locale}.json has key ${key}, which is absent from WEB.`,
        });
      } else if (packaged.get(key) !== web.get(key)) {
        push(discrepancies, {
          locale,
          path: key,
          kind: "value-mismatch",
          detail: `Packaged value for ${locale} ${key} does not match the WEB catalog.`,
        });
      }
    }
  }

  return { ok: discrepancies.length === 0, discrepancies };
}

export function formatWebUiCatalogParityReport(report: WebUiCatalogParityReport): string {
  if (report.ok) {
    return "WEB/API catalog parity: PASS";
  }
  const lines = report.discrepancies.map(
    (item) => `${item.locale}\t${item.path}\t${item.kind}\t${item.detail}`,
  );
  return `WEB/API catalog parity: FAIL (${report.discrepancies.length})\n${lines.join("\n")}`;
}
