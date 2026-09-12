/**
 * Exact-record --force-current staging warm operator (no Mongo / no provider).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { StagingWarmCliValidationError } from "../../../src/modules/language/content-translation-staging-warm-operator-scope.js";
import {
  parseStagingWarmExactForceFromArgv,
  resolveExactRecordHydrateScopes,
  runStagingExactRecordForceCurrent,
  STAGING_EXACT_FORCE_MAX_LOCALES,
} from "../../../src/modules/language/content-translation-staging-warm-exact-force.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoApi = path.resolve(here, "../../../");

describe("Staging warm exact-record force-current", () => {
  it("A. exact-record mode bypasses broad discovery", async () => {
    let discoveryCalled = false;
    const result = await runStagingExactRecordForceCurrent({
      execute: false,
      sourceKind: "collaborative_analysis",
      sourceRecordId: "initiative-analysis-demo",
      locales: ["ar", "zh-Hant"],
      deps: {
        resolveLocales: async (raw) => raw as never,
        loadSource: async () => ({
          sourceKind: "collaborative_analysis",
          sourceRecordId: "initiative-analysis-demo",
          sourceVersion: "v-demo",
          sourceLanguage: "en",
          fields: { title: "T", summary: "S" },
          authorParticipantId: null,
          isPublished: true,
        }),
        auditLocale: async ({ targetLanguage }) => {
          discoveryCalled = discoveryCalled || false;
          return {
            sourceKind: "collaborative_analysis",
            sourceRecordId: "initiative-analysis-demo",
            targetLanguage,
            sourceVersion: "v-demo",
            state: "CURRENT",
          };
        },
        materialize: async () => {
          throw new Error("materialize must not run in dry-run");
        },
      },
    });

    assert.equal(result.broadDiscoveryBypassed, true);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.writes, 0);
    assert.equal(discoveryCalled, false);

    const scopes = resolveExactRecordHydrateScopes("collaborative_analysis");
    assert.equal(scopes.initiative, false);
    assert.equal(scopes.collaborativeAnalysis, true);
    assert.equal(scopes.collectiveDecision, false);

    const script = readFileSync(
      path.join(repoApi, "src/scripts/warm-staging-content-translations.ts"),
      "utf8",
    );
    assert.match(script, /runStagingExactRecordForceCurrent/);
    assert.match(script, /resolveExactRecordHydrateScopes/);
    assert.doesNotMatch(
      script.slice(
        script.indexOf("if (exactForce)"),
        script.indexOf("if (repair)"),
      ),
      /discoverStagingInitiativePathWarmSources|runStagingInitiativePathContentTranslationWarm|runStagingInitiativePathContentTranslationRepair/,
    );
  });

  it("B. force-current without sourceRecordId is rejected", () => {
    assert.throws(
      () =>
        parseStagingWarmExactForceFromArgv(
          ["node", "script", "--force-current", "--kinds=collaborative_analysis", "--locales=ar"],
          ["collaborative_analysis"],
        ),
      (error: unknown) =>
        error instanceof StagingWarmCliValidationError &&
        /source-record-id/.test(error.message),
    );
  });

  it("C. force-current without explicit locales is rejected", () => {
    assert.throws(
      () =>
        parseStagingWarmExactForceFromArgv(
          [
            "node",
            "script",
            "--force-current",
            "--kinds=collaborative_analysis",
            "--source-record-id=initiative-analysis-demo",
          ],
          ["collaborative_analysis"],
        ),
      (error: unknown) =>
        error instanceof StagingWarmCliValidationError && /locales=/.test(error.message),
    );
  });

  it("D. multiple kinds with force-current are rejected", () => {
    assert.throws(
      () =>
        parseStagingWarmExactForceFromArgv(
          [
            "node",
            "script",
            "--force-current",
            "--kinds=collaborative_analysis,initiative",
            "--source-record-id=initiative-analysis-demo",
            "--locales=ar",
          ],
          ["collaborative_analysis", "initiative"],
        ),
      (error: unknown) =>
        error instanceof StagingWarmCliValidationError && /exactly one/.test(error.message),
    );
  });

  it("E. CURRENT exact target becomes WOULD_FORCE_REBUILD in dry-run", async () => {
    const result = await runStagingExactRecordForceCurrent({
      execute: false,
      sourceKind: "collaborative_analysis",
      sourceRecordId: "initiative-analysis-demo",
      locales: ["ar"],
      deps: {
        resolveLocales: async () => ["ar"] as never,
        loadSource: async () => ({
          sourceKind: "collaborative_analysis",
          sourceRecordId: "initiative-analysis-demo",
          sourceVersion: "v-demo",
          sourceLanguage: "en",
          fields: { title: "T", summary: "S" },
          authorParticipantId: null,
          isPublished: true,
        }),
        auditLocale: async () => ({
          sourceKind: "collaborative_analysis",
          sourceRecordId: "initiative-analysis-demo",
          targetLanguage: "ar",
          sourceVersion: "v-demo",
          state: "CURRENT",
        }),
        materialize: async () => {
          throw new Error("dry-run must not materialize");
        },
      },
    });

    assert.equal(result.locales.length, 1);
    assert.equal(result.locales[0]?.state, "CURRENT");
    assert.equal(result.locales[0]?.action, "WOULD_FORCE_REBUILD");
  });

  it("F. dry-run performs zero provider calls/writes", async () => {
    let materializeCalls = 0;
    const result = await runStagingExactRecordForceCurrent({
      execute: false,
      sourceKind: "collaborative_analysis",
      sourceRecordId: "initiative-analysis-demo",
      locales: ["ar", "zh-Hant"],
      deps: {
        resolveLocales: async (raw) => raw as never,
        loadSource: async () => ({
          sourceKind: "collaborative_analysis",
          sourceRecordId: "initiative-analysis-demo",
          sourceVersion: "v-demo",
          sourceLanguage: "en",
          fields: { title: "T", summary: "S" },
          authorParticipantId: null,
          isPublished: true,
        }),
        auditLocale: async ({ targetLanguage }) => ({
          sourceKind: "collaborative_analysis",
          sourceRecordId: "initiative-analysis-demo",
          targetLanguage,
          sourceVersion: "v-demo",
          state: targetLanguage === "ar" ? "CURRENT" : "STALE",
        }),
        materialize: async () => {
          materializeCalls += 1;
          throw new Error("should not materialize");
        },
      },
    });

    assert.equal(materializeCalls, 0);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.writes, 0);
    assert.equal(result.mode, "dry-run");
  });

  it("G. only explicitly requested locales are targeted", async () => {
    const audited: string[] = [];
    const result = await runStagingExactRecordForceCurrent({
      execute: false,
      sourceKind: "collaborative_analysis",
      sourceRecordId: "initiative-analysis-demo",
      locales: ["ar", "zh-Hant"],
      deps: {
        resolveLocales: async (raw) => {
          assert.deepEqual([...raw], ["ar", "zh-Hant"]);
          return ["ar", "zh-Hant"] as never;
        },
        loadSource: async () => ({
          sourceKind: "collaborative_analysis",
          sourceRecordId: "initiative-analysis-demo",
          sourceVersion: "v-demo",
          sourceLanguage: "en",
          fields: { title: "T", summary: "S" },
          authorParticipantId: null,
          isPublished: true,
        }),
        auditLocale: async ({ targetLanguage }) => {
          audited.push(targetLanguage);
          return {
            sourceKind: "collaborative_analysis",
            sourceRecordId: "initiative-analysis-demo",
            targetLanguage,
            sourceVersion: "v-demo",
            state: "MISSING",
          };
        },
        materialize: async () => {
          throw new Error("dry-run");
        },
      },
    });

    assert.deepEqual(audited, ["ar", "zh-Hant"]);
    assert.deepEqual([...result.requestedLocales], ["ar", "zh-Hant"]);
    assert.equal(result.locales.every((row) => row.action === "WOULD_FORCE_REBUILD"), true);
  });

  it("H. arbitrary Registry-valid locale works without code branching", () => {
    const parsed = parseStagingWarmExactForceFromArgv(
      [
        "node",
        "script",
        "--force-current",
        "--kinds=collaborative_analysis",
        "--source-record-id=initiative-analysis-demo",
        "--locales=zz-Future,qq-Test",
      ],
      ["collaborative_analysis"],
    );
    assert.ok(parsed);
    assert.deepEqual([...parsed.locales], ["zz-Future", "qq-Test"]);

    const moduleSource = readFileSync(
      path.join(repoApi, "src/modules/language/content-translation-staging-warm-exact-force.ts"),
      "utf8",
    );
    assert.doesNotMatch(moduleSource, /locale\s*===\s*["'](ar|zh-Hant|uk)["']/);
    assert.doesNotMatch(moduleSource, /case\s+["']ar["']/);
    assert.match(moduleSource, /assertAutomaticContentTranslationTargetLocale/);
    assert.equal(STAGING_EXACT_FORCE_MAX_LOCALES, 10);
  });
});
