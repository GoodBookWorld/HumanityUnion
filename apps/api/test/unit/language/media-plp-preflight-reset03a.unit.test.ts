/**
 * Reset 03A — thin Media PLP safety preflight (local only; no live staging run).
 */
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import {
  assertMediaPlpPreflightImportIsolation,
  evaluateMediaPlpPreflightProductionRefusal,
  getMediaPlpPreflightCounters,
  markMediaPlpPreflightLanguageRegistryLookup,
  markMediaPlpPreflightPlpLookup,
  markMediaPlpPreflightSourceLookup,
  parseMediaPlpPreflightArgs,
  resetMediaPlpPreflightCountersForTests,
  runMediaPlpPreflight,
  type MediaPlpPreflightDeps,
} from "../../../src/modules/language/media-plp-preflight/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");
const apiSrc = join(apiRoot, "src");

const FORBIDDEN_IMPORT_FRAGMENTS = [
  "gemini-translation-provider",
  "content-translation-warm-consumer",
  "content-translation-worker-concurrency",
  "public-localization-reconciliation",
  "public-localization-corpus",
  "thin-media-localization-diagnostic/discover-media-presentations",
  "reconcile-public-localization",
  "warm-staging-content-translations",
  "media/publisher",
  "media/build-adapter",
  "media/publication-hook",
  "civic-media-center.service",
  "media-resource.service",
] as const;

function collectStaticImports(entryRel: string): Set<string> {
  const visited = new Set<string>();
  const queue = [entryRel];

  while (queue.length) {
    const rel = queue.pop()!;
    if (visited.has(rel)) {
      continue;
    }
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
      let candidate = resolved;
      if (!resolved.endsWith(".ts") && !resolved.endsWith(".tsx")) {
        candidate = `${resolved}.ts`;
      }
      try {
        statSync(candidate);
      } catch {
        continue;
      }
      const nextRel = relative(apiRoot, candidate).replaceAll("\\", "/");
      if (!visited.has(nextRel)) {
        queue.push(nextRel);
      }
    }
  }
  return visited;
}

function argv(extra: readonly string[]): string[] {
  return ["node", "diagnose-media-plp-preflight.ts", "--mongo", ...extra];
}

function fixtureDeps(input?: {
  readonly sourceFound?: boolean;
  readonly plpFound?: boolean;
  readonly canonicalVersion?: string;
  readonly plpVersion?: string;
  readonly plpState?: string;
  readonly disconnectCalls?: { count: number };
}): MediaPlpPreflightDeps {
  const disconnectCalls = input?.disconnectCalls ?? { count: 0 };
  return {
    skipImportBoundaryCheck: false,
    isMongoConfigured: () => true,
    resolveDatabase: () => "humanity_union_staging",
    connect: async () => undefined,
    disconnect: async () => {
      disconnectCalls.count += 1;
    },
    loadSource: async () => {
      markMediaPlpPreflightSourceLookup();
      return {
        SOURCE_FOUND: input?.sourceFound ?? true,
        SOURCE_PUBLIC: true,
        CANONICAL_VERSION: input?.canonicalVersion ?? "canon-v1",
        SOURCE_DOCUMENT_BYTES: 128,
        SOURCE_RECORDS_MATCHED: 1,
        identityCollision: false,
      };
    },
    loadPlp: async () => {
      markMediaPlpPreflightPlpLookup();
      return {
        PLP_CURRENT_FOUND: input?.plpFound ?? false,
        PLP_STATE: input?.plpState ?? null,
        PLP_CANONICAL_VERSION: input?.plpVersion ?? null,
        PLP_SCHEMA_VERSION: input?.plpFound ? "PLP.1" : null,
        PLP_DOCUMENT_BYTES: input?.plpFound ? 64 : 0,
        PLP_RECORDS_MATCHED: input?.plpFound ? 1 : 0,
        identityCollision: false,
      };
    },
    loadLocale: async () => {
      markMediaPlpPreflightLanguageRegistryLookup();
      return {
        LOCALE_REGISTRY_FOUND: true,
        LOCALE_ENABLED: true,
        CONTENT_TRANSLATION_ENABLED: true,
      };
    },
  };
}

