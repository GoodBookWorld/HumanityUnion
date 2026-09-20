/**
 * Async Admin language activation job — focused contract tests.
 * No Gemini/provider. Arbitrary Registry fixtures only (no shipped-locale hardcoding).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { emptyLanguageLocalizationCountBucket } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startAndProcessLanguageActivationJobForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { resetWebUiControlledLabelCacheForTests } from "../../../src/modules/language/controlled-lifecycle-web-ui-labels.js";
import { loadBundledEnglishWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

describe("Language activation async job", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    resetWebUiControlledLabelCacheForTests();
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-test",
    }));
    setLanguageActivationJobProcessDepsForTests(null);
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
  });

  async function createEligibleLocale(locale: string) {
    const created = await createLanguageRegistryRecord({
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
    return created;
  }

  function mockActivateNoOp() {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async (input) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
        });
        return {
          pack: "closure07",
          locale: input.locale,
          mode: "execute",
          readiness,
          plan: {
            pack: "closure07",
            locale: input.locale,
            mode: "execute",
            registryEligible: true,
            items: [],
            excluded: [],
            summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
            PROVIDER_CALLS: 0,
            WRITES_PERFORMED: 0,
          },
          execute: {
            attempted: true,
            ctKindsEnqueued: 0,
            plpEditorialEnqueued: false,
            notes: ["test activate no-op"],
          },
          PROVIDER_CALLS: 0,
          WRITES_PERFORMED: 0,
          seoIndexingEnabledUnchanged: true,
        };
      },
    });
  }

  it("1. arbitrary Registry locale can start activation", async () => {
    const record = await createEligibleLocale("eo");
    let activateCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async (input) => {
        activateCalls += 1;
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
        });
        return {
          pack: "closure07",
          locale: input.locale,
          mode: "execute",
          readiness,
          plan: {
            pack: "closure07",
            locale: input.locale,
            mode: "execute",
            registryEligible: true,
            items: [],
            excluded: [],
            summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
            PROVIDER_CALLS: 0,
            WRITES_PERFORMED: 0,
          },
          execute: {
            attempted: true,
            ctKindsEnqueued: 0,
            plpEditorialEnqueued: false,
            notes: [],
          },
          PROVIDER_CALLS: 0,
          WRITES_PERFORMED: 0,
          seoIndexingEnabledUnchanged: true,
        };
      },
    });

    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.ok(view.job);
    assert.equal(view.job?.locale, "eo");
    assert.ok(
      view.job?.status === "waiting_for_data" ||
        view.job?.status === "completed" ||
        view.job?.status === "running",
    );
    assert.equal(view.seoIndexingEnabled, false);
    assert.equal(view.searchEnabled, false);
    assert.equal(activateCalls, 1);
  });

  it("2. missing WEB_UI → waiting_for_data, not false READY", async () => {
    const record = await createEligibleLocale("ia");
    mockActivateNoOp();
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.job?.status, "waiting_for_data");
    assert.equal(view.languageDataReady, false);
    assert.equal(view.readiness.state, "DATA_NOT_READY");
    assert.ok((view.job?.domains.webUi.missingKeyCount ?? 0) > 0);
    assert.notEqual(view.readiness.state, "READY");
  });

  it("3. complete remote WEB_UI pack satisfies WEB_UI domain", async () => {
    const record = await createEligibleLocale("vo");
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "vo",
      status: "published",
      messages: english as never,
      sourceNote: "test complete pack",
    });
    mockActivateNoOp();
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.job?.domains.webUi.dataReady, true);
    assert.equal(view.job?.domains.webUi.status, "ready");
    assert.equal(view.job?.domains.webUi.effectiveSource, "remote");
    assert.notEqual(view.job?.status, "waiting_for_data");
  });

  it("4. Controlled Vocabulary resolves from Terminology / effective WEB_UI", async () => {
    const record = await createEligibleLocale("jv");
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "jv",
      status: "published",
      messages: english as never,
    });
    mockActivateNoOp();
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.ok(view.job?.domains.controlledVocabulary.conceptsChecked > 0);
    assert.equal(
      view.job?.domains.controlledVocabulary.status === "ready" ||
        view.job?.domains.controlledVocabulary.status === "waiting_for_data",
      true,
    );
  });

  it("5–6. first activation enqueues; explicit resume reconciles again", async () => {
    const record = await createEligibleLocale("sw");
    let residualCalls = 0;
    let plpCalls = 0;
    const ctBucket = {
      ...emptyLanguageLocalizationCountBucket(),
      missing: 2,
      workItemsRequired: 2,
    };
    const plpBucket = {
      ...emptyLanguageLocalizationCountBucket(),
      missing: 1,
      workItemsRequired: 1,
    };
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      evaluateReadiness: async (input) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        return evaluateLanguageLocalizationReadiness({
          ...input,
          skipCorpusPlan: true,
          ctCounts: ctBucket,
          plpCounts: plpBucket,
        });
      },
      activate: async (input) => {
        residualCalls += 1;
        plpCalls += 1;
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
          ctCounts: ctBucket,
          plpCounts: plpBucket,
        });
        return {
          pack: "closure07",
          locale: input.locale,
          mode: "execute",
          readiness,
          plan: {
            pack: "closure07",
            locale: input.locale,
            mode: "execute",
            registryEligible: true,
            items: [],
            excluded: [],
            summary: { ctWorkItems: 2, plpWorkItems: 1, skippedCurrent: 0 },
            PROVIDER_CALLS: 0,
            WRITES_PERFORMED: 0,
          },
          execute: {
            attempted: true,
            ctKindsEnqueued: 2,
            plpEditorialEnqueued: true,
            notes: ["test enqueue"],
          },
          PROVIDER_CALLS: 0,
          WRITES_PERFORMED: 3,
          seoIndexingEnabledUnchanged: true,
        };
      },
    });

    const first = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(first.job?.domains.ct.enqueueAttempted, true);
    assert.equal(first.job?.domains.plp.enqueueAttempted, true);
    assert.equal(residualCalls, 1);
    assert.equal(plpCalls, 1);

    const second = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(second.job?.jobId, first.job?.jobId);
    assert.equal(second.job?.domains.ct.enqueueAttempted, true);
    assert.equal(second.job?.domains.ct.enqueuedAt, first.job?.domains.ct.enqueuedAt);
    assert.equal(residualCalls, 2);
    assert.equal(plpCalls, 2);
  });

  it("7. repeat activation is idempotent/resumable", async () => {
    const record = await createEligibleLocale("fi");
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      runResidualRetry: async () =>
        ({ presentationsScheduled: 0, presentationsDeduped: 0 }) as never,
      enqueuePlpMediaConsumer: async () => {},
    });
    const a = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    const b = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(a.job?.jobId, b.job?.jobId);
    assert.ok(b.notes.some((n) => /idempotent|Resumed/i.test(n)));
  });

  it("8. disabled locale is rejected", async () => {
    const record = await createEligibleLocale("is");
    await updateLanguageRegistryRecord(record.languageId, {
      enabled: false,
      contentTranslationEnabled: false,
    });
    await assert.rejects(
      () =>
        startOrResumeLanguageActivationJob({
          actorUserId: "admin-1",
          languageId: record.languageId,
          scheduleProcess: false,
        }),
      /disabled/i,
    );
  });

  it("9. contentTranslationEnabled=false is rejected", async () => {
    const record = await createEligibleLocale("mt");
    await updateLanguageRegistryRecord(record.languageId, {
      contentTranslationEnabled: false,
    });
    await assert.rejects(
      () =>
        startOrResumeLanguageActivationJob({
          actorUserId: "admin-1",
          languageId: record.languageId,
          scheduleProcess: false,
        }),
      /contentTranslationEnabled/i,
    );
  });

  it("10. Search/SEO flags are unchanged", async () => {
    const record = await createEligibleLocale("eu");
    assert.equal(record.searchEnabled, false);
    assert.equal(record.seoIndexingEnabled, false);
    mockActivateNoOp();
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(view.searchEnabled, false);
    assert.equal(view.seoIndexingEnabled, false);
    assert.equal(view.job?.searchEnabledSnapshot, false);
    assert.equal(view.job?.seoIndexingEnabledSnapshot, false);
  });

  it("11. no locale hardcoding in activation job module", () => {
    const service = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(service, /\bka\b|\bhe\b|"uk"|"ar"|"zh-Hant"/);
  });

  it("12. no provider invoked synchronously in start path", async () => {
    const record = await createEligibleLocale("gl");
    let activateCalled = false;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async () => {
        activateCalled = true;
        throw new Error("should not run on start-only");
      },
    });
    const view = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(view.job?.status, "queued");
    assert.equal(activateCalled, false);
  });
});
