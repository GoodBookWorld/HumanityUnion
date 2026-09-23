/**
 * Step 15C.5 — localization progress is measured owner coverage, including
 * unpublished WEB_UI checkpoint batches. No provider calls.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  LanguageActivationAdminView,
  LanguageActivationJobRecord,
  LanguageActivationWebUiDomainProgress,
  LanguageLocalizationReadinessReport,
} from "@hu/types";

import {
  localizationProgressFromActivation,
  webUiLocalizationUnits,
} from "./admin-languages-localization-progress";
import {
  LANGUAGE_ACTIVATION_POLL_INTERVAL_MS,
  shouldPollLanguageActivationJob,
} from "./admin-languages-activation-poll";

const here = path.dirname(fileURLToPath(import.meta.url));

function webUi(
  patch: Partial<LanguageActivationWebUiDomainProgress>,
): LanguageActivationWebUiDomainProgress {
  return {
    status: "in_progress",
    dataReady: false,
    missingKeyCount: 2240,
    emptyKeyCount: 0,
    requiredKeyCount: 2240,
    effectiveSource: "none",
    detail: null,
    preparationPhase: "primary",
    checkpointId: "checkpoint-1",
    sourceHash: "hash",
    totalBatches: 379,
    completedBatches: 0,
    totalLeaves: 2240,
    completedLeaves: 0,
    providerFailure: false,
    ...patch,
  };
}

function view(input: {
  readonly status?: LanguageActivationJobRecord["status"];
  readonly web?: Partial<LanguageActivationWebUiDomainProgress>;
  readonly cvReady?: boolean;
  readonly cvChecked?: number;
  readonly cvMissing?: number;
  readonly ctCurrent?: number;
  readonly ctRemaining?: number;
  readonly plpCurrent?: number;
  readonly plpRemaining?: number;
  readonly searchEnabled?: boolean;
  readonly seoIndexingEnabled?: boolean;
  readonly knowledgeMissing?: number;
  readonly brandStatus?: LanguageActivationJobRecord["domains"]["brand"]["status"];
  readonly terminologyStatus?: LanguageActivationJobRecord["domains"]["terminology"]["status"];
}): LanguageActivationAdminView {
  const publishedMissing = input.web?.missingKeyCount ?? 2240;
  const publishedRequired = input.web?.requiredKeyCount ?? 2240;
  const dataReady = input.web?.dataReady === true;
  const readiness: LanguageLocalizationReadinessReport = {
    pack: "closure07",
    locale: "ka",
    languageId: "lang-ka",
    registry: {
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: input.searchEnabled === true,
      seoIndexingEnabled: input.seoIndexingEnabled === true,
      pwaPersistedReadingEnabled: false,
    },
    engineReady: true,
    languageDataReady: dataReady,
    state: dataReady ? "READY" : "DATA_NOT_READY",
    webUi: {
      engineReady: true,
      dataReady,
      requiredKeyCount: publishedRequired,
      missingKeyCount: dataReady ? 0 : publishedMissing,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: [],
    },
    controlledVocabulary: {
      presentationReady: input.cvReady === true,
      conceptsChecked: input.cvChecked ?? 16,
      conceptsWithTerminologyPreferredTerm: input.cvReady ? (input.cvChecked ?? 16) : 0,
      conceptsWithWebUiFallbackOnly: 0,
      conceptsMissingLocalizedLabel: input.cvMissing ?? (input.cvReady ? 0 : 16),
      missingLocalizedLabelConceptIds: [],
      missingPreferredTermGaps: [],
    },
    higherAuthority: { brandPublished: null, legalPublished: null, note: null },
    pwaCivic: {
      pwaPersistedReadingEnabled: false,
      pwaPersistedReadingReady: true,
      pwaCivicReadinessStatus: "READY",
      coverage: {
        current: 0,
        missing: 0,
        stale: 0,
        failed: 0,
        pending: 0,
        workItemsRequired: 0,
        measuredKindCount: 0,
        unmeasuredKindCount: 0,
        coverageMeasurement: "complete",
      },
      note: null,
    },
    ct: {
      current: input.ctCurrent ?? 0,
      missing: input.ctRemaining ?? 0,
      stale: 0,
      failed: 0,
      pending: 0,
      workItemsRequired: input.ctRemaining ?? 0,
    },
    plpMedia: {
      current: input.plpCurrent ?? 0,
      missing: input.plpRemaining ?? 0,
      stale: 0,
      failed: 0,
      pending: 0,
      workItemsRequired: input.plpRemaining ?? 0,
    },
    kindRows:
      (input.knowledgeMissing ?? 0) > 0
        ? [
            {
              kindId: "knowledge_article",
              ownership: "NO_TRANSLATION_OWNER",
              counts: null,
              note: "Article localization owner not implemented yet",
            },
          ]
        : [],
    seoReady: input.seoIndexingEnabled === true,
    searchLocalizationReady: true,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: [],
  };
  const job: LanguageActivationJobRecord = {
    jobId: "job-1",
    locale: "ka",
    languageId: "lang-ka",
    generation: 1,
    status: input.status ?? "running",
    domains: {
      brand: {
        status: input.brandStatus ?? "ready",
        preparationAttempted: true,
        fieldsPreserved: 0,
        fieldsGenerated: 0,
        fieldsFailed: 0,
        brandStatus: "draft",
        reviewRequired: false,
        providerFailure: false,
        detail: null,
      },
      terminology: {
        status: input.terminologyStatus ?? "ready",
        preparationAttempted: true,
        conceptsPreserved: 0,
        conceptsGenerated: 0,
        conceptsFailed: 0,
        providerFailure: false,
        detail: null,
      },
      webUi: webUi(input.web ?? {}),
      controlledVocabulary: {
        status: input.cvReady ? "ready" : "waiting_for_data",
        presentationReady: input.cvReady === true,
        conceptsChecked: input.cvChecked ?? 16,
        conceptsReady: input.cvReady ? (input.cvChecked ?? 16) : 0,
        conceptsMissing: input.cvMissing ?? (input.cvReady ? 0 : 16),
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 0,
        missingConceptIds: [],
        detail: null,
      },
      ct: {
        status: (input.ctRemaining ?? 0) === 0 ? "ready" : "pending",
        remainingWorkItems: input.ctRemaining ?? 0,
        current: input.ctCurrent ?? 0,
        missing: input.ctRemaining ?? 0,
        stale: 0,
        failed: 0,
        pending: 0,
        enqueueAttempted: false,
        enqueuedAt: null,
        detail: null,
      },
      plp: {
        status: (input.plpRemaining ?? 0) === 0 ? "ready" : "pending",
        remainingWorkItems: input.plpRemaining ?? 0,
        current: input.plpCurrent ?? 0,
        missing: input.plpRemaining ?? 0,
        stale: 0,
        failed: 0,
        pending: 0,
        enqueueAttempted: false,
        enqueuedAt: null,
        detail: null,
      },
    },
    lastError: null,
    diagnosticSummary: null,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    startedAt: "2026-09-21T00:00:00.000Z",
    completedAt: null,
    createdByParticipantId: null,
    searchEnabledSnapshot: input.searchEnabled === true,
    seoIndexingEnabledSnapshot: input.seoIndexingEnabled === true,
  };
  return {
    job,
    readiness,
    languageDataReady: dataReady,
    searchReady: true,
    seoReady: input.seoIndexingEnabled === true,
    searchEnabled: input.searchEnabled === true,
    seoIndexingEnabled: input.seoIndexingEnabled === true,
    notes: [],
  };
}

describe("Step 15C.5 localization live progress", () => {
  it("1–4 running checkpoint progress is visible and is not erased by Missing=2240", () => {
    const five = localizationProgressFromActivation(
      view({
        web: { completedBatches: 5, totalBatches: 379, completedLeaves: 0, totalLeaves: 2240 },
      }),
    );
    assert.match(five.phaseLabel, /5 \/ 379 batches/);
    assert.equal(five.failed, false);
    assert.ok(five.percent > 0);
    const units = webUiLocalizationUnits({
      webUi: webUi({ completedBatches: 5, completedLeaves: 0 }),
      publishedRequired: 2240,
      publishedMissing: 2240,
      publishedDataReady: false,
    });
    assert.equal(units.done, 5);
    assert.equal(units.total, 379);
    const twoHundred = localizationProgressFromActivation(
      view({
        web: { completedBatches: 200, totalBatches: 379, completedLeaves: 0, totalLeaves: 2240 },
      }),
    );
    assert.ok(twoHundred.percent > five.percent);
    // Estimated leaves must not override durable batch progress (21% vs ~8% flip).
    const withLeafEstimate = webUiLocalizationUnits({
      webUi: webUi({
        completedBatches: 18,
        totalBatches: 379,
        completedLeaves: 108,
        totalLeaves: 2240,
      }),
      publishedRequired: 2240,
      publishedMissing: 2240,
      publishedDataReady: false,
    });
    assert.equal(withLeafEstimate.done, 18);
    assert.equal(withLeafEstimate.total, 379);
  });

  it("5–7 quality, validating, and publishing phases keep checkpoint progress", () => {
    const quality = localizationProgressFromActivation(
      view({
        web: {
          preparationPhase: "quality",
          completedBatches: 379,
          completedLeaves: 2240,
          totalLeaves: 2240,
          missingKeyCount: 2240,
          dataReady: false,
        },
      }),
    );
    assert.equal(quality.phaseLabel, "Checking translation quality…");
    assert.ok(quality.percent > 0);
    const validating = localizationProgressFromActivation(
      view({ web: { preparationPhase: "validating", completedBatches: 379 } }),
    );
    assert.equal(validating.phaseLabel, "Validating public interface…");
    const publishing = localizationProgressFromActivation(
      view({ web: { preparationPhase: "publishing", completedBatches: 379 } }),
    );
    assert.equal(publishing.phaseLabel, "Publishing public interface…");
    const failed = localizationProgressFromActivation(
      view({
        status: "failed",
        web: {
          status: "failed",
          preparationPhase: "failed",
          providerFailure: true,
          completedBatches: 200,
          completedLeaves: 0,
        },
      }),
    );
    assert.equal(failed.failed, true);
    assert.equal(failed.phaseLabel, "Failed — retry activation");
    assert.ok(failed.percent > 0);
  });

  it("8–10 ready owners reach 100% without Knowledge, Search, or SEO", () => {
    const ready = localizationProgressFromActivation(
      view({
        status: "completed",
        cvReady: true,
        cvMissing: 0,
        ctCurrent: 59,
        ctRemaining: 0,
        plpCurrent: 4,
        plpRemaining: 0,
        web: {
          status: "ready",
          dataReady: true,
          preparationPhase: "ready",
          missingKeyCount: 0,
          completedBatches: 379,
          completedLeaves: 2240,
        },
        searchEnabled: false,
        seoIndexingEnabled: false,
        knowledgeMissing: 40,
      }),
    );
    assert.equal(ready.percent, 100);
    assert.equal(ready.phaseLabel, "Ready");
    const withFlags = localizationProgressFromActivation(
      view({
        status: "completed",
        cvReady: true,
        cvMissing: 0,
        ctCurrent: 59,
        ctRemaining: 0,
        plpCurrent: 4,
        plpRemaining: 0,
        web: {
          status: "ready",
          dataReady: true,
          preparationPhase: "ready",
          missingKeyCount: 0,
          completedBatches: 379,
          completedLeaves: 2240,
        },
        searchEnabled: true,
        seoIndexingEnabled: true,
        knowledgeMissing: 0,
      }),
    );
    assert.equal(withFlags.percent, ready.percent);
  });

  it("provider_cooldown shows waiting label and retry time, not Failed", () => {
    const withCooldown = localizationProgressFromActivation({
      ...view({
        status: "running",
        web: {
          status: "in_progress",
          preparationPhase: "primary",
          completedBatches: 360,
          totalBatches: 379,
        },
      }),
      job: {
        ...view({ status: "running" }).job!,
        status: "running",
        domains: {
          ...view({ status: "running" }).job!.domains,
          webUi: {
            ...webUi({
              completedBatches: 360,
              totalBatches: 379,
              preparationPhase: "provider_cooldown",
              providerFailure: false,
            }),
            nextAttemptAt: "2026-09-22T16:42:00.000Z",
            transientFailureCount: 1,
            lastTransientFailure: "rate_limited",
          },
        },
      },
    });
    assert.match(withCooldown.phaseLabel, /Waiting for translation provider/);
    assert.equal(withCooldown.failed, false);
    assert.equal(withCooldown.nextAttemptAt, "2026-09-22T16:42:00.000Z");
    assert.ok(withCooldown.percent > 80);
    assert.doesNotMatch(withCooldown.phaseLabel, /Failed/);
  });

  it("11–16 polling stays provider-free and the row shows progress plus readiness detail", () => {
    assert.equal(shouldPollLanguageActivationJob("queued"), true);
    assert.equal(shouldPollLanguageActivationJob("running"), true);
    assert.equal(shouldPollLanguageActivationJob("completed"), false);
    assert.equal(shouldPollLanguageActivationJob("failed"), false);
    assert.equal(shouldPollLanguageActivationJob("waiting_for_data"), false);
    assert.ok(LANGUAGE_ACTIVATION_POLL_INTERVAL_MS >= 2000);
    assert.ok(LANGUAGE_ACTIVATION_POLL_INTERVAL_MS <= 5000);

    const section = readFileSync(path.join(here, "components/AdminLanguagesSection.tsx"), "utf8");
    const pollStart = section.indexOf("const pollingKey = pollingLanguageIds.join");
    const pollEnd = section.indexOf("}, [pollingKey]);", pollStart);
    const poll = section.slice(pollStart, pollEnd);
    assert.match(poll, /fetchAdminLanguageActivationStatus/);
    assert.doesNotMatch(poll, /activateAdminLanguageLocalization/);
    assert.match(section, /LocalizationProgressMeter/);
    assert.match(section, /localizationProgressFromActivation/);
    assert.match(section, /Localization activation/);
    assert.match(section, /Public interface:/);
    assert.match(section, /fetchAdminLanguageLocalizationReadiness\(row\.languageId\)/);
    const loadStart = section.indexOf(
      "Always-visible Localization status: hydrate every language",
    );
    const loadEnd = section.indexOf("}, [items]);", loadStart);
    const load = section.slice(loadStart, loadEnd);
    assert.match(load, /fetchAdminLanguageActivationStatus/);
    assert.doesNotMatch(load, /activateAdminLanguageLocalization/);
    assert.match(load, /nextActivationSlotAfterHydrate/);
    assert.doesNotMatch(load, /if \(current && current !== "error"\)/);
  });
});
