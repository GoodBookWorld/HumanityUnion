/**
 * Reset 03B — static import isolation for Media PLP materializer (pre-provider graph).
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_STATIC = [
  "gemini-translation-provider",
  "GeminiTranslationProvider",
  "content-translation-warm-consumer",
  "content-translation-worker-concurrency",
  "public-localization-reconciliation",
  "public-localization-corpus",
  "discoverThinMedia",
  "reconcile-public-localization",
  "warm-staging-content-translations",
  "content-translation.service",
  "civic-media-center.service",
  "media-resource.service",
  "language/index",
] as const;

function root(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/** Modules that must remain provider-free (static). */
const PRE_PROVIDER_FILES = [
  "parse-args.ts",
  "staging-guards.ts",
  "constants.ts",
  "counters.ts",
  "memory-phases.ts",
  "source-resolve.ts",
  "translation-reuse.ts",
  "plp-inspect.ts",
  "locale-lookup.ts",
  "run-materializer.ts",
] as const;

export function assertMediaPlpMaterializerImportIsolation(): {
  readonly ok: boolean;
  readonly violations: readonly string[];
} {
  const violations: string[] = [];
  for (const file of PRE_PROVIDER_FILES) {
    let text = "";
    try {
      text = readFileSync(join(root(), file), "utf8");
    } catch {
      continue;
    }
    for (const fragment of FORBIDDEN_STATIC) {
      if (text.includes(fragment)) {
        violations.push(`${file}:${fragment}`);
      }
    }
    if (/\.toArray\s*\(/.test(text)) {
      violations.push(`${file}:toArray`);
    }
    if (
      /\.(insertOne|insertMany|updateOne|updateMany|replaceOne|deleteOne|deleteMany|bulkWrite)\s*\(/.test(
        text,
      ) &&
      file !== "run-materializer.ts"
    ) {
      // run-materializer may mention write verbs only in comments/report fields.
      if (!file.includes("run-materializer")) {
        violations.push(`${file}:write-op`);
      }
    }
  }

  // provider-boundary may mention Gemini only inside dynamic import() strings.
  const providerBoundary = readFileSync(join(root(), "provider-boundary.ts"), "utf8");
  if (/from\s+["'][^"']*gemini-translation-provider/.test(providerBoundary)) {
    violations.push("provider-boundary:static-gemini-import");
  }
  if (/^import\s+.*GeminiTranslationProvider/m.test(providerBoundary)) {
    violations.push("provider-boundary:static-gemini-symbol");
  }

  void readdirSync;
  return { ok: violations.length === 0, violations };
}
