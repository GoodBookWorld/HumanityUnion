/**
 * Reset 03A — static import-boundary proof for Media PLP preflight modules.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_SOURCE_PATTERNS: readonly RegExp[] = [
  /gemini-translation-provider/i,
  /GeminiTranslationProvider/,
  /content-translation-warm-consumer/,
  /content-translation-worker-concurrency/,
  /public-localization-reconciliation/,
  /public-localization-corpus/,
  /discoverThinMedia/,
  /reconcile-public-localization/,
  /warm-staging-content-translations/,
  /publishMediaPlpEntity/,
  /buildMediaPlpCandidate/,
  /notifyMediaCanonicalPublishedForLocalizationBuild/,
];

const FORBIDDEN_IMPORT_FRAGMENTS = [
  "gemini-translation-provider",
  "content-translation-warm-consumer",
  "content-translation-worker-concurrency",
  "public-localization-reconciliation",
  "public-localization-corpus",
  "thin-media-localization-diagnostic/discover-media-presentations",
  "reconcile-public-localization",
  "warm-staging-content-translations",
  "published-localized-presentation/media/publisher",
  "published-localized-presentation/media/build-adapter",
  "published-localized-presentation/media/publication-hook",
  "civic-media-center.service",
  "media-resource.service",
] as const;

function preflightRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function listMediaPlpPreflightModuleFiles(): readonly string[] {
  const root = preflightRoot();
  return readdirSync(root)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => join(root, name));
}

export function collectMediaPlpPreflightModuleSources(): string {
  return listMediaPlpPreflightModuleFiles()
    .filter((abs) => !abs.endsWith("import-guards.ts"))
    .map((abs) => {
      try {
        return readFileSync(abs, "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

export function assertMediaPlpPreflightImportIsolation(): {
  readonly ok: boolean;
  readonly violations: readonly string[];
} {
  const source = collectMediaPlpPreflightModuleSources();
  const violations: string[] = [];
  for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
    if (pattern.test(source)) {
      violations.push(String(pattern));
    }
  }
  for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
    if (source.includes(fragment)) {
      violations.push(fragment);
    }
  }
  if (/\.toArray\s*\(/.test(source)) {
    violations.push("unbounded-.toArray");
  }
  // Write verbs must not appear in executable lookup paths (test helpers OK).
  const lookupFiles = [
    "source-lookup.ts",
    "plp-lookup.ts",
    "language-registry-lookup.ts",
    "sample-discovery.ts",
  ];
  for (const file of lookupFiles) {
    const text = readFileSync(join(preflightRoot(), file), "utf8");
    if (
      /\.(insertOne|insertMany|updateOne|updateMany|replaceOne|deleteOne|deleteMany|findOneAndUpdate|bulkWrite)\s*\(/.test(
        text,
      )
    ) {
      violations.push(`write-op:${file}`);
    }
  }
  void statSync;
  return { ok: violations.length === 0, violations };
}
