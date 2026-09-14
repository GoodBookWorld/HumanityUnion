/**
 * Reset 03B.2 — thin provider execution boundary (zero live Gemini / staging).
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
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  assertMediaPlpMaterializerImportIsolation,
  assertThinMediaPlpProviderImportGraph,
  callMediaPlpMaterializerProviderOnce,
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_OPERATOR_DEFAULT_PRE_PROVIDER_MAX_RSS_MB,
  MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY,
  MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID,
  resetMediaPlpMaterializerCountersForTests,
  runMediaPlpMaterializer,
  ThinGeminiMediaPlpTransport,
  validateMediaPlpProviderLocalizationValues,
  resetThinGeminiGovernorForTests,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
  type MediaPlpMaterializerDeps,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TrustedMediaResource } from "@hu/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

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
    const importRe =
      /(?:from\s+["'](\.\.?\/[^"']+)["']|import\s*\(\s*["'](\.\.?\/[^"']+)["']\s*\))/g;
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(source))) {
      const spec = (match[1] ?? match[2])!;
      const resolved = join(dirname(abs), spec.replace(/\.js$/, ".ts"));
      let candidate = resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
      try {
        statSync(candidate);
      } catch {
        const asIndex = join(resolved.replace(/\.ts$/, ""), "index.ts");
        try {
          statSync(asIndex);
          candidate = asIndex;
        } catch {
          continue;
        }
      }
      const nextRel = relative(apiRoot, candidate).replaceAll("\\", "/");
      if (!visited.has(nextRel)) queue.push(nextRel);
    }
  }
  return visited;
}

function identityArgv(extra: readonly string[] = []): string[] {
  return [
    "node",
    "materialize-media-plp.ts",
    "--mongo",
    "--entity-type",
    "civic_media_trusted",
    "--entity-id",
    "reuters",
    "--locale",
    "uk",
    ...extra,
  ];
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
  readonly provider?: FakeLocalMediaPlpTransport;
  readonly importProviderCalls?: { count: number };
  readonly plpMatches?: boolean;
  readonly preProviderMaxRssMb?: number;
  readonly maxRssMb?: number;
  readonly currentRssMb?: () => number;
}): MediaPlpMaterializerDeps {
  const importProviderCalls = input?.importProviderCalls ?? { count: 0 };
  return {
    skipImportBoundaryCheck: false,
    skipMongoPersistenceRequire: true,
    isMongoConfigured: () => true,
    resolveDatabase: () => "humanity_union_staging",
    platformMode: "staging",
    connect: async () => undefined,
    disconnect: async () => undefined,
    preProviderMaxRssMb: input?.preProviderMaxRssMb,
    maxRssMb: input?.maxRssMb,
    currentRssMb: input?.currentRssMb,
    resolveSource: async () => baseSource(),
    inspectPlp: async () => ({
      PLP_CURRENT_FOUND: input?.plpMatches ?? false,
      PLP_STATE: input?.plpMatches ? "PUBLISHED" : null,
      PLP_CANONICAL_VERSION: input?.plpMatches ? canonicalVersion : null,
      PLP_SCHEMA_VERSION: input?.plpMatches ? "PLP.1" : null,
      PLP_CONTENT_REVISION: input?.plpMatches ? 1 : null,
      PLP_MATCHES_CURRENT_SOURCE: input?.plpMatches ?? false,
      EXISTING_PLP_USABILITY: input?.plpMatches
        ? ("USABLE_LOCALIZED" as const)
        : ("REBUILD_REQUIRED" as const),
      EXISTING_PLP_USABILITY_REASON: input?.plpMatches
        ? ("OK" as const)
        : ("NO_SNAPSHOT" as const),
      CONTENT_INTEGRITY_STATUS: input?.plpMatches ? "PASSED" : null,
      STRUCTURAL_INTEGRITY_STATUS: input?.plpMatches ? "PASSED" : null,
      REBUILD_REQUIRED: !(input?.plpMatches ?? false),
    }),
    lookupTranslation: async () => ({
      EXISTING_TRANSLATION_STATE: "MISSING",
      EXISTING_TRANSLATION_COMPLETE: false,
      values: {},
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
      const provider = input?.provider ?? new FakeLocalMediaPlpTransport();
      return {
        provider,
        PROVIDER_EXECUTION_BOUNDARY: MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY,
        PROVIDER_TRANSPORT: provider.transportId,
      };
    },
    providerTransport: "fake_local",
  };
}

beforeEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS = "0";
  setThinGeminiProviderStateForceMemoryForTests(true);
  resetThinGeminiProviderStateForTests();
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPublishedLocalizationPersistenceForTests();
  delete process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS;
  resetThinGeminiProviderStateForTests();
  setThinGeminiProviderStateForceMemoryForTests(false);
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
});

describe("Reset 03B.2 thin Media PLP provider boundary", () => {
  it("A: thin execute import graph excludes heavy provider graph", () => {
    const isolation = assertMediaPlpMaterializerImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(", "));

    const thinGraph = collectStaticImports(
      "src/modules/language/media-plp-materializer/thin-gemini-transport.ts",
    );
    const boundaryGraph = collectStaticImports(
      "src/modules/language/media-plp-materializer/provider-boundary.ts",
    );
    const merged = new Set([...thinGraph, ...boundaryGraph]);
    const proof = assertThinMediaPlpProviderImportGraph(merged);
    assert.equal(proof.ok, true, proof.violations.join(", "));

    const joined = [...merged].join("\n");
    assert.equal(joined.includes("gemini-translation-provider"), false);
    assert.equal(joined.includes("language-registry/index"), false);
    assert.equal(joined.includes("content-translation-warm-consumer"), false);
    assert.equal(joined.includes("public-localization-reconciliation"), false);
    assert.equal(joined.includes("global-search"), false);
    assert.equal(joined.includes("apps/web"), false);
    assert.ok(merged.size < 40, `thin graph too large: ${merged.size}`);

    const heavy = collectStaticImports(
      "src/modules/language/providers/gemini-translation-provider.ts",
    );
    assert.ok(heavy.size > 200, `expected heavy graph; got ${heavy.size}`);
    assert.ok([...heavy].some((p) => p.includes("language-registry/index")));
  });

  it("B: --mongo still selects durable Mongo PLP persistence", async () => {
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
  });

  it("C: existing durable PLP prevents provider import/call/write", async () => {
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ importProviderCalls, plpMatches: true }),
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.LOCALIZATION_SOURCE, "UNCHANGED_PLP");
    assert.equal(result.report!.PROVIDER_CALL_COUNT, 0);
    assert.equal(importProviderCalls.count, 0);
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("D: thin transport max one request", async () => {
    const transport = new FakeLocalMediaPlpTransport();
    const first = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues: { explanation: trusted.explanation },
      sourceRecordId: "civic_media_trusted:reuters",
      sourceVersion: canonicalVersion,
      PROVIDER_TRANSPORT: transport.transportId,
    });
    assert.equal(first.ok, true);
    assert.equal(transport.getRequestCountForTests(), 1);

    resetMediaPlpMaterializerCountersForTests();
    const second = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues: { explanation: trusted.explanation },
      sourceRecordId: "civic_media_trusted:reuters",
      sourceVersion: canonicalVersion,
      PROVIDER_TRANSPORT: transport.transportId,
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.reason, "PROVIDER_FAILURE");
    }
    assert.equal(transport.getRequestCountForTests(), 1);
  });

  it("E: timeout fails before publish", async () => {
    const transport = new FakeLocalMediaPlpTransport({
      delayMs: 50,
      timeoutMs: 10,
    });
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ provider: transport }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "TIMEOUT");
    assert.equal(result.report!.PLP_WRITES, 0);
    assert.equal(result.report!.PROVIDER_EXECUTION_BOUNDARY, "THIN");
  });

  it("F: invalid response fails before publish", async () => {
    const transport = new FakeLocalMediaPlpTransport({
      responseText: "not-json",
    });
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ provider: transport }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "PARSE_FAILURE");
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("G: wrong target language fails before publish", () => {
    const validated = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { explanation: trusted.explanation },
      translated: { explanation: trusted.explanation },
    });
    assert.equal(validated.ok, false);
    if (!validated.ok) {
      assert.equal(validated.reason, "WRONG_TARGET_LANGUAGE");
    }
  });

  it("G2: execute path refuses source-identical provider output", async () => {
    const transport = new FakeLocalMediaPlpTransport({
      responseText: JSON.stringify({ explanation: trusted.explanation }),
    });
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ provider: transport }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "WRONG_TARGET_LANGUAGE");
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("H: PARTIAL fails before publish", async () => {
    const transport = new FakeLocalMediaPlpTransport({
      responseText: JSON.stringify({}),
    });
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ provider: transport }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "PARTIAL");
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("I: payload cap preserved", async () => {
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(identityArgv(["--execute"]), {
      ...fixtureDeps({ importProviderCalls }),
      maxProviderInputBytes: 8,
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "PAYLOAD_LIMIT");
    assert.equal(importProviderCalls.count, 0);
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("J: pre-provider RSS guard preserved (stricter ceiling)", async () => {
    assert.equal(MEDIA_PLP_OPERATOR_DEFAULT_PRE_PROVIDER_MAX_RSS_MB, 220);
    const importProviderCalls = { count: 0 };
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        importProviderCalls,
        preProviderMaxRssMb: 1,
        currentRssMb: () => 50,
      }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "RSS_GUARD_BEFORE_PROVIDER");
    assert.equal(importProviderCalls.count, 0);
  });

  it("K: post-provider RSS failure prevents publish", async () => {
    let calls = 0;
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({
        preProviderMaxRssMb: 100,
        maxRssMb: 100,
        currentRssMb: () => {
          calls += 1;
          return calls === 1 ? 10 : 150;
        },
      }),
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.abortReason, "RSS_GUARD_AFTER_PROVIDER");
    assert.equal(result.report!.PLP_WRITES, 0);
  });

  it("L: durable publish verification preserved", async () => {
    const result = await runMediaPlpMaterializer(identityArgv(["--execute"]), {
      ...fixtureDeps(),
      verifyDurability: async () => ({
        ok: false,
        PLP_DURABILITY_VERIFIED: false,
        reason: "Durable current pointer missing after publish.",
      }),
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.report!.PLP_OUTCOME, "DURABILITY_VERIFICATION_FAILED");
    assert.equal(result.report!.PLP_WRITES, 1);
  });

  it("M: no content_translations/source writes", async () => {
    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps(),
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.CONTENT_TRANSLATION_WRITES, 0);
    assert.equal(result.report!.SOURCE_WRITES, 0);
    assert.equal(result.report!.PROVIDER_EXECUTION_BOUNDARY, "THIN");
    assert.equal(result.report!.PROVIDER_TRANSPORT, "fake_local");
  });

  it("N: production refusal preserved", async () => {
    const result = await runMediaPlpMaterializer(identityArgv(["--execute"]), {
      ...fixtureDeps(),
      platformMode: "production",
    });
    assert.equal(result.exitCode, 2);
    assert.match(result.errorMessage ?? "", /production/i);
  });

  it("O: zero live operations — thin HTTP transport never invoked in tests; fake only", async () => {
    let fetchCalls = 0;
    const transport = new ThinGeminiMediaPlpTransport(
      {
        provider: "gemini",
        geminiApiKey: "test-key-not-real",
        geminiModel: "gemini-2.0-flash",
        timeoutMs: 25,
        maxOutputTokens: 256,
      },
      async () => {
        fetchCalls += 1;
        throw new Error("live fetch must not run in unit tests");
      },
    );
    // Cap proof without network: second call refused by transport itself after first timeout path.
    await assert.rejects(
      () =>
        transport.translate({
          sourceLanguage: "en",
          targetLanguage: "uk",
          text: JSON.stringify({ explanation: "x" }),
          contentType: "structured_json",
          safetyCleared: true,
        }),
      /network|live fetch/i,
    );
    assert.equal(fetchCalls, 1);
    assert.equal(transport.transportId, MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID);

    await assert.rejects(
      () =>
        transport.translate({
          sourceLanguage: "en",
          targetLanguage: "uk",
          text: JSON.stringify({ explanation: "x" }),
          contentType: "structured_json",
          safetyCleared: true,
        }),
      (err: unknown) =>
        err instanceof TranslationProviderError && err.code === "bad_request",
    );
    assert.equal(fetchCalls, 1);
  });

  it("memory probe (local fake): reports RSS phases without live Gemini", async () => {
    const rssStart = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    await import(
      "../../../src/modules/language/media-plp-materializer/thin-gemini-transport.js"
    );
    const rssAfterImport =
      Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    const transport = new FakeLocalMediaPlpTransport();
    const rssBefore =
      Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    await transport.translate({
      sourceLanguage: "en",
      targetLanguage: "uk",
      text: JSON.stringify({ explanation: trusted.explanation }),
      contentType: "structured_json",
      safetyCleared: true,
    });
    const rssAfter =
      Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;

    assert.ok(Number.isFinite(rssStart));
    assert.ok(Number.isFinite(rssAfterImport));
    assert.ok(Number.isFinite(rssBefore));
    assert.ok(Number.isFinite(rssAfter));
    // Local only — do not claim Render equivalence.
    assert.ok(rssAfterImport - rssStart < 150);

    const result = await runMediaPlpMaterializer(
      identityArgv(["--execute"]),
      fixtureDeps({ provider: new FakeLocalMediaPlpTransport() }),
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report!.memory.RSS_AFTER_THIN_PROVIDER_IMPORT_MB !== null);
    assert.ok(result.report!.memory.RSS_BEFORE_PROVIDER_MB !== null);
    assert.ok(result.report!.memory.RSS_AFTER_PROVIDER_MB !== null);
  });

  it("provider-boundary source never dynamically imports heavy gemini module", () => {
    const text = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-materializer/provider-boundary.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(text, /import\s*\(\s*["'][^"']*gemini-translation-provider/);
    assert.doesNotMatch(text, /from\s+["'][^"']*gemini-translation-provider/);
    assert.match(text, /createThinMediaPlpProviderFromConfig/);
    assert.match(text, /PROVIDER_EXECUTION_BOUNDARY/);
  });
});
