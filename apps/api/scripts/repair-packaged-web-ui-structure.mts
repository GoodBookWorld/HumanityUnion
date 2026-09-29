/**
 * Rebuild representable bundled WEB_UI leaves that fail English structure checks.
 * Writes the Web message source and the packaged API asset. No provider calls.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { WebUiMessageTree } from "@hu/types";

import { repairLocalizedWebUiCatalogTree } from "../src/modules/web-ui-message-packs/web-ui-catalog-structure-repair.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "..");
const sourceDir = path.resolve(apiRoot, "../web/src/features/i18n/messages");
const packagedDir = path.resolve(apiRoot, "assets/packaged-web-ui-catalogs");

type Change = {
  readonly from: string;
  readonly to: string;
};

const english = JSON.parse(readFileSync(path.join(sourceDir, "en.json"), "utf8")) as WebUiMessageTree;
const files = readdirSync(sourceDir).filter((name) => name.endsWith(".json") && name !== "en.json");
let changedFiles = 0;

for (const name of files) {
  const sourcePath = path.join(sourceDir, name);
  const originalText = readFileSync(sourcePath, "utf8");
  const localized = JSON.parse(originalText) as WebUiMessageTree;
  const repaired = repairLocalizedWebUiCatalogTree(english, localized);
  const changes = new Map<string, Change>();
  collectChanges(localized, repaired, "", changes);
  if (changes.size === 0) {
    continue;
  }
  let next = originalText;
  for (const change of changes.values()) {
    const from = JSON.stringify(change.from);
    const to = JSON.stringify(change.to);
    if (!next.includes(from)) {
      throw new Error(`${name} is missing a repairable value`);
    }
    next = next.split(from).join(to);
  }
  writeFileSync(sourcePath, next);
  writeFileSync(path.join(packagedDir, name), next);
  changedFiles += 1;
  console.log(`Repaired ${changes.size} WEB_UI leaf(s) in ${name}`);
}

console.log(`Packaged WEB_UI structure repair finished. Files changed: ${changedFiles}.`);

function collectChanges(
  before: unknown,
  after: unknown,
  prefix: string,
  changes: Map<string, Change>,
): void {
  if (typeof before === "string" && typeof after === "string") {
    if (before !== after) {
      const existing = changes.get(before);
      if (existing && existing.to !== after) {
        throw new Error(`Conflicting repairs for the same localized value at ${prefix}`);
      }
      changes.set(before, { from: before, to: after });
    }
    return;
  }
  if (
    before == null ||
    after == null ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) ||
    Array.isArray(after)
  ) {
    return;
  }
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  for (const [key, beforeValue] of Object.entries(beforeRecord)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    collectChanges(beforeValue, afterRecord[key], pathKey, changes);
  }
}