afterEach(() => {
  resetMediaPlpPreflightCountersForTests();
});

describe("Reset 03A Media PLP safety preflight", () => {
  it("A: explicit identity required (no all mode)", () => {
    assert.equal(parseMediaPlpPreflightArgs(["--mongo"]).ok, false);
    assert.equal(
      parseMediaPlpPreflightArgs([
        "--mongo",
        "--entity-type",
        "civic_media_trusted",
        "--locale",
        "uk",
      ]).ok,
      false,
    );
    assert.equal(
      parseMediaPlpPreflightArgs([
        "--mongo",
        "--entity-type",
        "civic_media_trusted",
        "--entity-id",
        "all",
        "--locale",
        "uk",
      ]).ok,
      false,
    );
    assert.equal(
      parseMediaPlpPreflightArgs(["--mongo", "--all", "--locale", "uk"]).ok,
      false,
    );
    const ok = parseMediaPlpPreflightArgs([
      "--mongo",
      "--entity-type",
      "civic_media_trusted",
      "--entity-id",
      "reuters",
      "--locale",
      "uk",
    ]);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.args.mode, "identity");
      if (ok.args.mode === "identity") {
        assert.equal(ok.args.entityType, "civic_media_trusted");
        assert.equal(ok.args.entityId, "reuters");
        assert.equal(ok.args.locale, "uk");
      }
    }
  });

  it("03A.1: --sample-one and --entity-id are mutually exclusive", () => {
    const both = parseMediaPlpPreflightArgs([
      "--mongo",
      "--entity-type",
      "civic_media_trusted",
      "--entity-id",
      "reuters",
      "--sample-one",
    ]);
    assert.equal(both.ok, false);
    if (!both.ok) {
      assert.match(both.errorMessage, /mutually exclusive/);
    }

    const sample = parseMediaPlpPreflightArgs([
      "--mongo",
      "--entity-type",
      "civic_media_trusted",
      "--sample-one",
    ]);
    assert.equal(sample.ok, true);
    if (sample.ok) {
      assert.equal(sample.args.mode, "sample-one");
      assert.equal(sample.args.entityType, "civic_media_trusted");
    }
  });

  it("D: production refused", () => {
    const byMode = evaluateMediaPlpPreflightProductionRefusal({
      platformMode: "production",
      nodeEnv: "production",
      database: "humanity_union_staging",
    });
    assert.equal(byMode.refused, true);
    assert.match(byMode.reason ?? "", /PLATFORM_MODE=production/);

    const byDb = evaluateMediaPlpPreflightProductionRefusal({
      platformMode: "staging",
      nodeEnv: "production",
      database: "humanity_union",
    });
    assert.equal(byDb.refused, true);
    assert.match(byDb.reason ?? "", /production database/);

    const byNodeEnv = evaluateMediaPlpPreflightProductionRefusal({
      platformMode: "development",
      nodeEnv: "production",
      database: "humanity_union_dev",
    });
    assert.equal(byNodeEnv.refused, true);

    const stagingOk = evaluateMediaPlpPreflightProductionRefusal({
      platformMode: "staging",
      nodeEnv: "production",
      database: "humanity_union_staging",
    });
    assert.equal(stagingOk.refused, false);
  });

  it("B/I: read-only report with bounded lookups; no writes; WOULD_REQUIRE_BUILD when PLP missing", async () => {
    const disconnectCalls = { count: 0 };
    const result = await runMediaPlpPreflight(
      argv([
        "--entity-type",
        "civic_media_trusted",
        "--entity-id",
        "reuters",
        "--locale",
        "uk",
      ]),
      fixtureDeps({ disconnectCalls }),
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report);
    assert.equal(result.report!.reportKind, "identity");
    if (result.report!.reportKind !== "identity") {
      return;
    }
    assert.equal(result.report.SOURCE_FOUND, true);
    assert.equal(result.report.PLP_CURRENT_FOUND, false);
    assert.equal(result.report.PLP_MATCHES_CURRENT_SOURCE, false);
    assert.equal(result.report.WOULD_REQUIRE_BUILD, true);
    assert.equal(result.report.WRITES_PERFORMED, 0);
    assert.equal(result.report.PROVIDER_CALLS, 0);
    assert.equal(result.report.SOURCE_LOOKUP_COUNT, 1);
    assert.equal(result.report.PLP_LOOKUP_COUNT, 1);
    assert.equal(result.report.LANGUAGE_REGISTRY_LOOKUP_COUNT, 1);
    assert.equal(result.report.SAMPLE_DISCOVERY_COUNT, 0);
    assert.equal(result.report.TOTAL_BOUNDED_LOOKUPS, 3);
    assert.equal(result.report.HU_MEDIA_PLP_ENABLED, process.env.HU_MEDIA_PLP_ENABLED ?? "(unset)");
    assert.notEqual(result.report.HU_MEDIA_PLP_ENABLED, "true");
    assert.equal(disconnectCalls.count, 1);
    assert.equal(getMediaPlpPreflightCounters().MONGO_CLOSED, true);
  });

  it("K: matching PLP reports WOULD_REQUIRE_BUILD=false without body logging", async () => {
    const result = await runMediaPlpPreflight(
      argv([
        "--entity-type",
        "civic_media_principle",
        "--entity-id",
        "editorial-transparency",
        "--locale",
        "uk",
      ]),
      fixtureDeps({
        plpFound: true,
        canonicalVersion: "canon-v1",
        plpVersion: "canon-v1",
        plpState: "PUBLISHED",
      }),
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.reportKind, "identity");
    if (result.report!.reportKind !== "identity") {
      return;
    }
    assert.equal(result.report.PLP_MATCHES_CURRENT_SOURCE, true);
    assert.equal(result.report.WOULD_REQUIRE_BUILD, false);
    assert.equal(result.report.SOURCE_DOCUMENT_BYTES > 0, true);
    const printed = JSON.stringify(result.report);
    assert.doesNotMatch(printed, /Editorial transparency|explanation|title":/);
  });

  it("L: Mongo disconnect occurs on failure path", async () => {
    const disconnectCalls = { count: 0 };
    const result = await runMediaPlpPreflight(
      argv([
        "--entity-type",
        "public_news",
        "--entity-id",
        "news-x",
        "--locale",
        "uk",
      ]),
      {
        ...fixtureDeps({ disconnectCalls }),
        loadSource: async () => {
          markMediaPlpPreflightSourceLookup();
          throw new Error("simulated source failure");
        },
      },
    );
    assert.equal(result.exitCode, 1);
    assert.match(result.errorMessage ?? "", /simulated source failure/);
    assert.equal(disconnectCalls.count, 1);
    assert.equal(getMediaPlpPreflightCounters().MONGO_CLOSED, true);
  });

  it("E/F/G/H: import graph excludes provider/worker/corpus/aggregate services", () => {
    const isolation = assertMediaPlpPreflightImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(", "));

    const graph = collectStaticImports(
      "src/modules/language/media-plp-preflight/run-preflight.ts",
    );
    const joined = [...graph].join("\n");
    for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
      assert.equal(
        joined.includes(fragment),
        false,
        `forbidden import fragment present: ${fragment}`,
      );
    }
    assert.ok(joined.includes("media-plp-preflight/source-lookup.ts"));
    assert.ok(joined.includes("media-plp-preflight/sample-discovery.ts"));
    assert.ok(joined.includes("media/canonical-trees.ts"));
    assert.equal(joined.includes("media/publisher.ts"), false);
    assert.equal(joined.includes("media/build-adapter.ts"), false);

    const sampleSrc = readFileSync(
      join(apiSrc, "modules/language/media-plp-preflight/sample-discovery.ts"),
      "utf8",
    );
    assert.match(sampleSrc, /findOne/);
    assert.doesNotMatch(sampleSrc, /\.toArray\s*\(/);
    assert.match(sampleSrc, /status:\s*"active"/);
    assert.match(sampleSrc, /resourceType:\s*"TRUSTED_MEDIA"/);
    assert.match(sampleSrc, /projection:\s*\{\s*id:\s*1/);
    assert.doesNotMatch(sampleSrc, /title|summary|explanation|websiteUrl|description/);
  });

  it("03A.1: sample-one returns identity only; public eligibility; zero writes; disconnect", async () => {
    const disconnectCalls = { count: 0 };
    const result = await runMediaPlpPreflight(
      argv(["--entity-type", "civic_media_trusted", "--sample-one"]),
      {
        ...fixtureDeps({ disconnectCalls }),
        sampleOne: async (entityType) => {
          const { markMediaPlpPreflightSampleDiscovery } = await import(
            "../../../src/modules/language/media-plp-preflight/counters.js"
          );
          markMediaPlpPreflightSampleDiscovery();
          return {
            SAMPLE_FOUND: true,
            SAMPLE_ENTITY_TYPE: entityType,
            SAMPLE_ENTITY_ID: "reuters",
          };
        },
      },
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.reportKind, "sample-one");
    if (result.report!.reportKind !== "sample-one") {
      return;
    }
    assert.equal(result.report.SAMPLE_FOUND, true);
    assert.equal(result.report.SAMPLE_ENTITY_TYPE, "civic_media_trusted");
    assert.equal(result.report.SAMPLE_ENTITY_ID, "reuters");
    assert.equal(result.report.WRITES_PERFORMED, 0);
    assert.equal(result.report.PROVIDER_CALLS, 0);
    assert.equal(result.report.SAMPLE_DISCOVERY_COUNT, 1);
    assert.equal(result.report.SOURCE_LOOKUP_COUNT, 0);
    assert.equal(result.report.PLP_LOOKUP_COUNT, 0);
    const printed = JSON.stringify(result.report);
    assert.doesNotMatch(
      printed,
      /title|summary|explanation|websiteUrl|description|Editorial/,
    );
    assert.equal(disconnectCalls.count, 1);
    assert.equal(getMediaPlpPreflightCounters().MONGO_CLOSED, true);
  });

  it("03A.1: principle sample uses first seed id without body output", async () => {
    const result = await runMediaPlpPreflight(
      argv(["--entity-type", "civic_media_principle", "--sample-one"]),
      {
        isMongoConfigured: () => false,
        resolveDatabase: () => "humanity_union_dev",
        sampleOne: async (entityType) => {
          const { markMediaPlpPreflightSampleDiscovery } = await import(
            "../../../src/modules/language/media-plp-preflight/counters.js"
          );
          markMediaPlpPreflightSampleDiscovery();
          return {
            SAMPLE_FOUND: true,
            SAMPLE_ENTITY_TYPE: entityType,
            SAMPLE_ENTITY_ID: "editorial-transparency",
          };
        },
        disconnect: async () => undefined,
      },
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.report!.reportKind, "sample-one");
    if (result.report!.reportKind === "sample-one") {
      assert.equal(result.report.SAMPLE_ENTITY_ID, "editorial-transparency");
    }
  });

  it("03A.1: sample-one production refusal and failure disconnect", async () => {
    const prev = process.env.PLATFORM_MODE;
    process.env.PLATFORM_MODE = "production";
    try {
      const prod = await runMediaPlpPreflight(
        argv(["--entity-type", "public_news", "--sample-one"]),
        {
          ...fixtureDeps(),
          resolveDatabase: () => "humanity_union_staging",
        },
      );
      assert.equal(prod.exitCode, 2);
      assert.match(prod.errorMessage ?? "", /PLATFORM_MODE=production/);
      assert.equal(getMediaPlpPreflightCounters().SAMPLE_DISCOVERY_COUNT, 0);
    } finally {
      if (prev === undefined) {
        delete process.env.PLATFORM_MODE;
      } else {
        process.env.PLATFORM_MODE = prev;
      }
    }

    const disconnectCalls = { count: 0 };
    const fail = await runMediaPlpPreflight(
      argv(["--entity-type", "public_news", "--sample-one"]),
      {
        ...fixtureDeps({ disconnectCalls }),
        sampleOne: async () => {
          throw new Error("simulated sample failure");
        },
      },
    );
    assert.equal(fail.exitCode, 1);
    assert.match(fail.errorMessage ?? "", /simulated sample failure/);
    assert.equal(disconnectCalls.count, 1);
    assert.equal(getMediaPlpPreflightCounters().MONGO_CLOSED, true);
  });

  it("script + package wiring; no document-body console dumps; flag default OFF", () => {
    const pkg = readFileSync(join(apiRoot, "package.json"), "utf8");
    assert.match(pkg, /diagnose:media-plp-preflight/);
    const script = readFileSync(
      join(apiSrc, "scripts/diagnose-media-plp-preflight.ts"),
      "utf8",
    );
    assert.match(script, /RESET_03A|media-plp-preflight/);
    assert.match(script, /disconnectMongoClient/);
    assert.doesNotMatch(script, /HU_MEDIA_PLP_ENABLED\s*=\s*["']true["']/);
    assert.doesNotMatch(script, /console\.log\([^)]*presentation|title|summary|explanation/);

    const runner = readFileSync(
      join(apiSrc, "modules/language/media-plp-preflight/run-preflight.ts"),
      "utf8",
    );
    assert.match(runner, /RSS_START_MB/);
    assert.match(runner, /WOULD_REQUIRE_BUILD/);
    assert.doesNotMatch(runner, /insertOne|updateOne|replaceOne|publishAtomic/);

    const flag = readFileSync(
      join(
        apiSrc,
        "modules/language/published-localized-presentation/media/feature-flag.ts",
      ),
      "utf8",
    );
    assert.match(flag, /HU_MEDIA_PLP_ENABLED === "true"/);
    assert.match(flag, /Default false|default OFF/i);

    const ledger = readFileSync(
      join(
        apiRoot,
        "../../project/architecture/core/PUBLISHED_LOCALIZATION_LEGACY_REMOVAL_LEDGER_v1.0.md",
      ),
      "utf8",
    );
    assert.match(ledger, /LEGACY_ACTIVE_RUNTIME_DEFAULT` \| \*\*30\*\*/);
  });

  it("refuses write flags and production before lookups", async () => {
    const write = await runMediaPlpPreflight(
      argv([
        "--entity-type",
        "civic_media_trusted",
        "--entity-id",
        "reuters",
        "--locale",
        "uk",
        "--execute",
      ]),
      fixtureDeps(),
    );
    assert.equal(write.exitCode, 2);
    assert.match(write.errorMessage ?? "", /READ-ONLY/);

    const prev = process.env.PLATFORM_MODE;
    process.env.PLATFORM_MODE = "production";
    try {
      const prod = await runMediaPlpPreflight(
        argv([
          "--entity-type",
          "civic_media_trusted",
          "--entity-id",
          "reuters",
          "--locale",
          "uk",
        ]),
        {
          ...fixtureDeps(),
          resolveDatabase: () => "humanity_union_staging",
        },
      );
      assert.equal(prod.exitCode, 2);
      assert.match(prod.errorMessage ?? "", /PLATFORM_MODE=production/);
      assert.equal(getMediaPlpPreflightCounters().SOURCE_LOOKUP_COUNT, 0);
    } finally {
      if (prev === undefined) {
        delete process.env.PLATFORM_MODE;
      } else {
        process.env.PLATFORM_MODE = prev;
      }
    }
  });
});
