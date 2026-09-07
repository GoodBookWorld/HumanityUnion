/**
 * RESET 05C.2 — read-only durable PLP auto-build failure diagnostic.
 * No Gemini / live Mongo writes / retry / materialize.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  inspectPlpAutoBuildFailedWork,
  listFailedPlpAutoBuildWork,
  markPlpAutoBuildWorkFailed,
  normalizePlpAutoBuildFailureClass,
  PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/universal/index.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

beforeEach(() => {
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
});

afterEach(() => {
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
});

describe("RESET 05C.2 — PLP auto-build failure diagnostic", () => {
  it("normalizes safe failure classes without inventing secrets", () => {
    assert.equal(normalizePlpAutoBuildFailureClass("FAILED"), "FAILED");
    assert.equal(
      normalizePlpAutoBuildFailureClass("PROCESSOR_DORMANT"),
      "PROCESSOR_DORMANT",
    );
    assert.equal(
      normalizePlpAutoBuildFailureClass("PLP auto-build provider timed out after 60000ms"),
      "PROVIDER_TIMEOUT",
    );
    assert.equal(
      normalizePlpAutoBuildFailureClass("REJECTED_PARTIAL"),
      "REJECTED_PARTIAL",
    );
    assert.equal(normalizePlpAutoBuildFailureClass(null), "UNKNOWN");
  });

  it("lists failed rows only and hard-bounds the result set", async () => {
    for (let i = 0; i < 25; i += 1) {
      const upsert = await upsertPendingPlpAutoBuildWork({
        entityType: "public_news",
        entityId: `news-fail-${i}`,
        locale: "uk",
        canonicalVersion: `v-${i}`,
        contentRevision: 1,
        trigger: "DYNAMIC_SOURCE_REFRESH",
      });
      await markPlpAutoBuildWorkFailed({
        workKey: upsert.record.workKey,
        reason: i % 2 === 0 ? "FAILED" : "PROVIDER_TIMEOUT",
        attempts: 5,
        maxAttempts: 5,
      });
    }

    // Also seed a completed row that must not appear.
    await upsertPendingPlpAutoBuildWork({
      entityType: "public_news",
      entityId: "news-ok",
      locale: "uk",
      canonicalVersion: "v-ok",
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });

    const listed = await listFailedPlpAutoBuildWork({ limit: 99 });
    assert.equal(listed.length, PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT);
    assert.ok(listed.every((row) => row.status === "failed"));
    assert.ok(listed.every((row) => row.entityId !== "news-ok"));
  });

  it("inspect is read-only: zero provider/plp/mongo write counters; summary present", async () => {
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: "public_news",
      entityId: "news-diag-1",
      locale: "uk",
      canonicalVersion: "canon-a",
      contentRevision: 1,
      trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
    });
    await markPlpAutoBuildWorkFailed({
      workKey: upsert.record.workKey,
      reason: "FAILED",
      attempts: 5,
      maxAttempts: 5,
    });

    const report = await inspectPlpAutoBuildFailedWork({
      limit: 20,
      deps: {
        listFailed: async ({ limit }) => listFailedPlpAutoBuildWork({ limit }),
        resolveLive: async () => ({
          liveCanonicalVersion: "canon-a",
          canonicalPresentation: { title: "t" },
          localizationSchemaVersion: "PLP.2",
        }),
        findCurrent: async () => null,
      },
    });

    assert.equal(report.readOnly, true);
    assert.equal(report.PROVIDER_CALLS, 0);
    assert.equal(report.PLP_WRITES, 0);
    assert.equal(report.MONGO_WRITES, 0);
    assert.equal(report.ROWS_RETURNED, 1);
    assert.equal(report.FAILURE_CLASSES.FAILED, 1);
    assert.equal(report.CURRENT_VERSION_FAILURES, 1);
    assert.equal(report.STALE_VERSION_FAILURES, 0);
    assert.equal(report.STILL_MISSING, 1);
    assert.equal(report.NOW_USABLE, 0);
    assert.equal(report.rows[0]?.entityId, "news-diag-1");
    assert.equal(report.rows[0]?.failureCode, "FAILED");
    assert.equal(report.rows[0]?.canonicalVersionMatchesLive, true);
    assert.equal(report.rows[0]?.nextAttemptAt, null);
    assert.doesNotMatch(JSON.stringify(report), /mongodb(\+srv)?:\/\//i);
    assert.doesNotMatch(JSON.stringify(report), /GEMINI_API_KEY|MONGODB_URI/);
  });

  it("classifies NOW_USABLE when a usable snapshot already exists", async () => {
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: "public_news",
      entityId: "news-now-usable",
      locale: "uk",
      canonicalVersion: "canon-b",
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });
    await markPlpAutoBuildWorkFailed({
      workKey: upsert.record.workKey,
      reason: "FAILED",
      attempts: 5,
      maxAttempts: 5,
    });

    const report = await inspectPlpAutoBuildFailedWork({
      limit: 5,
      deps: {
        resolveLive: async () => ({
          liveCanonicalVersion: "canon-b",
          canonicalPresentation: null,
          localizationSchemaVersion: "PLP.2",
        }),
        findCurrent: async () =>
          ({
            state: "PUBLISHED",
            identity: {
              entityType: "public_news",
              entityId: "news-now-usable",
              locale: "uk",
              canonicalVersion: "canon-b",
              localizationSchemaVersion: "PLP.2",
            },
            presentation: { title: "[uk] t", summary: "[uk] s" },
          }) as never,
      },
    });

    assert.equal(report.NOW_USABLE, 1);
    assert.equal(report.STILL_MISSING, 0);
    assert.equal(report.rows[0]?.usablePlpSnapshotExists, true);
  });

  it("script documents --failed --limit and stays free of write/provider imports", () => {
    const script = readFileSync(
      join(apiRoot, "src/scripts/diagnose-plp-auto-build-work.ts"),
      "utf8",
    );
    assert.match(script, /--failed/);
    assert.match(script, /--limit/);
    assert.match(script, /inspectPlpAutoBuildFailedWork/);
    assert.doesNotMatch(script, /materialize|Gemini|generateContent/);
    assert.match(script, /readOnly:\s*true/);
  });
});
