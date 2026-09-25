/**
 * Step 15D.12.4.6 — Admin Terminology failure status presentation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  LanguageActivationAdminView,
  LanguageActivationJobRecord,
  LanguageActivationTerminologyDomainProgress,
  LanguageLocalizationReadinessReport,
} from "@hu/types";

import {
  formatActivationStatusLines,
  formatActivationWaitingGaps,
  formatOwnerPreparationProgress,
  formatTerminologyFailureStatusLines,
  formatTerminologyProviderDiagnosticSummary,
} from "./admin-languages-activation-status-format";

function emptyHistorical() {
  return {
    status: "pending" as const,
    remainingWorkItems: 0,
    current: 0,
    missing: 0,
    stale: 0,
    failed: 0,
    pending: 0,
    enqueueAttempted: false,
    enqueuedAt: null,
    detail: null,
  };
}

function failedTerminology(
  patch: Partial<LanguageActivationTerminologyDomainProgress> = {},
): LanguageActivationTerminologyDomainProgress {
  return {
    status: "failed",
    preparationAttempted: true,
    conceptsPreserved: 1,
    conceptsGenerated: 0,
    conceptsFailed: 23,
    providerFailure: true,
    detail: "Terminology preparation failed — retry activation",
    providerDiagnostic: {
      failureCodes: [{ code: "rate_limited", count: 23 }],
    },
    ...patch,
  };
}

function stubJob(
  terminology: LanguageActivationTerminologyDomainProgress = failedTerminology(),
): LanguageActivationJobRecord {
  const stamp = "2026-09-25T21:23:02.325Z";
  return {
    jobId: "lang-act-zh-hant-5-61b62bb3",
    locale: "zh-hant",
    languageId: "lang-zh-Hant",
    generation: 5,
    status: "failed",
    domains: {
      brand: {
        status: "ready",
        preparationAttempted: true,
        fieldsPreserved: 8,
        fieldsGenerated: 0,
        fieldsFailed: 0,
        brandStatus: "published",
        reviewRequired: false,
        providerFailure: false,
        detail: "Brand ready (published).",
      },
      terminology,
      webUi: {
        status: "waiting_for_data",
        dataReady: false,
        missingKeyCount: 2925,
        emptyKeyCount: 0,
        requiredKeyCount: 2925,
        effectiveSource: "none",
        detail: null,
        preparationPhase: null,
        checkpointId: null,
        sourceHash: null,
        totalBatches: 0,
        completedBatches: 0,
        totalLeaves: 2925,
        completedLeaves: 0,
        providerFailure: false,
      },
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
      ct: emptyHistorical(),
      plp: emptyHistorical(),
    },
    lastError: "Terminology preparation failed — retry activation",
    diagnosticSummary: null,
    createdAt: stamp,
    updatedAt: stamp,
    startedAt: stamp,
    completedAt: stamp,
    createdByParticipantId: "admin",
    searchEnabledSnapshot: false,
    seoIndexingEnabledSnapshot: false,
  };
}

function stubView(job: LanguageActivationJobRecord): LanguageActivationAdminView {
  return {
    job,
    readiness: {} as LanguageLocalizationReadinessReport,
    languageDataReady: false,
    searchReady: false,
    seoReady: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
    notes: [],
  };
}

describe("Step 15D.12.4.6 Admin Terminology failure status format", () => {
  it("rate_limited ×23 is displayed once in the combined failed status block", () => {
    const view = stubView(stubJob());
    const lines = formatActivationStatusLines(view);
    assert.deepEqual(lines, [
      "Brand ready (published).",
      "Terminology preparation failed — retry activation",
      "Terminology provider failure: rate_limited (23)",
    ]);
    assert.equal(
      lines.filter((line) => line.startsWith("Terminology provider failure:")).length,
      1,
    );
    assert.equal(
      lines.filter((line) => line.includes("Terminology preparation failed")).length,
      1,
    );
  });

  it("multiple diagnostic codes render safely", () => {
    const multi = failedTerminology({
      providerDiagnostic: {
        failureCodes: [
          { code: "rate_limited", count: 20 },
          { code: "timeout", count: 3 },
        ],
      },
    });
    assert.equal(
      formatTerminologyProviderDiagnosticSummary(multi),
      "rate_limited (20), timeout (3)",
    );
    assert.deepEqual(formatTerminologyFailureStatusLines(multi), [
      "Terminology preparation failed — retry activation",
      "Terminology provider failure: rate_limited (20), timeout (3)",
    ]);
  });

  it("no diagnostic preserves old output", () => {
    const view = stubView(stubJob(failedTerminology({ providerDiagnostic: null })));
    assert.deepEqual(formatActivationWaitingGaps(view), [
      "Terminology preparation failed — retry activation",
    ]);
    assert.deepEqual(formatActivationStatusLines(view), [
      "Brand ready (published).",
      "Terminology preparation failed — retry activation",
    ]);
  });

  it("raw provider text cannot be rendered through this path", () => {
    const poisoned = {
      ...failedTerminology({
        conceptsPreserved: 0,
        conceptsFailed: 1,
        providerDiagnostic: {
          failureCodes: [{ code: "unknown" as const, count: 1 }],
        },
      }),
      rawError: "Gemini body sk-secret-key AIzaSyLeak",
    };
    const lines = formatTerminologyFailureStatusLines(poisoned);
    const joined = lines.join("\n");
    assert.equal(joined.includes("sk-secret"), false);
    assert.equal(joined.includes("AIzaSy"), false);
    assert.equal(joined.includes("Gemini body"), false);
    assert.deepEqual(lines, [
      "Terminology preparation failed — retry activation",
      "Terminology provider failure: unknown (1)",
    ]);
  });

  it("diagnostic is not duplicated across owner progress + waiting gaps", () => {
    const view = stubView(stubJob());
    const owner = formatOwnerPreparationProgress(view);
    const gaps = formatActivationWaitingGaps(view);
    assert.equal(
      owner.some((line) => line.startsWith("Terminology provider failure:")),
      false,
    );
    assert.deepEqual(gaps, [
      "Terminology preparation failed — retry activation",
      "Terminology provider failure: rate_limited (23)",
    ]);
    const combined = formatActivationStatusLines(view);
    assert.equal(
      combined.filter((line) => line.startsWith("Terminology provider failure:")).length,
      1,
    );
  });
});
