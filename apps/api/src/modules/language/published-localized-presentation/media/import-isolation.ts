/**
 * Reset 03 — Media PLP read import guards (extend Reset 02 read isolation).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function collectMediaPlpReadModuleSources(): string {
  const mediaRoot = dirname(fileURLToPath(import.meta.url));
  const plpRoot = join(mediaRoot, "..");
  const allowed = [
    "media/feature-flag.ts",
    "media/instrumentation.ts",
    "media/resolve-media-presentation.ts",
    "media/canonical-trees.ts",
    "resolve-published-presentation.ts",
    "persistence/repository.ts",
    "persistence/memory.store.ts",
    "import-guards.ts",
    "feature-boundary.ts",
    "read.ts",
  ];
  return allowed
    .map((rel) => {
      try {
        return readFileSync(join(plpRoot, rel), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

export function assertMediaPlpReadImportIsolation(): {
  readonly ok: boolean;
  readonly violations: readonly string[];
} {
  const source = collectMediaPlpReadModuleSources();
  const violations: string[] = [];
  const forbidden = [
    /gemini-translation-provider/i,
    /GeminiTranslationProvider/,
    /content-translation-warm-consumer/,
    /content-translation-worker-concurrency/,
    /public-localization-reconciliation/,
    /discoverThinMedia/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) {
      violations.push(String(pattern));
    }
  }
  // Static import edges from resolve-media must not pull build/publisher (provider-adjacent).
  const resolveMedia = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "resolve-media-presentation.ts"),
    "utf8",
  );
  if (/from ["'].*build-adapter|from ["'].*publisher|from ["'].*publication-hook/.test(resolveMedia)) {
    violations.push("resolve-media-imports-build-or-publisher");
  }
  return { ok: violations.length === 0, violations };
}

/** Ensure media package does not contain a full-corpus .toArray() on read modules. */
export function mediaPlpReadModulesAvoidCorpusToArray(): boolean {
  const mediaRoot = dirname(fileURLToPath(import.meta.url));
  const readFiles = [
    "resolve-media-presentation.ts",
    "feature-flag.ts",
    "instrumentation.ts",
    "canonical-trees.ts",
  ];
  for (const file of readFiles) {
    const text = readFileSync(join(mediaRoot, file), "utf8");
    if (/\.toArray\s*\(/.test(text)) {
      return false;
    }
  }
  void readdirSync;
  return true;
}
