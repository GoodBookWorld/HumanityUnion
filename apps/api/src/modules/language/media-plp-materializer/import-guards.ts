/**
 * Reset 03B / 03B.2 — static import isolation for Media PLP materializer.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_STATIC = [
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
  "persistence-selection.ts",
  "durability-verify.ts",
  "run-materializer.ts",
  "thin-gemini-prompt.ts",
  "thin-gemini-transport.ts",
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
        // Locale eligibility must resolve canonical Registry locale/aliases.
        // Keep the dependency confined to locale-lookup.ts (not provider/transport).
        if (file === "locale-lookup.ts" && fragment === "language-registry/index") {
          continue;
        }
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
      if (!file.includes("run-materializer")) {
        violations.push(`${file}:write-op`);
      }
    }
  }

  const providerBoundary = readFileSync(join(root(), "provider-boundary.ts"), "utf8");
  if (/from\s+["'][^"']*gemini-translation-provider/.test(providerBoundary)) {
    violations.push("provider-boundary:static-gemini-import");
  }
  if (/import\s*\(\s*["'][^"']*gemini-translation-provider/.test(providerBoundary)) {
    violations.push("provider-boundary:dynamic-heavy-gemini-import");
  }
  if (/^import\s+.*GeminiTranslationProvider/m.test(providerBoundary)) {
    violations.push("provider-boundary:static-gemini-symbol");
  }
  if (!providerBoundary.includes("createThinMediaPlpProviderFromConfig")) {
    violations.push("provider-boundary:missing-thin-import");
  }
  if (!providerBoundary.includes('PROVIDER_EXECUTION_BOUNDARY = "THIN"') &&
      !providerBoundary.includes("MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY")) {
    violations.push("provider-boundary:missing-thin-boundary-constant");
  }

  const thinTransport = readFileSync(join(root(), "thin-gemini-transport.ts"), "utf8");
  if (thinTransport.includes("language-registry")) {
    violations.push("thin-gemini-transport:language-registry");
  }
  if (thinTransport.includes("gemini-translation-provider")) {
    violations.push("thin-gemini-transport:heavy-provider");
  }

  void readdirSync;
  return { ok: violations.length === 0, violations };
}

/**
 * Reset 03B.2 — prove thin execute provider graph excludes heavy modules.
 * Call with entry = thin-gemini-transport.ts relative to api root.
 */
export function assertThinMediaPlpProviderImportGraph(
  modulePaths: ReadonlySet<string>,
): { readonly ok: boolean; readonly violations: readonly string[] } {
  const forbidden = [
    "gemini-translation-provider",
    "language-registry/index",
    "language-registry.service",
    "public-languages.routes",
    "admin-languages.routes",
    "content-translation-warm-consumer",
    "content-translation-worker",
    "public-localization-reconciliation",
    "public-localization-corpus",
    "content-translation.service",
    "global-search",
    "apps/web",
    "createApp",
    "bootstrap",
  ] as const;
  const violations: string[] = [];
  const joined = [...modulePaths].join("\n");
  for (const fragment of forbidden) {
    if (joined.includes(fragment)) {
      violations.push(fragment);
    }
  }
  return { ok: violations.length === 0, violations };
}
