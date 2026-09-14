/**
 * Reset 03E.10 — static import isolation for carousel materializer runner.
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
] as const;

function root(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function assertMediaPlpCarouselMaterializerImportIsolation(): {
  readonly ok: boolean;
  readonly violations: readonly string[];
} {
  const violations: string[] = [];
  for (const name of readdirSync(root()).filter((n) => n.endsWith(".ts"))) {
    if (name === "import-guards.ts") {
      continue;
    }
    let text = "";
    try {
      text = readFileSync(join(root(), name), "utf8");
    } catch {
      continue;
    }
    for (const fragment of FORBIDDEN) {
      if (text.includes(fragment)) {
        violations.push(`${name}:${fragment}`);
      }
    }
    if (/\.toArray\s*\(/.test(text)) {
      violations.push(`${name}:toArray`);
    }
    // No Promise.all fanout of provider work.
    if (/Promise\.all\s*\(/.test(text)) {
      violations.push(`${name}:Promise.all`);
    }
  }
  return { ok: violations.length === 0, violations };
}
