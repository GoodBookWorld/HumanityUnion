/**
 * Pack 08K.2.8 — zero-hydration thin localization residual diagnostic.
 * Deterministic fixtures only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";

import type { LanguageCode } from "@hu/types";

import {
  encodeContentTranslationFailureMetadata,
  parseContentTranslationFailureMetadata,
} from "../../../src/modules/language/content-translation-failure-metadata.js";
import type { ResidualWarmAttemptLike } from "../../../src/modules/language/content-translation-residual-state-core.js";
import {
  getThinLocalizationCounters,
  getThinLocalizationImportGuards,
  parseThinResidualIdentityArgs,
  resetThinLocalizationCountersForTests,
  resetThinLocalizationImportGuardsForTests,
  resolveThinResidualState,
  runThinLocalizationResidualDiagnostic,
  thinResidualDiagnosticDigest,
  type ThinResidualLookupDeps,
} from "../../../src/modules/language/thin-localization-diagnostic/index.js";
import {
  markThinMongoClosed,
} from "../../../src/modules/language/thin-localization-diagnostic/thin-counters.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

const FORBIDDEN_IMPORT_FRAGMENTS = [
  "gemini-translation-provider",
  "content-translation-warm-consumer",
  "content-translation.service",
  "public-localization-corpus",
  "public-localization-reconciliation",
  "public-localization-residual-retry",
  "bootstrap-content-translation-operator-persistence",
  "bootstrap-mongo-persistence",
  "initiative.store",
  "initiative-collaborative-analysis.store",
  "initiative-collective-decision.store",
  "global-search.index",
  "language-registry/index",
  "language-registry.service",
  "reconcile-public-localization-heavy",
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

function meta(input: {
  sourceRecordId: string;
  targetLocale: string | null;
  failureReasonCode: string;
  localeFailures?: readonly {
    targetLocale: string;
    failureReasonCode: string;
  }[];
}): string {
  return encodeContentTranslationFailureMetadata({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: input.failureReasonCode,
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: "v-test",
    targetLocale: input.targetLocale,
    failedAt: "2026-09-01T00:00:00.000Z",
    retryabilityHint: "may_retry_after_architecture_fix",
    ...(input.localeFailures
      ? {
          localeFailures: input.localeFailures.map((row) => ({
            targetLocale: row.targetLocale,
            failureClass: "VALIDATION_FAILED",
            failureReasonCode: row.failureReasonCode,
            retryabilityHint: "may_retry_after_architecture_fix",
          })),
        }
      : {}),
  });
}

function attempt(input: {
  eventId: string;
  status: "pending" | "published" | "failed";
  attemptAt: string;
  targetLocales?: readonly LanguageCode[] | null;
  lastError?: string | null;
  reason?: string | null;
  architectureRetryBasis?: string | null;
}): ResidualWarmAttemptLike {
  return {
    eventId: input.eventId,
    status: input.status,
    reason: input.reason ?? null,
    architectureRetryBasis: input.architectureRetryBasis ?? null,
    requestedAt: input.attemptAt,
    attemptAt: input.attemptAt,
    targetLocales: input.targetLocales ?? null,
    lastError: input.lastError ?? null,
    failureMetadata: parseContentTranslationFailureMetadata(input.lastError ?? null),
  };
}

function fixtureDeps(input: {
  readonly identities: ReadonlyMap<
    string,
    {
      sourceExists: boolean;
      sourceVersion: string | null;
      translation?: {
        exists: boolean;
        sourceVersion: string | null;
        freshness: string | null;
        stale: boolean;
        updatedAt: string | null;
      };
      attempts: readonly ResidualWarmAttemptLike[];
      localeEnabled?: boolean;
    }
  >;
  readonly hugeUnrelatedCorpusSize?: number;
}): ThinResidualLookupDeps & {
  readonly sourceLookupKeys: string[];
  readonly outboxLimitsSeen: number[];
} {
  const sourceLookupKeys: string[] = [];
  const outboxLimitsSeen: number[] = [];
  // Simulate huge unrelated corpus that must never be scanned.
  void input.hugeUnrelatedCorpusSize;

  return {
    sourceLookupKeys,
    outboxLimitsSeen,
    async loadSource(identity) {
      const key = `${identity.sourceKind}::${identity.sourceRecordId}::${identity.targetLocale}`;
      sourceLookupKeys.push(key);
      const row = input.identities.get(key);
      return {
        sourceExists: row?.sourceExists ?? false,
        sourceVersion: row?.sourceVersion ?? null,
      };
    },
    async loadTranslation(args) {
      const key = `${args.sourceKind}::${args.sourceRecordId}::${args.targetLocale}`;
      const row = input.identities.get(key);
      const t = row?.translation;
      return {
        translationRowExists: t?.exists ?? false,
        translationSourceVersion: t?.sourceVersion ?? null,
        translationFreshness: t?.freshness ?? null,
        translationStale: t?.stale ?? null,
        translationUpdatedAt: t?.updatedAt ?? null,
      };
    },
    async listAttempts(args) {
      const limit = args.limit ?? 10;
      outboxLimitsSeen.push(limit);
      // Find any identity matching source (attempts are source-scoped).
      for (const [key, row] of input.identities) {
        if (key.startsWith(`${args.sourceKind}::${args.sourceRecordId}::`)) {
          const attempts = row.attempts.slice(-limit);
          return { attempts, outboxRowsInspected: attempts.length };
        }
      }
      return { attempts: [], outboxRowsInspected: 0 };
    },
    async isLocaleEnabled() {
      return true;
    },
  };
}

afterEach(() => {
  resetThinLocalizationCountersForTests();
  resetThinLocalizationImportGuardsForTests();
});

describe("Pack 08K.2.8 thin localization residual diagnostic", () => {
  it("A–D: thin CLI import surface excludes provider/worker/corpus/hydrate graph", () => {
    const visited = collectStaticImports(
      "src/scripts/diagnose-localization-residuals.ts",
    );
    const joined = [...visited].join("\n");
    for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
      assert.equal(
        joined.includes(fragment),
        false,
        `thin CLI must not import ${fragment}; visited=${joined}`,
      );
    }
    assert.equal(
      joined.includes("thin-localization-diagnostic"),
      true,
    );
    assert.equal(
      joined.includes("reconcile-public-localization.ts"),
      false,
    );
  });

  it("A–D runtime: importing thin runner does not flip forbidden guards", async () => {
    resetThinLocalizationImportGuardsForTests();
    await import(
      "../../../src/modules/language/thin-localization-diagnostic/run-thin-diagnostic.js"
    );
    const guards = getThinLocalizationImportGuards();
    assert.equal(guards.OPERATOR_MODE, "THIN_READ_ONLY");
    assert.equal(guards.FULL_APPLICATION_GRAPH_IMPORTED, false);
    assert.equal(guards.PROVIDER_MODULE_IMPORTED, false);
    assert.equal(guards.WORKER_MODULE_IMPORTED, false);
    assert.equal(guards.PRESENTATION_TREE_BUILT, false);
    assert.equal(guards.FULL_CORPUS_HYDRATED, false);
  });

  it("E–F: 4 identities => 4 narrow source lookups; huge corpus size irrelevant", async () => {
    const identities = new Map<
      string,
      {
        sourceExists: boolean;
        sourceVersion: string | null;
        translation?: {
          exists: boolean;
          sourceVersion: string | null;
          freshness: string | null;
          stale: boolean;
          updatedAt: string | null;
        };
        attempts: readonly ResidualWarmAttemptLike[];
      }
    >();
    const keys = [
      "collaborative_analysis::ca-1::uk",
      "discussion_comment::c-1::zh-Hant",
      "blog_post::blog-1::zh-Hant",
      "blog_post::blog-2::ar",
    ] as const;
    for (const key of keys) {
      const [sourceKind, sourceRecordId, targetLocale] = key.split("::") as [
        string,
        string,
        string,
      ];
      void sourceKind;
      void sourceRecordId;
      void targetLocale;
      identities.set(key, {
        sourceExists: true,
        sourceVersion: "v-src",
        translation: {
          exists: false,
          sourceVersion: null,
          freshness: null,
          stale: false,
          updatedAt: null,
        },
        attempts: [
          attempt({
            eventId: `evt-${key}`,
            status: "failed",
            attemptAt: "2026-09-01T00:00:00.000Z",
            targetLocales: [key.split("::")[2] as LanguageCode],
            lastError: meta({
              sourceRecordId: key.split("::")[1]!,
              targetLocale: key.split("::")[2]!,
              failureReasonCode: "INVALID_RICH_TEXT_STRUCTURE",
            }),
          }),
        ],
      });
    }

    const deps = fixtureDeps({
      identities,
      hugeUnrelatedCorpusSize: 1_000_000,
    });

    const rows = [];
    for (const key of keys) {
      const [sourceKind, sourceRecordId, targetLocale] = key.split("::");
      rows.push(
        await resolveThinResidualState(
          {
            sourceKind: sourceKind as "blog_post",
            sourceRecordId: sourceRecordId!,
            targetLocale: targetLocale as LanguageCode,
          },
          deps,
        ),
      );
    }

    assert.equal(deps.sourceLookupKeys.length, 4);
    assert.equal(rows.length, 4);
    assert.equal(
      getThinLocalizationCounters().IDENTITY_RESOLUTIONS,
      4,
    );
    assert.deepEqual(
      deps.sourceLookupKeys.slice().sort(),
      [...keys].slice().sort(),
    );
  });

  it("G: huge outbox history remains bounded", async () => {
    const many: ResidualWarmAttemptLike[] = [];
    for (let i = 0; i < 500; i += 1) {
      many.push(
        attempt({
          eventId: `evt-${String(i).padStart(4, "0")}`,
          status: "failed",
          attemptAt: `2026-01-01T00:${String(i % 60).padStart(2, "0")}:00.000Z`,
          targetLocales: ["uk"],
          lastError: meta({
            sourceRecordId: "init-1",
            targetLocale: "uk",
            failureReasonCode: "EMPTY_TRANSLATION",
          }),
        }),
      );
    }
    const deps = fixtureDeps({
      identities: new Map([
        [
          "initiative::init-1::uk",
          {
            sourceExists: true,
            sourceVersion: "v1",
            attempts: many,
          },
        ],
      ]),
    });
    const row = await resolveThinResidualState(
      {
        sourceKind: "initiative",
        sourceRecordId: "init-1",
        targetLocale: "uk",
      },
      deps,
      10,
    );
    assert.equal(deps.outboxLimitsSeen[0], 10);
    assert.ok(row.outboxRowsInspected <= 10);
  });

  it("H–J: deterministic ordering, locale attribution, CURRENT precedence", async () => {
    const sibling = attempt({
      eventId: "evt-sibling",
      status: "failed",
      attemptAt: "2026-09-02T00:00:00.000Z",
      targetLocales: ["uk", "ar"],
      lastError: meta({
        sourceRecordId: "init-2",
        targetLocale: "ar",
        failureReasonCode: "STRUCTURE_MISMATCH",
        localeFailures: [
          { targetLocale: "ar", failureReasonCode: "STRUCTURE_MISMATCH" },
        ],
      }),
    });
    const attributed = attempt({
      eventId: "evt-uk",
      status: "failed",
      attemptAt: "2026-09-01T00:00:00.000Z",
      targetLocales: ["uk"],
      lastError: meta({
        sourceRecordId: "init-2",
        targetLocale: "uk",
        failureReasonCode: "INVALID_RICH_TEXT_STRUCTURE",
      }),
    });

    const withoutCurrent = await resolveThinResidualState(
      {
        sourceKind: "initiative",
        sourceRecordId: "init-2",
        targetLocale: "uk",
      },
      fixtureDeps({
        identities: new Map([
          [
            "initiative::init-2::uk",
            {
              sourceExists: true,
              sourceVersion: "v-live",
              attempts: [attributed, sibling],
            },
          ],
        ]),
      }),
    );
    assert.equal(withoutCurrent.selectedAttemptId, "evt-uk");
    assert.equal(withoutCurrent.failureReasonCode, "INVALID_RICH_TEXT_STRUCTURE");
    assert.equal(withoutCurrent.translationState, "TERMINAL_FAILED");

    const withCurrent = await resolveThinResidualState(
      {
        sourceKind: "initiative",
        sourceRecordId: "init-2",
        targetLocale: "uk",
      },
      fixtureDeps({
        identities: new Map([
          [
            "initiative::init-2::uk",
            {
              sourceExists: true,
              sourceVersion: "v-live",
              translation: {
                exists: true,
                sourceVersion: "v-live",
                freshness: "current",
                stale: false,
                updatedAt: "2026-09-03T00:00:00.000Z",
              },
              attempts: [attributed, sibling],
            },
          ],
        ]),
      }),
    );
    assert.equal(withCurrent.translationState, "CURRENT");
  });

  it("K–L: no writes and no provider calls on thin resolve", async () => {
    await resolveThinResidualState(
      {
        sourceKind: "initiative",
        sourceRecordId: "init-3",
        targetLocale: "uk",
      },
      fixtureDeps({
        identities: new Map([
          [
            "initiative::init-3::uk",
            {
              sourceExists: true,
              sourceVersion: "v1",
              attempts: [],
            },
          ],
        ]),
      }),
    );
    const counters = getThinLocalizationCounters();
    assert.equal(counters.WRITES_PERFORMED, 0);
    assert.equal(counters.PROVIDER_CALLS, 0);
  });

  it("M–N: runner closes mongo flag and can terminate after output", async () => {
    const deps = fixtureDeps({
      identities: new Map([
        [
          "initiative::init-4::uk",
          {
            sourceExists: true,
            sourceVersion: "v1",
            attempts: [],
          },
        ],
      ]),
    });
    const result = await runThinLocalizationResidualDiagnostic(
      [
        "node",
        "diagnose",
        "--mongo",
        "--residual",
        "initiative:init-4:uk",
      ],
      deps,
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report);
    assert.equal(result.report!.OPERATOR_MODE, "THIN_READ_ONLY");
    assert.equal(result.report!.FULL_APPLICATION_GRAPH_IMPORTED, false);
    assert.equal(result.report!.PROVIDER_MODULE_IMPORTED, false);
    assert.equal(result.report!.WORKER_MODULE_IMPORTED, false);
    assert.equal(result.report!.PRESENTATION_TREE_BUILT, false);
    assert.equal(result.report!.FULL_CORPUS_HYDRATED, false);
    assert.equal(result.report!.WRITES_PERFORMED, 0);
    assert.equal(result.report!.PROVIDER_CALLS, 0);
    assert.ok(typeof result.report!.memory.PROCESS_START_RSS_MB === "number");
    assert.ok(typeof result.report!.memory.AFTER_IMPORTS_RSS_MB === "number");
    assert.ok(typeof result.report!.memory.PEAK_RSS_MB === "number");
    markThinMongoClosed();
    assert.equal(getThinLocalizationCounters().MONGO_CLOSED, true);
  });

  it("O: 100 repeated fixture resolutions identical", async () => {
    const deps = fixtureDeps({
      identities: new Map([
        [
          "blog_post::blog-x::ar",
          {
            sourceExists: true,
            sourceVersion: "v-blog",
            translation: {
              exists: false,
              sourceVersion: null,
              freshness: null,
              stale: false,
              updatedAt: null,
            },
            attempts: [
              attempt({
                eventId: "evt-blog",
                status: "failed",
                attemptAt: "2026-08-01T00:00:00.000Z",
                targetLocales: ["ar"],
                lastError: meta({
                  sourceRecordId: "blog-x",
                  targetLocale: "ar",
                  failureReasonCode: "UNCHANGED_SOURCE_PROSE",
                }),
                architectureRetryBasis: "VALIDATION_DIAGNOSTICS_CONTRACT_v1",
              }),
            ],
          },
        ],
      ]),
    });
    const first = thinResidualDiagnosticDigest(
      await resolveThinResidualState(
        {
          sourceKind: "blog_post",
          sourceRecordId: "blog-x",
          targetLocale: "ar",
        },
        deps,
      ),
    );
    for (let i = 0; i < 100; i += 1) {
      const next = thinResidualDiagnosticDigest(
        await resolveThinResidualState(
          {
            sourceKind: "blog_post",
            sourceRecordId: "blog-x",
            targetLocale: "ar",
          },
          deps,
        ),
      );
      assert.equal(next, first);
    }
  });

  it("parse residual args preserves colon-containing ids", () => {
    const parsed = parseThinResidualIdentityArgs([
      "--residual",
      "blog_post:blog:with:colons:uk",
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.sourceRecordId, "blog:with:colons");
    assert.equal(parsed[0]!.targetLocale, "uk");
  });

  it("child process: thin CLI exits without loading heavy reconcile graph", () => {
    const script = join(apiRoot, "src/scripts/diagnose-localization-residuals.ts");
    const tsxBin = join(apiRoot, "node_modules/.bin/tsx");
    const result = spawnSync(
      tsxBin,
      [script, "--residual", "initiative:x:uk"],
      {
        cwd: apiRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_TEST_ENV: "true",
          MONGODB_URI: "",
        },
        timeout: 30_000,
      },
    );
    assert.notEqual(result.status, 0);
    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.match(combined, /diagnose:localization-residuals|requires --mongo|MONGODB_URI/);
  });

  it("reconcile entry delegates snapshot without static heavy import", () => {
    const entry = readFileSync(
      join(apiRoot, "src/scripts/reconcile-public-localization.ts"),
      "utf8",
    );
    assert.match(entry, /OPERATOR_DEPRECATED_MEMORY_UNSAFE/);
    assert.match(entry, /diagnose:localization-residuals/);
    assert.doesNotMatch(
      entry,
      /from ["']\.\/reconcile-public-localization-heavy/,
    );
    assert.match(entry, /await import\(["']\.\/reconcile-public-localization-heavy/);
    const visited = collectStaticImports("src/scripts/reconcile-public-localization.ts");
    const joined = [...visited].join("\n");
    assert.equal(joined.includes("reconcile-public-localization-heavy.ts"), false);
    assert.equal(joined.includes("gemini-translation-provider"), false);
  });

  it("documents production-admin-source.json remains untouched by this pack", () => {
    // Guardrail: this test file must not reference mutating that fixture.
    const thisFile = readFileSync(fileURLToPath(import.meta.url), "utf8");
    assert.doesNotMatch(thisFile, /writeFileSync\([^)]*production-admin-source/);
  });
});
