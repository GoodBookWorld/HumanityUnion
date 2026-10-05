/**
 * Step 15C.9 — every installed language always shows Localization status on
 * Languages visit / refresh / return. Hydration uses provider-free activation-
 * status only; Activate remains a mutation; running jobs auto-poll.
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
  LANGUAGE_ACTIVATION_POLL_INTERVAL_MS,
  shouldPollLanguageActivationJob,
} from "./admin-languages-activation-poll";
import {
  activationSlotsNeedingHydrateLoading,
  nextActivationSlotAfterHydrate,
  nextActivationSlotAfterHydrateError,
} from "./admin-languages-localization-hydrate";
import {
  localizationProgressFromActivation,
  localizationProgressFromReadiness,
  webUiLocalizationUnits,
} from "./admin-languages-localization-progress";

const here = path.dirname(fileURLToPath(import.meta.url));
const sectionSource = readFileSync(
  path.join(here, "components/AdminLanguagesSection.tsx"),
  "utf8",
);

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

function activationView(input: {
  readonly status?: LanguageActivationJobRecord["status"];
  readonly web?: Partial<LanguageActivationWebUiDomainProgress>;
  readonly job?: LanguageActivationJobRecord | null;
  readonly ctRemaining?: number;
  readonly plpRemaining?: number;
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
      searchEnabled: false,
      seoIndexingEnabled: false,
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
    participantWebUi: {
      engineReady: true,
      dataReady: true,
      requiredKeyCount: 0,
      missingKeyCount: 0,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: [],
    },
    controlledVocabulary: {
      presentationReady: false,
      conceptsChecked: 16,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 0,
      conceptsMissingLocalizedLabel: 16,
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
      current: 0,
      missing: input.ctRemaining ?? 0,
      stale: 0,
      invalid: 0,
      failed: 0,
      pending: 0,
      workItemsRequired: input.ctRemaining ?? 0,
    },
    plpMedia: {
      current: 0,
      missing: input.plpRemaining ?? 0,
      stale: 0,
      invalid: 0,
      failed: 0,
      pending: 0,
      workItemsRequired: input.plpRemaining ?? 0,
    },
    kindRows: [],
    seoReady: false,
    searchLocalizationReady: true,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: [],
  };
  if (input.job === null) {
    return {
      job: null,
      readiness,
      languageDataReady: dataReady,
      searchReady: true,
      seoReady: false,
      searchEnabled: false,
      seoIndexingEnabled: false,
      notes: [],
    };
  }
  const job: LanguageActivationJobRecord =
    input.job ??
    ({
      jobId: "job-1",
      locale: "ka",
      languageId: "lang-ka",
      generation: 1,
      status: input.status ?? "running",
      domains: {
        brand: {
          status: "ready",
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
          status: "ready",
          preparationAttempted: true,
          conceptsPreserved: 0,
          conceptsGenerated: 0,
          conceptsFailed: 0,
          providerFailure: false,
          detail: null,
        },
        webUi: webUi(input.web ?? {}),
        controlledVocabulary: {
          status: "waiting_for_data",
          presentationReady: false,
          conceptsChecked: 16,
          conceptsReady: 0,
          conceptsMissing: 16,
          conceptsWithTerminologyPreferredTerm: 0,
          conceptsWithWebUiFallbackOnly: 0,
          missingConceptIds: [],
          detail: null,
        },
        ct: {
          status: (input.ctRemaining ?? 0) === 0 ? "ready" : "pending",
          remainingWorkItems: input.ctRemaining ?? 0,
          current: 0,
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
          current: 0,
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
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    } satisfies LanguageActivationJobRecord);
  return {
    job,
    readiness,
    languageDataReady: dataReady,
    searchReady: true,
    seoReady: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
    notes: [],
  };
}

function hydrateEffectSource(): string {
  const start = sectionSource.indexOf(
    "Always-visible Localization status: hydrate every language",
  );
  const end = sectionSource.indexOf("}, [items]);", start);
  assert.ok(start > 0 && end > start, "hydrate effect must exist");
  return sectionSource.slice(start, end);
}

function pollEffectSource(): string {
  const start = sectionSource.indexOf("const pollingKey = pollingLanguageIds.join");
  const end = sectionSource.indexOf("}, [pollingKey]);", start);
  assert.ok(start > 0 && end > start, "poll effect must exist");
  return sectionSource.slice(start, end);
}

describe("Step 15C.9 always-visible language localization status", () => {
  it("1–3 every installed language hydrates Localization status without Activate", () => {
    const hydrate = hydrateEffectSource();
    assert.match(hydrate, /fetchAdminLanguageActivationStatus/);
    assert.doesNotMatch(hydrate, /activateAdminLanguageLocalization/);
    assert.doesNotMatch(hydrate, /fetchAdminLanguageLocalizationReadiness/);
    assert.match(hydrate, /nextActivationSlotAfterHydrate/);
    assert.match(sectionSource, /LocalizationProgressMeter/);
    assert.match(sectionSource, /activation === undefined/);
    assert.match(sectionSource, /Checking…/);
    assert.doesNotMatch(hydrate, /if \(current && current !== "error"\)/);
  });

  it("4–7 hard refresh / return restores durable progress (not 0%) including N/379", () => {
    const persisted = activationView({
      status: "running",
      web: { completedBatches: 110, totalBatches: 379, completedLeaves: 650, totalLeaves: 2240 },
    });
    const progress = localizationProgressFromActivation(persisted);
    assert.match(progress.phaseLabel, /110 \/ 379 batches/);
    assert.ok(progress.percent >= 28 && progress.percent <= 35, `got ${progress.percent}%`);
    assert.notEqual(progress.percent, 0);

    const applied = nextActivationSlotAfterHydrate({
      current: undefined,
      view: persisted,
      activateInFlight: false,
    });
    assert.equal(applied, persisted);
    assert.equal(
      localizationProgressFromActivation(applied as LanguageActivationAdminView).percent,
      progress.percent,
    );

    const staleZero = activationView({
      status: "running",
      web: { completedBatches: 0, totalBatches: 379 },
    });
    const refreshed = nextActivationSlotAfterHydrate({
      current: staleZero,
      view: persisted,
      activateInFlight: false,
    });
    assert.equal(
      localizationProgressFromActivation(refreshed as LanguageActivationAdminView).percent,
      progress.percent,
    );

    const units = webUiLocalizationUnits({
      webUi: webUi({ completedBatches: 110, totalBatches: 379, completedLeaves: 650 }),
      publishedRequired: 2240,
      publishedMissing: 2240,
      publishedDataReady: false,
    });
    assert.equal(units.done, 110);
    assert.equal(units.total, 379);
  });

  it("8–10 queued and running jobs automatically poll and advance via status reads", () => {
    assert.equal(shouldPollLanguageActivationJob("queued"), true);
    assert.equal(shouldPollLanguageActivationJob("running"), true);
    assert.ok(LANGUAGE_ACTIVATION_POLL_INTERVAL_MS >= 2000);
    assert.ok(LANGUAGE_ACTIVATION_POLL_INTERVAL_MS <= 5000);

    const poll = pollEffectSource();
    assert.match(poll, /fetchAdminLanguageActivationStatus/);
    assert.doesNotMatch(poll, /activateAdminLanguageLocalization/);
    assert.match(sectionSource, /shouldPollLanguageActivationJob\(value\.job\?\.status\)/);
    assert.match(sectionSource, /pollingKey/);

    const early = localizationProgressFromActivation(
      activationView({ web: { completedBatches: 42, totalBatches: 379 } }),
    );
    const later = localizationProgressFromActivation(
      activationView({ web: { completedBatches: 110, totalBatches: 379 } }),
    );
    assert.ok(later.percent > early.percent);
  });

  it("11–14 terminal and no-job states remain visible with Localization %", () => {
    const failed = localizationProgressFromActivation(
      activationView({
        status: "failed",
        web: {
          status: "failed",
          preparationPhase: "failed",
          completedBatches: 110,
          totalBatches: 379,
          providerFailure: true,
          detail: "Public interface translation failed — retry activation",
        },
      }),
    );
    assert.equal(failed.failed, true);
    assert.ok(failed.percent > 0);
    assert.match(failed.phaseLabel, /Failed — retry activation/);

    const baseCompleted = activationView({
      status: "completed",
      web: {
        status: "ready",
        dataReady: true,
        preparationPhase: "ready",
        completedBatches: 379,
        totalBatches: 379,
        missingKeyCount: 0,
      },
      ctRemaining: 0,
      plpRemaining: 0,
    });
    const completedReady = localizationProgressFromActivation({
      ...baseCompleted,
      job: {
        ...baseCompleted.job!,
        domains: {
          ...baseCompleted.job!.domains,
          controlledVocabulary: {
            status: "ready",
            presentationReady: true,
            conceptsChecked: 16,
            conceptsReady: 16,
            conceptsMissing: 0,
            conceptsWithTerminologyPreferredTerm: 16,
            conceptsWithWebUiFallbackOnly: 0,
            missingConceptIds: [],
            detail: null,
          },
        },
      },
    });
    assert.equal(completedReady.percent, 100);
    assert.match(completedReady.phaseLabel, /Ready/);

    const waiting = localizationProgressFromActivation(
      activationView({
        status: "waiting_for_data",
        web: {
          status: "waiting_for_data",
          preparationPhase: "primary",
          completedBatches: 50,
          totalBatches: 379,
        },
      }),
    );
    assert.ok(waiting.percent > 0);

    const noJob = activationView({
      job: null,
      web: { status: "pending", preparationPhase: null, completedBatches: 0, totalBatches: 0 },
    });
    const fromActivation = localizationProgressFromActivation(noJob);
    const fromReadiness = localizationProgressFromReadiness(noJob.readiness);
    assert.equal(typeof fromActivation.percent, "number");
    assert.equal(typeof fromReadiness.percent, "number");
    assert.match(sectionSource, /localizationProgressFromReadiness/);
  });

  it("15–18 Activate is mutation-only; page load never activates or needs Readiness", () => {
    const hydrate = hydrateEffectSource();
    assert.doesNotMatch(hydrate, /activateAdminLanguageLocalization/);
    assert.doesNotMatch(hydrate, /handleActivateLocalization/);
    assert.match(sectionSource, /handleActivateLocalization/);
    assert.match(sectionSource, /void handleActivateLocalization\(row\)/);

    const activateHandlerStart = sectionSource.indexOf("async function handleActivateLocalization");
    assert.ok(activateHandlerStart > 0);
    const activateHandler = sectionSource.slice(activateHandlerStart, activateHandlerStart + 900);
    assert.match(activateHandler, /activateAdminLanguageLocalization/);

    assert.doesNotMatch(hydrate, /fetchAdminLanguageLocalizationReadiness/);
    assert.match(sectionSource, /handleCheckReadiness/);

    assert.equal(
      nextActivationSlotAfterHydrate({
        current: "loading",
        view: activationView({ web: { completedBatches: 1 } }),
        activateInFlight: true,
      }),
      "loading",
    );
    assert.equal(
      nextActivationSlotAfterHydrateError({
        current: "loading",
        activateInFlight: true,
      }),
      "loading",
    );
  });

  it("19 Step 15C.8 batch-based progress calculation remains intact", () => {
    const units = webUiLocalizationUnits({
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
    assert.equal(units.done, 18);
    assert.equal(units.total, 379);
    const progress = localizationProgressFromActivation(
      activationView({
        web: { completedBatches: 18, totalBatches: 379, completedLeaves: 108 },
      }),
    );
    assert.match(progress.phaseLabel, /18 \/ 379 batches/);
  });

  it("20 hydrate helpers; page load never invokes Activate or Gemini", () => {
    assert.deepEqual(
      activationSlotsNeedingHydrateLoading(["a", "b", "c"], {
        a: undefined,
        b: "error",
        c: activationView({}),
      }),
      ["a", "b"],
    );
    const preserved = activationView({ web: { completedBatches: 42 } });
    assert.equal(
      nextActivationSlotAfterHydrateError({
        current: preserved,
        activateInFlight: false,
      }),
      preserved,
    );
    assert.equal(
      nextActivationSlotAfterHydrateError({
        current: undefined,
        activateInFlight: false,
      }),
      "error",
    );

    const hydrate = hydrateEffectSource();
    const poll = pollEffectSource();
    assert.doesNotMatch(hydrate, /activateAdminLanguageLocalization/);
    assert.doesNotMatch(poll, /activateAdminLanguageLocalization/);
    assert.doesNotMatch(hydrate, /\bgemini\b/i);
    assert.doesNotMatch(poll, /\bgemini\b/i);
    assert.match(sectionSource, /admin-languages-localization-hydrate/);
  });
});
