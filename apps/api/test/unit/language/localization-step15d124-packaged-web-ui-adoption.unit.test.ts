/**
 * Step 15D.12.4 — Universal packaged WEB_UI catalog adoption into Activate Localization.
 * Deterministic. No Gemini. No staging/production writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { LanguageActivationJobRecord, WebUiMessageTree } from "@hu/types";

import {
  emptyPendingDomains,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  ensureWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import { loadPackagedWebUiCatalog } from "../../../src/modules/web-ui-message-packs/packaged-web-ui-catalog.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  unflattenWebUiMessageMap,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  loadBundledEnglishWebUiMessagePack,
  resetEnglishWebUiPathCacheForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const INCLUDE_PATHS = [
  "common.language",
  "common.save",
  "common.cancel",
  "common.loading",
  "common.error",
  "common.retry",
] as const;

function stubJob(locale: string, jobId = `job-${locale}`): LanguageActivationJobRecord {
  const stamp = "2026-09-25T12:00:00.000Z";
  return {
    jobId,
    locale,
    languageId: `lang-${locale}`,
    generation: 1,
    status: "running",
    domains: emptyPendingDomains(),
    lastError: null,
    diagnosticSummary: null,
    createdAt: stamp,
    updatedAt: stamp,
    startedAt: stamp,
    completedAt: null,
    createdByParticipantId: "admin-test",
    searchEnabledSnapshot: false,
    seoIndexingEnabledSnapshot: false,
  };
}

function projectPaths(
  source: Record<string, unknown>,
  paths: readonly string[],
  transform?: (value: string, pathKey: string) => string,
): WebUiMessageTree {
  const flat: Record<string, string> = {};
  for (const pathKey of paths) {
    let cursor: unknown = source;
    for (const segment of pathKey.split(".")) {
      if (cursor == null || typeof cursor !== "object") {
        cursor = undefined;
        break;
      }
      cursor = (cursor as Record<string, unknown>)[segment];
    }
    if (typeof cursor === "string") {
      flat[pathKey] = transform ? transform(cursor, pathKey) : cursor;
    }
  }
  return unflattenWebUiMessageMap(flat);
}

function breakPlaceholder(messages: WebUiMessageTree): WebUiMessageTree {
  const clone = structuredClone(messages) as Record<string, unknown>;
  const common = clone.common as Record<string, unknown> | undefined;
  if (common && typeof common.language === "string") {
    common.language = "{broken_placeholder_only";
  }
  return clone as WebUiMessageTree;
}

describe("Step 15D.12.4 packaged WEB_UI catalog adoption", () => {
  let providerCalls = 0;

  beforeEach(async () => {
    providerCalls = 0;
    resetEnglishWebUiPathCacheForTests();
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
  });

  afterEach(() => {
    resetEnglishWebUiPathCacheForTests();
  });

  async function registerLocale(locale: string) {
    await createLanguageRegistryRecord({
      locale,
      englishName: `Test ${locale}`,
      nativeName: locale,
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
  }

  it("1. valid packaged catalog + no published pack → adopted; Public+Participant READY; zero provider", async () => {
    const locale = "zz-AdoptValid";
    await registerLocale(locale);
    const packaged = loadPackagedWebUiCatalog("uk");
    assert.ok(packaged, "packaged uk catalog must exist in API assets");

    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale),
      deps: {
        loadPackagedWebUiCatalog: () => packaged,
        translator: async () => {
          providerCalls += 1;
          throw new Error("provider must not be called");
        },
      },
    });

    assert.equal(ensured.skipped, true);
    assert.equal(ensured.adoptedFromPackaged, true);
    assert.equal(ensured.checkpoint, null);
    assert.equal(ensured.webUi.dataReady, true);
    assert.equal(providerCalls, 0);

    const published = await getPublishedWebUiMessagePackByLocale(locale);
    assert.ok(published);
    assert.equal(published?.status, "published");
    assert.match(published?.sourceNote ?? "", /sourceHash=/);
    assert.match(published?.sourceNote ?? "", /packaged catalog adoption/);

    const publicReady = assessWebUiMessageTreeReadiness({
      messages: published!.messages,
      scope: "public",
    });
    const participantReady = assessWebUiMessageTreeReadiness({
      messages: published!.messages,
      scope: "participant",
    });
    assert.equal(publicReady.dataReady, true);
    assert.equal(participantReady.dataReady, true);
  });

  it("2. existing valid published pack → preserved/skipped (no re-adopt)", async () => {
    const locale = "zz-AdoptSkip";
    await registerLocale(locale);
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale,
      status: "published",
      messages: english as WebUiMessageTree,
      sourceNote: "pre-existing published",
    });
    const before = await getPublishedWebUiMessagePackByLocale(locale);
    assert.ok(before);

    let packagedLoads = 0;
    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale),
      deps: {
        loadPackagedWebUiCatalog: () => {
          packagedLoads += 1;
          return english as WebUiMessageTree;
        },
        translator: async () => {
          providerCalls += 1;
          throw new Error("provider must not be called");
        },
      },
    });

    assert.equal(ensured.skipped, true);
    assert.equal(ensured.adoptedFromPackaged, false);
    assert.equal(packagedLoads, 0);
    assert.equal(providerCalls, 0);
    const after = await getPublishedWebUiMessagePackByLocale(locale);
    assert.equal(after?.revision, before?.revision);
    assert.equal(after?.sourceNote, "pre-existing published");
  });

  it("3. incomplete packaged catalog → not published READY; provider path remains available", async () => {
    const locale = "zz-AdoptIncomplete";
    await registerLocale(locale);
    const english = loadBundledEnglishWebUiMessagePack() as Record<string, unknown>;
    const incomplete = projectPaths(english, INCLUDE_PATHS.slice(0, 2), (v) => `[x] ${v}`);

    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale),
      deps: {
        includePaths: INCLUDE_PATHS,
        loadPackagedWebUiCatalog: () => incomplete,
        translator: async () => {
          providerCalls += 1;
          throw new Error("should not run on ensure");
        },
      },
    });

    assert.equal(ensured.skipped, false);
    assert.ok(ensured.checkpoint);
    assert.equal(ensured.webUi.dataReady, false);
    assert.equal(providerCalls, 0);
    const published = await getPublishedWebUiMessagePackByLocale(locale);
    assert.equal(published, null);
  });

  it("4. structurally invalid packaged catalog → not published; provider path remains available", async () => {
    const locale = "zz-AdoptInvalid";
    await registerLocale(locale);
    const english = loadBundledEnglishWebUiMessagePack() as Record<string, unknown>;
    const invalid = breakPlaceholder(projectPaths(english, INCLUDE_PATHS, (v) => `[x] ${v}`));

    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale),
      deps: {
        includePaths: INCLUDE_PATHS,
        loadPackagedWebUiCatalog: () => invalid,
        translator: async () => {
          providerCalls += 1;
          throw new Error("should not run on ensure");
        },
      },
    });

    assert.equal(ensured.skipped, false);
    assert.ok(ensured.checkpoint);
    assert.equal(ensured.webUi.dataReady, false);
    assert.equal(providerCalls, 0);
    assert.equal(await getPublishedWebUiMessagePackByLocale(locale), null);
  });

  it("5. English sourceHash change → adopted catalog participates in rebase/currentness", async () => {
    const locale = "zz-AdoptRebase";
    await registerLocale(locale);
    const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(INCLUDE_PATHS);
    const sourceHash = hashWebUiEnglishFlatMap(flat);
    const packaged = projectPaths(
      loadBundledEnglishWebUiMessagePack() as Record<string, unknown>,
      requiredPaths,
      (v) => `[loc] ${v}`,
    );

    const adopted = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale, "job-rebase-1"),
      deps: {
        includePaths: INCLUDE_PATHS,
        loadPackagedWebUiCatalog: () => packaged,
      },
    });
    assert.equal(adopted.adoptedFromPackaged, true);
    const published = await getPublishedWebUiMessagePackByLocale(locale);
    assert.match(published?.sourceNote ?? "", new RegExp(`sourceHash=${sourceHash}`));

    // Existing checkpoint with stale hash must rebase under current English corpus.
    const expandedPaths = [...INCLUDE_PATHS, "common.backToHome", "common.show"] as const;
    const expanded = loadPublicWebUiEnglishCorpus(expandedPaths);
    const newHash = hashWebUiEnglishFlatMap(expanded.flat);
    assert.notEqual(newHash, sourceHash);

    await upsertWebUiActivationCheckpoint({
      checkpointId: "cp-stale-hash",
      jobId: "job-rebase-2",
      locale,
      generation: 1,
      sourceHash,
      terminologyMode: "live",
      phase: "primary",
      leafCount: requiredPaths.length,
      batchCount: 1,
      completedBatchCount: 0,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Test",
      nativeName: locale,
      textDirection: "ltr",
      detail: "stale",
      createdAt: "2026-09-25T12:00:00.000Z",
      updatedAt: "2026-09-25T12:00:00.000Z",
    });

    const rebased = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale, "job-rebase-2"),
      deps: {
        includePaths: expandedPaths,
        // Packaged still only covers the old subset → not re-adopted as READY.
        loadPackagedWebUiCatalog: () => packaged,
      },
    });
    assert.equal(rebased.skipped, false);
    assert.ok(rebased.checkpoint);
    assert.equal(rebased.checkpoint?.sourceHash, newHash);
    assert.equal(rebased.webUi.dataReady, false);
  });

  it("6. arbitrary Registry locale works without locale-specific eligibility code", async () => {
    const locale = "zz-Qqx";
    await registerLocale(locale);
    const { requiredPaths } = loadPublicWebUiEnglishCorpus(INCLUDE_PATHS);
    const packaged = projectPaths(
      loadBundledEnglishWebUiMessagePack() as Record<string, unknown>,
      requiredPaths,
      (v) => `·${v}`,
    );

    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale),
      deps: {
        includePaths: INCLUDE_PATHS,
        loadPackagedWebUiCatalog: (requested) => {
          assert.equal(requested, locale);
          return packaged;
        },
      },
    });
    assert.equal(ensured.adoptedFromPackaged, true);
    assert.equal(ensured.webUi.dataReady, true);
    assert.ok(await getPublishedWebUiMessagePackByLocale(locale));
  });

  it("7. CT/PLP gate stays blocked until authoritative WEB_UI READY", async () => {
    const locale = "zz-AdoptGate";
    await registerLocale(locale);
    const english = loadBundledEnglishWebUiMessagePack() as Record<string, unknown>;
    const incomplete = projectPaths(english, INCLUDE_PATHS.slice(0, 1), (v) => v);

    const ensured = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale),
      deps: {
        includePaths: INCLUDE_PATHS,
        loadPackagedWebUiCatalog: () => incomplete,
      },
    });

    assert.equal(ensured.webUi.dataReady, false);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: ensured.webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );

    // After a valid adopt, published Public+Participant READY unlocks the gate inputs.
    const full = projectPaths(english, INCLUDE_PATHS, (v) => `[ok] ${v}`);
    resetWebUiMessagePackStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    const ready = await ensureWebUiActivationCheckpoint({
      job: stubJob(locale, "job-gate-ready"),
      deps: {
        includePaths: INCLUDE_PATHS,
        loadPackagedWebUiCatalog: () => full,
      },
    });
    assert.equal(ready.webUi.dataReady, true);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: {
          ...ready.webUi,
          status: "ready",
          preparationPhase: "ready",
        },
        publicWebUiDataReady: true,
        participantWebUiDataReady: true,
      }),
      true,
    );
  });

  it("packaged assets load universally by locale tag (no allowlist)", () => {
    assert.ok(loadPackagedWebUiCatalog("en"));
    assert.ok(loadPackagedWebUiCatalog("uk"));
    assert.ok(loadPackagedWebUiCatalog("ar"));
    assert.ok(loadPackagedWebUiCatalog("zh-Hant"));
    assert.equal(loadPackagedWebUiCatalog("no-such-locale-xyz"), null);
  });
});
