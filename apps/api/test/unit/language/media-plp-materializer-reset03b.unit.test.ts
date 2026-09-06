/**
 * Reset 03B — Media PLP materializer local tests (zero live staging/Gemini).
 */
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  asMediaPlpPresentationNode,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
  publishMediaPlpEntity,
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  assertMediaPlpMaterializerImportIsolation,
  evaluateMediaPlpMaterializerExecuteGuards,
  evaluateMediaPlpMaterializerProductionRefusal,
  getMediaPlpMaterializerCounters,
  MEDIA_PLP_OPERATOR_DEFAULT_MAX_RSS_MB,
  parseMediaPlpMaterializerArgs,
  resetMediaPlpMaterializerCountersForTests,
  runMediaPlpMaterializer,
  type MediaPlpMaterializerDeps,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";
import type { TrustedMediaResource } from "@hu/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");
const apiSrc = join(apiRoot, "src");

const trusted: TrustedMediaResource = {
  id: "reuters",
  name: "Reuters",
  logoLabel: "R",
  country: "International",
  categoryId: "international-wire-service",
  explanation: "Independent international news agency with global editorial standards.",
  websiteUrl: "https://www.reuters.com/",
  sortOrder: 1,
};

const canonicalPresentation = asMediaPlpPresentationNode(
  buildCanonicalTrustedPresentation(trusted),
);
const canonicalVersion = fingerprintMediaPlpCanonicalVersion(canonicalPresentation);

function argv(extra: readonly string[]): string[] {
  return ["node", "materialize-media-plp.ts", "--mongo", ...extra];
}

function identityArgv(extra: readonly string[] = []): string[] {
  return argv([
    "--entity-type",
    "civic_media_trusted",
    "--entity-id",
    "reuters",
    "--locale",
    "uk",
    ...extra,
  ]);
}

function baseSource() {
  return {
    SOURCE_FOUND: true,
    SOURCE_PUBLIC: true,
    CANONICAL_VERSION: canonicalVersion,
    canonicalPresentation,
    autoPaths: [{ path: "explanation", value: trusted.explanation }],
    identityCollision: false,
  };
}

function fixtureDeps(input?: {
  readonly executePlatform?: string;
  readonly database?: string;
  readonly translationComplete?: boolean;
  readonly translationState?: "MISSING" | "COMPLETE" | "INCOMPLETE" | "STALE";
  readonly plpFound?: boolean;
  readonly plpMatches?: boolean;
  readonly plpRevision?: number;
  readonly disconnectCalls?: { count: number };
  readonly provider?: TranslationProvider;
  readonly importProviderCalls?: { count: number };
  readonly maxRssMb?: number;
  readonly currentRssMb?: () => number;
  readonly maxProviderInputBytes?: number;
  readonly publish?: MediaPlpMaterializerDeps["publish"];
}): MediaPlpMaterializerDeps {
  const disconnectCalls = input?.disconnectCalls ?? { count: 0 };
  const importProviderCalls = input?.importProviderCalls ?? { count: 0 };
  const translationComplete = input?.translationComplete ?? false;
  const translationState =
    input?.translationState ?? (translationComplete ? "COMPLETE" : "MISSING");
  return {
    skipImportBoundaryCheck: false,
    skipMongoPersistenceRequire: true,
    isMongoConfigured: () => true,
    resolveDatabase: () => input?.database ?? "humanity_union_staging",
    platformMode: input?.executePlatform ?? "staging",
    connect: async () => undefined,
    disconnect: async () => {
      disconnectCalls.count += 1;
    },
    maxRssMb: input?.maxRssMb,
    currentRssMb: input?.currentRssMb,
    maxProviderInputBytes: input?.maxProviderInputBytes,
    resolveSource: async () => baseSource(),
    inspectPlp: async () => ({
      PLP_CURRENT_FOUND: input?.plpFound ?? false,
      PLP_STATE: input?.plpFound ? "PUBLISHED" : null,
      PLP_CANONICAL_VERSION: input?.plpMatches ? canonicalVersion : null,
      PLP_SCHEMA_VERSION: input?.plpFound ? "PLP.1" : null,
      PLP_CONTENT_REVISION: input?.plpRevision ?? null,
      PLP_MATCHES_CURRENT_SOURCE: input?.plpMatches ?? false,
    }),
    lookupTranslation: async () => ({
      EXISTING_TRANSLATION_STATE: translationState,
      EXISTING_TRANSLATION_COMPLETE: translationComplete,
      values: translationComplete
        ? { explanation: `[uk] ${trusted.explanation}` }
        : translationState === "INCOMPLETE"
          ? {}
          : {},
    }),
    loadLocale: async () => ({
      LOCALE_REGISTRY_FOUND: true,
      LOCALE_ENABLED: true,
      CONTENT_TRANSLATION_ENABLED: true,
    }),
    verifyDurability: async () => ({
      ok: true as const,
      PLP_DURABILITY_VERIFIED: true as const,
    }),
    importProvider: async () => {
      importProviderCalls.count += 1;
      return (
        input?.provider ??
        ({
          providerId: "deterministic",
          async translate(request) {
            const parsed = JSON.parse(request.text) as Record<string, string>;
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsed)) {
              out[k] = `[${request.targetLanguage}] ${v}`;
            }
            return {
              translatedText: JSON.stringify(out),
              providerId: "deterministic",
              isPlaceholder: false,
            };
          },
        } satisfies TranslationProvider)
      );
    },
    publish: input?.publish,
  };
}

