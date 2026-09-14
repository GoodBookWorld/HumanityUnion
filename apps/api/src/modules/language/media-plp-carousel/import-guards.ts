/**
 * Reset 03E.9 — static import isolation for carousel diagnostic.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN = [
  "gemini-translation-provider",
  "GeminiTranslationProvider",
  "language-registry/index",
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
  "apps/web",
  "global-search",
  "createApp",
  "publishMediaPlpEntity",
  "buildMediaPlpCandidate",
] as const;

function root(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function listMediaPlpCarouselModuleFiles(): readonly string[] {
  return readdirSync(root())
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(root(), name));
}

export function assertMediaPlpCarouselImportIsolation(): {
  readonly ok: boolean;
  readonly violations: readonly string[];
} {
  const violations: string[] = [];
  for (const abs of listMediaPlpCarouselModuleFiles()) {
    if (abs.endsWith("import-guards.ts")) {
      continue;
    }
    let text = "";
    try {
      text = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    for (const fragment of FORBIDDEN) {
      if (text.includes(fragment)) {
        violations.push(`${abs.split("/").pop()}:${fragment}`);
      }
    }
    if (/\.toArray\s*\(/.test(text)) {
      violations.push(`${abs.split("/").pop()}:toArray`);
    }
    if (
      /\.(insertOne|insertMany|updateOne|updateMany|replaceOne|deleteOne|deleteMany|bulkWrite)\s*\(/.test(
        text,
      )
    ) {
      violations.push(`${abs.split("/").pop()}:write-op`);
    }
  }
  return { ok: violations.length === 0, violations };
}