function collectStaticImports(entryRel: string): Set<string> {
  const visited = new Set<string>();
  const queue = [entryRel];
  while (queue.length) {
    const rel = queue.pop()!;
    if (visited.has(rel)) continue;
    visited.add(rel);
    const abs = join(apiRoot, rel);
    let source: string;
    try {
      source = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const importRe = /from\s+["'](\.\.?\/[^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(source))) {
      const spec = match[1]!;
      const resolved = join(dirname(abs), spec.replace(/\.js$/, ".ts"));
      let candidate = resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
      try {
        statSync(candidate);
      } catch {
        continue;
      }
      const nextRel = relative(apiRoot, candidate).replaceAll("\\", "/");
      if (!visited.has(nextRel)) queue.push(nextRel);
    }
  }
  return visited;
}

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPublishedLocalizationPersistenceForTests();
});

describe("Reset 03B Media PLP materializer", () => {
  it("A/B: dry-run zero writes and zero provider imports/calls", async () => {
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(
      identityArgv(),
      fixtureDeps({ importProviderCalls, translationComplete: false }),
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report);
    assert.equal(result.report!.OPERATOR_MODE, "DRY_RUN");
    assert.equal(result.report!.PLP_WRITES, 0);
    assert.equal(result.report!.PROVIDER_IMPORTED, false);
    assert.equal(result.report!.PROVIDER_CALL_COUNT, 0);
    assert.equal(importProviderCalls.count, 0);
    assert.equal(result.report!.WOULD_CALL_PROVIDER, true);
    assert.equal(result.report!.WOULD_PUBLISH_PLP, true);
    assert.equal(result.report!.HU_MEDIA_PLP_ENABLED, process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)");
    assert.notEqual(result.report!.HU_MEDIA_PLP_ENABLED, "true");
  });

  it("C: production refused", () => {
    const refused = evaluateMediaPlpMaterializerProductionRefusal({
      platformMode: "production",
      database: "humanity_union_staging",
    });
    assert.equal(refused.refused, true);
    const byDb = evaluateMediaPlpMaterializerProductionRefusal({
      platformMode: "staging",
      database: "humanity_union",
    });
    assert.equal(byDb.refused, true);
  });

  it("D/E: explicit identity + one locale required", () => {
    assert.equal(parseMediaPlpMaterializerArgs(["--mongo"]).ok, false);
    assert.equal(
      parseMediaPlpMaterializerArgs([
        "--mongo",
        "--entity-type",
        "civic_media_trusted",
        "--locale",
        "uk",
      ]).ok,
      false,
    );
    assert.equal(
      parseMediaPlpMaterializerArgs([
        "--mongo",
        "--entity-type",
        "civic_media_trusted",
        "--entity-id",
        "reuters",
        "--locale",
        "uk",
        "--locale",
        "ar",
      ]).ok,
      false,
    );
    assert.equal(
      parseMediaPlpMaterializerArgs([
        "--mongo",
        "--entity-type",
        "civic_media_trusted",
        "--entity-id",
        "reuters",
        "--sample-one",
        "--locale",
        "uk",
      ]).ok,
      false,
    );
    const ok = parseMediaPlpMaterializerArgs(identityArgv());
    assert.equal(ok.ok, true);
  });

  it("F: existing complete translation reused (execute; provider not imported)", async () => {
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        importProviderCalls,
        translationComplete: true,
        executePlatform: "staging",
      }),
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.LOCALIZATION_SOURCE, "EXISTING_CURRENT");
    assert.equal(result.report!.PROVIDER_CALL_COUNT, 0);
    assert.equal(importProviderCalls.count, 0);
    assert.equal(result.report!.PLP_WRITES, 1);
    assert.equal(result.report!.CONTENT_TRANSLATION_WRITES, 0);
    assert.equal(result.report!.SOURCE_WRITES, 0);
  });

  it("G/H: incomplete translation allows max one provider call on execute", async () => {
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        importProviderCalls,
        translationState: "INCOMPLETE",
        translationComplete: false,
      }),
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.LOCALIZATION_SOURCE, "PROVIDER");
    assert.equal(result.report!.PROVIDER_CALL_COUNT, 1);
    assert.equal(importProviderCalls.count, 1);
    assert.equal(result.report!.PLP_WRITES, 1);
  });

  it("I: payload limit aborts before provider", async () => {
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        importProviderCalls,
        maxProviderInputBytes: 8,
      }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "PAYLOAD_LIMIT");
    assert.equal(importProviderCalls.count, 0);
    assert.equal(result.report!.PLP_WRITES, 0);
    assert.equal(result.report!.PROVIDER_CALL_COUNT, 0);
  });

  it("J: RSS guard aborts before provider", async () => {
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        importProviderCalls,
        maxRssMb: 1,
        currentRssMb: () => 50,
      }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "RSS_GUARD_BEFORE_PROVIDER");
    assert.equal(importProviderCalls.count, 0);
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("K: RSS post-provider guard prevents publish", async () => {
    let calls = 0;
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        maxRssMb: 100,
        currentRssMb: () => {
          calls += 1;
          // First check (before provider) passes; after provider fails.
          return calls === 1 ? 10 : 150;
        },
      }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "RSS_GUARD_AFTER_PROVIDER");
    assert.equal(result.report!.PROVIDER_CALL_COUNT, 1);
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("L: provider failure zero PLP writes", async () => {
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        provider: {
          providerId: "deterministic",
          async translate() {
            throw new Error("provider boom");
          },
        },
      }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.PLP_WRITES, 0);
    assert.equal(result.report!.abortReason, "PROVIDER_FAILURE");
  });

  it("M: PARTIAL candidate zero PLP writes", async () => {
    const result = await runMediaPlpMaterializer(identityArgv(["--execute"]), {
      ...fixtureDeps({ translationComplete: true }),
      // Incomplete values force NOT_READY when deterministic fill disabled.
      lookupTranslation: async () => ({
        EXISTING_TRANSLATION_STATE: "COMPLETE",
        EXISTING_TRANSLATION_COMPLETE: true,
        values: {}, // missing explanation → NOT_READY
      }),
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.PLP_WRITES, 0);
    assert.equal(result.report!.abortReason, "PARTIAL_OR_NOT_READY");
  });

  it("N/O: successful publish + duplicate idempotent (no unnecessary provider)", async () => {
    const first = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ translationComplete: true }),
    );
    assert.equal(first.exitCode, 0);
    assert.equal(first.report!.PLP_WRITES, 1);
    assert.ok(
      first.report!.PLP_OUTCOME === "PUBLISHED" || first.report!.PLP_OUTCOME === "IDEMPOTENT",
    );

    resetMediaPlpMaterializerCountersForTests();
    const importProviderCalls = { count: 0 };
    const second = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        importProviderCalls,
        translationComplete: true,
        plpFound: true,
        plpMatches: true,
        plpRevision: 1,
      }),
    );
    assert.equal(second.exitCode, 0);
    assert.equal(second.report!.LOCALIZATION_SOURCE, "UNCHANGED_PLP");
    assert.equal(second.report!.PROVIDER_CALL_COUNT, 0);
    assert.equal(importProviderCalls.count, 0);
    assert.equal(second.report!.PLP_WRITES, 0);
    assert.equal(second.report!.PLP_OUTCOME, "UNCHANGED_PLP");
  });

  it("P: stale/lower revision cannot replace current", async () => {
    await publishMediaPlpEntity({
      entityType: "civic_media_trusted",
      entityId: "reuters",
      locale: "uk",
      canonicalVersion,
      contentRevision: 5,
      canonicalPresentation,
      layers: [{ source: "MACHINE", values: { explanation: "[uk] x" } }],
      includeDeterministicMachine: false,
    });

    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      {
        ...fixtureDeps({ translationComplete: true, plpRevision: 5 }),
        // Force publish with lower revision via custom publish wrapping.
        publish: async (input) =>
          publishMediaPlpEntity({
            ...input,
            contentRevision: 1,
          }),
        inspectPlp: async () => ({
          PLP_CURRENT_FOUND: true,
          PLP_STATE: "PUBLISHED",
          PLP_CANONICAL_VERSION: "other",
          PLP_SCHEMA_VERSION: "PLP.1",
          PLP_CONTENT_REVISION: 5,
          PLP_MATCHES_CURRENT_SOURCE: false,
        }),
      },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.PLP_OUTCOME, "STALE_REVISION");
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("Q: source/content_translations write counters remain zero", async () => {
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ translationComplete: true }),
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.CONTENT_TRANSLATION_WRITES, 0);
    assert.equal(result.report!.SOURCE_WRITES, 0);
    assert.equal(getMediaPlpMaterializerCounters().CONTENT_TRANSLATION_WRITES, 0);
  });

  it("R: disconnect success and failure", async () => {
    const okDisconnect = { count: 0 };
    await runMediaPlpMaterializer(identityArgv(), fixtureDeps({ disconnectCalls: okDisconnect }));
    assert.equal(okDisconnect.count, 1);
    assert.equal(getMediaPlpMaterializerCounters().MONGO_CLOSED, true);

    resetMediaPlpMaterializerCountersForTests();
    const failDisconnect = { count: 0 };
    const fail = await runMediaPlpMaterializer(identityArgv(["--execute"]), {
      ...fixtureDeps({ disconnectCalls: failDisconnect }),
      resolveSource: async () => {
        throw new Error("source boom");
      },
    });
    assert.equal(fail.exitCode, 1);
    assert.equal(failDisconnect.count, 1);
    assert.equal(getMediaPlpMaterializerCounters().MONGO_CLOSED, true);
  });

  it("S/T: forbidden imports absent before provider; no corpus enumeration", () => {
    const isolation = assertMediaPlpMaterializerImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(", "));

    const graph = collectStaticImports(
      "src/modules/language/media-plp-materializer/run-materializer.ts",
    );
    const joined = [...graph].join("\n");
    assert.equal(joined.includes("gemini-translation-provider"), false);
    assert.equal(joined.includes("content-translation-warm-consumer"), false);
    assert.equal(joined.includes("public-localization-reconciliation"), false);
    assert.equal(joined.includes("content-translation.service"), false);
    assert.equal(joined.includes("discover-media-presentations"), false);
    assert.ok(joined.includes("media-plp-materializer/source-resolve.ts"));

    const sourceResolve = readFileSync(
      join(apiSrc, "modules/language/media-plp-materializer/source-resolve.ts"),
      "utf8",
    );
    assert.doesNotMatch(sourceResolve, /\.toArray\s*\(/);
    assert.match(sourceResolve, /limit:\s*2/);

    assert.equal(MEDIA_PLP_OPERATOR_DEFAULT_MAX_RSS_MB, 400);

    const executeGuard = evaluateMediaPlpMaterializerExecuteGuards({
      platformMode: "staging",
      database: "humanity_union_dev",
    });
    assert.equal(executeGuard.refused, true);

    const pkg = readFileSync(join(apiRoot, "package.json"), "utf8");
    assert.match(pkg, /materialize:media-plp/);
    const flag = readFileSync(
      join(
        apiSrc,
        "modules/language/published-localized-presentation/media/feature-flag.ts",
      ),
      "utf8",
    );
    assert.match(flag, /HU_MEDIA_PLP_ENABLED === "true"/);
    const ledger = readFileSync(
      join(
        apiRoot,
        "../../project/architecture/core/PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md",
      ),
      "utf8",
    );
    assert.match(ledger, /LEGACY_ACTIVE_RUNTIME_DEFAULT` \| \*\*30\*\*/);
  });

  it("execute refused without staging platform/db", async () => {
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ executePlatform: "development", database: "humanity_union_dev" }),
    );
    assert.equal(result.exitCode, 2);
    assert.match(result.errorMessage ?? "", /PLATFORM_MODE must be staging/);
  });

  it("03B.1 G: durability read-back failure reports DURABILITY_VERIFICATION_FAILED", async () => {
    const result = await runMediaPlpMaterializer(identityArgv(["--execute"]), {
      ...fixtureDeps({ translationComplete: true }),
      verifyDurability: async () => ({
        ok: false,
        PLP_DURABILITY_VERIFIED: false,
        reason: "Durable current pointer missing after publish.",
      }),
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.PLP_OUTCOME, "DURABILITY_VERIFICATION_FAILED");
    assert.equal(result.report!.PLP_DURABILITY_VERIFIED, false);
    assert.equal(result.report!.PROVIDER_CALL_COUNT, 0);
  });

  it("03B.1 A/B: --mongo cannot silently select memory without require", async () => {
    const {
      getPublishedLocalizationPersistenceMode,
      requirePublishedLocalizationMongoPersistence,
      resetPublishedLocalizationPersistenceForTests,
    } = await import(
      "../../../src/modules/language/published-localized-presentation/persistence/repository.js"
    );
    resetPublishedLocalizationPersistenceForTests();
    assert.equal(getPublishedLocalizationPersistenceMode(), "memory");

    const refused = await runMediaPlpMaterializer(identityArgv(), {
      ...fixtureDeps(),
      skipMongoPersistenceRequire: false,
      requirePersistence: () => {
        throw new Error(
          "materialize:media-plp --mongo requires MONGODB_URI; refusing memory PLP fallback.",
        );
      },
    });
    assert.equal(refused.exitCode, 2);
    assert.match(refused.errorMessage ?? "", /refusing memory PLP fallback/i);
    assert.equal(getPublishedLocalizationPersistenceMode(), "memory");
    void requirePublishedLocalizationMongoPersistence;
  });

  it("03B.1 incident class: memory publish does not survive store reset", async () => {
    const {
      findCurrentPublishedPresentation,
      publishMediaPlpEntity,
      resetPublishedLocalizationPersistenceForTests,
      setPublishedLocalizationPersistenceModeForTests,
    } = await import(
      "../../../src/modules/language/published-localized-presentation/index.js"
    );
    resetPublishedLocalizationPersistenceForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");
    const published = await publishMediaPlpEntity({
      entityType: "civic_media_trusted",
      entityId: "reuters-incident-repro",
      locale: "uk",
      canonicalVersion,
      contentRevision: 1,
      canonicalPresentation,
      layers: [{ source: "MACHINE", values: { explanation: "[uk] x" } }],
      includeDeterministicMachine: false,
    });
    assert.equal(published.ok, true);
    const before = await findCurrentPublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "reuters-incident-repro",
      locale: "uk",
    });
    assert.ok(before);
    resetPublishedLocalizationPersistenceForTests();
    const after = await findCurrentPublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: "reuters-incident-repro",
      locale: "uk",
    });
    assert.equal(after, null);
  });
});
