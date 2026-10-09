/**
 * Map Closure 07 readiness → activation job domain progress slices.
 */

import type {
  LanguageActivationBrandDomainProgress,
  LanguageActivationControlledVocabularyDomainProgress,
  LanguageActivationHistoricalDomainProgress,
  LanguageActivationJobDomains,
  LanguageActivationJobStatus,
  LanguageActivationTerminologyDomainProgress,
  LanguageActivationWebUiDomainProgress,
  LanguageLocalizationReadinessReport,
} from "@hu/types";
import { isLocalizationSourceOriginalEntityType } from "@hu/types";

import type { LanguageOwnerPreparationResult } from "../../language-preparation/language-owner-preparation.js";
import { resolveEffectiveWebUiMessagePack } from "../../web-ui-message-packs/resolve-effective-web-ui-message-pack.js";
import {
  activationProviderCooldownDetail,
  computeActivationCooldownNextAttemptAt,
} from "../activation-provider-transient-recovery.js";
import { isLegacyPacingMisclassifiedTerminalFailure } from "../published-localized-presentation/universal/plp-auto-build-failure.js";
import {
  parsePlpRecoveryGeneration,
  PLP_MAX_RECOVERY_GENERATIONS,
} from "../published-localized-presentation/universal/plp-auto-build-work.repository.js";
import {
  aggregateTerminologyFailureDiagnostics,
  terminologyProviderDiagnosticFromReason,
} from "./terminology-activation-failure-diagnostic.js";

function emptyBrandDomain(): LanguageActivationBrandDomainProgress {
  return {
    status: "pending",
    preparationAttempted: false,
    fieldsPreserved: 0,
    fieldsGenerated: 0,
    fieldsFailed: 0,
    brandStatus: null,
    reviewRequired: false,
    providerFailure: false,
    detail: null,
  };
}

function emptyTerminologyDomain(): LanguageActivationTerminologyDomainProgress {
  return {
    status: "pending",
    preparationAttempted: false,
    conceptsPreserved: 0,
    conceptsGenerated: 0,
    conceptsFailed: 0,
    providerFailure: false,
    detail: null,
    providerDiagnostic: null,
  };
}

export function emptyPendingDomains(): LanguageActivationJobDomains {
  const historical = (): LanguageActivationHistoricalDomainProgress => ({
    status: "pending",
    remainingWorkItems: 0,
    current: 0,
    missing: 0,
    stale: 0,
    failed: 0,
    pending: 0,
    enqueueAttempted: false,
    enqueuedAt: null,
    detail: null,
  });
  return {
    brand: emptyBrandDomain(),
    terminology: emptyTerminologyDomain(),
    webUi: {
      status: "pending",
      dataReady: false,
      missingKeyCount: 0,
      emptyKeyCount: 0,
      requiredKeyCount: 0,
      effectiveSource: null,
      detail: null,
      preparationPhase: null,
      checkpointId: null,
      sourceHash: null,
      totalBatches: 0,
      completedBatches: 0,
      totalLeaves: 0,
      completedLeaves: 0,
      providerFailure: false,
    },
    controlledVocabulary: {
      status: "pending",
      presentationReady: false,
      conceptsChecked: 0,
      conceptsReady: 0,
      conceptsMissing: 0,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 0,
      missingConceptIds: [],
      detail: null,
    },
    ct: historical(),
    plp: historical(),
  };
}

export function brandDomainPreparing(): LanguageActivationBrandDomainProgress {
  return {
    ...emptyBrandDomain(),
    status: "in_progress",
    detail: "Preparing Brand…",
  };
}

export function terminologyDomainPreparing(): LanguageActivationTerminologyDomainProgress {
  return {
    ...emptyTerminologyDomain(),
    status: "in_progress",
    detail: "Preparing terminology…",
  };
}

export function brandDomainFromPreparationResult(
  result: LanguageOwnerPreparationResult,
  options?: {
    readonly previous?: LanguageActivationBrandDomainProgress | null;
    readonly nowIso?: string;
  },
): LanguageActivationBrandDomainProgress {
  const preserved = result.brand.outcomes.filter((row) => row.outcome === "preserved").length;
  const generated = result.brand.outcomes.filter((row) => row.outcome === "generated").length;
  const failed = result.brand.outcomes.filter((row) => row.outcome === "failed").length;
  const brandStatus =
    result.brand.status === "draft" ||
    result.brand.status === "approved" ||
    result.brand.status === "published"
      ? result.brand.status
      : null;
  const reviewRequired = brandStatus === "draft" || brandStatus === "approved";

  if (
    result.pacingDeferredUntil &&
    result.brand.outcomes.some((row) => row.outcome === "gap")
  ) {
    return {
      status: "in_progress",
      preparationAttempted: true,
      fieldsPreserved: preserved,
      fieldsGenerated: generated,
      fieldsFailed: 0,
      brandStatus,
      reviewRequired: false,
      providerFailure: false,
      detail: "Preparing Brand…",
      nextAttemptAt: result.pacingDeferredUntil,
      transientFailureCount: options?.previous?.transientFailureCount ?? 0,
      lastTransientFailure: null,
    };
  }

  if (result.transientFailure && result.brand.outcomes.some((row) => row.outcome === "gap")) {
    const streak = (options?.previous?.transientFailureCount ?? 0) + 1;
    const nowIso = options?.nowIso ?? new Date().toISOString();
    return {
      status: "in_progress",
      preparationAttempted: true,
      fieldsPreserved: preserved,
      fieldsGenerated: generated,
      fieldsFailed: 0,
      brandStatus,
      reviewRequired: false,
      providerFailure: false,
      detail: activationProviderCooldownDetail(result.transientFailure.kind),
      nextAttemptAt: computeActivationCooldownNextAttemptAt({
        nowIso,
        transientFailureCount: streak,
      }),
      transientFailureCount: streak,
      lastTransientFailure: result.transientFailure.kind,
    };
  }

  const providerFailure = failed > 0;
  if (providerFailure) {
    return {
      status: "failed",
      preparationAttempted: true,
      fieldsPreserved: preserved,
      fieldsGenerated: generated,
      fieldsFailed: failed,
      brandStatus,
      reviewRequired: false,
      providerFailure: true,
      detail: "Brand preparation failed — retry activation after the translation provider is available.",
      nextAttemptAt: null,
      transientFailureCount: 0,
      lastTransientFailure: null,
    };
  }
  return {
    status: "ready",
    preparationAttempted: true,
    fieldsPreserved: preserved,
    fieldsGenerated: generated,
    fieldsFailed: 0,
    brandStatus,
    reviewRequired,
    providerFailure: false,
    detail: reviewRequired
      ? "Brand prepared — review available"
      : brandStatus === "published"
        ? "Brand ready (published)."
        : "Brand ready.",
    nextAttemptAt: null,
    transientFailureCount: 0,
    lastTransientFailure: null,
  };
}

export function terminologyDomainFromPreparationResult(
  result: LanguageOwnerPreparationResult,
  options?: {
    readonly previous?: LanguageActivationTerminologyDomainProgress | null;
    readonly nowIso?: string;
  },
): LanguageActivationTerminologyDomainProgress {
  const preserved = result.terminology.outcomes.filter((row) => row.outcome === "preserved").length;
  const generated = result.terminology.outcomes.filter((row) => row.outcome === "generated").length;
  const failed = result.terminology.outcomes.filter((row) => row.outcome === "failed").length;
  const remainingGaps = result.terminology.outcomes.filter((row) => row.outcome === "gap").length;

  if (result.pacingDeferredUntil && remainingGaps > 0) {
    return {
      status: "in_progress",
      preparationAttempted: true,
      conceptsPreserved: preserved,
      conceptsGenerated: generated,
      conceptsFailed: failed,
      providerFailure: false,
      detail: "Preparing terminology…",
      providerDiagnostic: null,
      nextAttemptAt: result.pacingDeferredUntil,
      transientFailureCount: options?.previous?.transientFailureCount ?? 0,
      lastTransientFailure: null,
    };
  }

  if (result.transientFailure && remainingGaps > 0) {
    const streak = (options?.previous?.transientFailureCount ?? 0) + 1;
    const nowIso = options?.nowIso ?? new Date().toISOString();
    const diagnosticFromFailed = aggregateTerminologyFailureDiagnostics(
      result.terminology.outcomes,
    );
    const diagnostic =
      diagnosticFromFailed ??
      terminologyProviderDiagnosticFromReason(result.transientFailure.reason);
    return {
      status: "in_progress",
      preparationAttempted: true,
      conceptsPreserved: preserved,
      conceptsGenerated: generated,
      conceptsFailed: failed,
      providerFailure: false,
      detail: activationProviderCooldownDetail(result.transientFailure.kind),
      providerDiagnostic: diagnostic,
      nextAttemptAt: computeActivationCooldownNextAttemptAt({
        nowIso,
        transientFailureCount: streak,
      }),
      transientFailureCount: streak,
      lastTransientFailure: result.transientFailure.kind,
    };
  }

  if (failed > 0) {
    return {
      status: "failed",
      preparationAttempted: true,
      conceptsPreserved: preserved,
      conceptsGenerated: generated,
      conceptsFailed: failed,
      providerFailure: true,
      // Stable operator retry copy — do not replace; diagnostics live in providerDiagnostic.
      detail: "Terminology preparation failed — retry activation",
      providerDiagnostic: aggregateTerminologyFailureDiagnostics(result.terminology.outcomes),
      nextAttemptAt: null,
      transientFailureCount: 0,
      lastTransientFailure: null,
    };
  }
  return {
    status: "ready",
    preparationAttempted: true,
    conceptsPreserved: preserved,
    conceptsGenerated: generated,
    conceptsFailed: 0,
    providerFailure: false,
    detail: "Terminology ready",
    providerDiagnostic: null,
    nextAttemptAt: null,
    transientFailureCount: 0,
    lastTransientFailure: null,
  };
}

export function brandDomainProviderConfigFailure(
  message: string,
): LanguageActivationBrandDomainProgress {
  return {
    status: "failed",
    preparationAttempted: true,
    fieldsPreserved: 0,
    fieldsGenerated: 0,
    fieldsFailed: 0,
    brandStatus: null,
    reviewRequired: false,
    providerFailure: true,
    detail: `Brand preparation failed — ${message}`,
  };
}

export function terminologyDomainProviderConfigFailure(
  message: string,
): LanguageActivationTerminologyDomainProgress {
  return {
    status: "failed",
    preparationAttempted: true,
    conceptsPreserved: 0,
    conceptsGenerated: 0,
    conceptsFailed: 0,
    providerFailure: true,
    detail: `Terminology preparation failed — ${message}`,
    providerDiagnostic: terminologyProviderDiagnosticFromReason(message),
  };
}

export async function buildWebUiDomainProgress(
  readiness: LanguageLocalizationReadinessReport,
  previous?: LanguageActivationWebUiDomainProgress | null,
): Promise<LanguageActivationWebUiDomainProgress> {
  const effective = await resolveEffectiveWebUiMessagePack(readiness.locale);
  const dataReady = readiness.webUi.dataReady === true;
  // Active WEB_UI preparation (checkpoint) outranks measurement-only waiting.
  if (
    previous &&
    (previous.status === "in_progress" ||
      previous.preparationPhase === "primary" ||
      previous.preparationPhase === "quality" ||
      previous.preparationPhase === "validating" ||
      previous.preparationPhase === "publishing" ||
      previous.preparationPhase === "provider_cooldown" ||
      previous.preparationPhase === "structure_retry" ||
      previous.preparationPhase === "structure_blocked")
  ) {
    return {
      ...previous,
      missingKeyCount: readiness.webUi.missingKeyCount,
      emptyKeyCount: readiness.webUi.emptyKeyCount,
      requiredKeyCount: readiness.webUi.requiredKeyCount,
      effectiveSource: effective?.source ?? previous.effectiveSource,
      dataReady: false,
      status: "in_progress",
    };
  }
  if (previous?.preparationPhase === "failed" || previous?.providerFailure) {
    return {
      ...previous,
      missingKeyCount: readiness.webUi.missingKeyCount,
      emptyKeyCount: readiness.webUi.emptyKeyCount,
      requiredKeyCount: readiness.webUi.requiredKeyCount,
      effectiveSource: effective?.source ?? previous.effectiveSource,
      dataReady: false,
      status: "failed",
    };
  }
  if (previous?.preparationPhase === "ready" && !dataReady) {
    return {
      status: "pending",
      dataReady: false,
      missingKeyCount: readiness.webUi.missingKeyCount,
      emptyKeyCount: readiness.webUi.emptyKeyCount,
      requiredKeyCount: readiness.webUi.requiredKeyCount,
      effectiveSource: effective?.source ?? previous.effectiveSource,
      detail: `waiting_for_data missing=${readiness.webUi.missingKeyCount} empty=${readiness.webUi.emptyKeyCount} required=${readiness.webUi.requiredKeyCount} dataReady=false`,
      preparationPhase: "ready",
      checkpointId: previous.checkpointId ?? null,
      sourceHash: previous.sourceHash ?? null,
      totalBatches: previous.totalBatches ?? 0,
      completedBatches: previous.completedBatches ?? 0,
      totalLeaves: previous.totalLeaves ?? readiness.webUi.requiredKeyCount,
      completedLeaves: previous.completedLeaves ?? 0,
      providerFailure: false,
    };
  }
  if (previous?.preparationPhase === "ready" || dataReady) {
    return {
      status: "ready",
      dataReady: true,
      missingKeyCount: readiness.webUi.missingKeyCount,
      emptyKeyCount: readiness.webUi.emptyKeyCount,
      requiredKeyCount: readiness.webUi.requiredKeyCount,
      effectiveSource: effective?.source ?? "none",
      detail: previous?.detail ?? `Public WEB_UI ready via ${effective?.source ?? "unknown"}`,
      preparationPhase: previous?.preparationPhase ?? "ready",
      checkpointId: previous?.checkpointId ?? null,
      sourceHash: previous?.sourceHash ?? null,
      totalBatches: previous?.totalBatches ?? 0,
      completedBatches: previous?.completedBatches ?? 0,
      totalLeaves: previous?.totalLeaves ?? readiness.webUi.requiredKeyCount,
      completedLeaves: previous?.completedLeaves ?? readiness.webUi.requiredKeyCount,
      providerFailure: false,
    };
  }
  return {
    status: "waiting_for_data",
    dataReady: false,
    missingKeyCount: readiness.webUi.missingKeyCount,
    emptyKeyCount: readiness.webUi.emptyKeyCount,
    requiredKeyCount: readiness.webUi.requiredKeyCount,
    effectiveSource: effective?.source ?? "none",
    detail: `waiting_for_data missing=${readiness.webUi.missingKeyCount} empty=${readiness.webUi.emptyKeyCount} required=${readiness.webUi.requiredKeyCount} dataReady=false`,
    preparationPhase: null,
    checkpointId: null,
    sourceHash: null,
    totalBatches: 0,
    completedBatches: 0,
    totalLeaves: readiness.webUi.requiredKeyCount,
    completedLeaves: 0,
    providerFailure: false,
  };
}

/**
 * Authoritative WEB_UI READY gate for residual CT / Civic Media PLP enqueue.
 *
 * Residual historical work may start only after the current required WEB_UI
 * corpus is READY — not merely because preparation stopped (`pending`,
 * `waiting_for_data`, active phases, cooldown, or failed are never READY).
 *
 * Uses the existing domain + readiness contract (status/phase/dataReady and
 * measured Public + Participant catalog readiness). No parallel definition.
 */
export function isLanguageActivationWebUiReadyForHistoricalEnqueue(input: {
  readonly webUi: LanguageActivationWebUiDomainProgress;
  readonly publicWebUiDataReady: boolean;
  readonly participantWebUiDataReady: boolean;
}): boolean {
  const { webUi } = input;
  if (webUi.providerFailure) {
    return false;
  }
  if (webUi.status === "failed" || webUi.preparationPhase === "failed") {
    return false;
  }
  if (webUi.status !== "ready") {
    return false;
  }
  if (webUi.preparationPhase != null && webUi.preparationPhase !== "ready") {
    return false;
  }
  if (webUi.dataReady !== true) {
    return false;
  }
  if (input.publicWebUiDataReady !== true || input.participantWebUiDataReady !== true) {
    return false;
  }
  return true;
}

export function buildControlledVocabularyDomainProgress(
  readiness: LanguageLocalizationReadinessReport,
): LanguageActivationControlledVocabularyDomainProgress {
  const cv = readiness.controlledVocabulary;
  const ready =
    cv.conceptsWithTerminologyPreferredTerm + cv.conceptsWithWebUiFallbackOnly;
  const presentationReady = cv.presentationReady === true;
  const missingConceptIds = [...(cv.missingLocalizedLabelConceptIds ?? [])];
  return {
    status: presentationReady ? "ready" : "waiting_for_data",
    presentationReady,
    conceptsChecked: cv.conceptsChecked,
    conceptsReady: ready,
    conceptsMissing: cv.conceptsMissingLocalizedLabel,
    conceptsWithTerminologyPreferredTerm: cv.conceptsWithTerminologyPreferredTerm,
    conceptsWithWebUiFallbackOnly: cv.conceptsWithWebUiFallbackOnly,
    missingConceptIds,
    detail: presentationReady
      ? "Controlled vocabulary presentation-ready (Terminology preferredTerm outranks WEB_UI)."
      : `waiting_for_data missing=${cv.conceptsMissingLocalizedLabel} missingConcepts=[${missingConceptIds.join(", ")}] preferredTermCoverage=${cv.conceptsWithTerminologyPreferredTerm} presentationReady=false`,
  };
}

export function buildDiagnosticSummary(input: {
  readonly status: LanguageActivationJobStatus;
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly domains: LanguageActivationJobDomains;
}): string {
  const webUi = input.domains.webUi;
  const cv = input.domains.controlledVocabulary;
  const brand = input.domains.brand;
  const terminology = input.domains.terminology;
  const cvMissing =
    cv.missingConceptIds.length > 0
      ? `missing=${cv.conceptsMissing} missingConcepts=[${cv.missingConceptIds.join(", ")}]`
      : `missing=${cv.conceptsMissing}`;
  return [
    `job=${input.status}`,
    `readiness=${input.readiness.state}`,
    `languageDataReady=${input.readiness.languageDataReady}`,
    `brand=${brand.status}(generated=${brand.fieldsGenerated},reviewRequired=${brand.reviewRequired},providerFailure=${brand.providerFailure})`,
    `terminology=${terminology.status}(generated=${terminology.conceptsGenerated},providerFailure=${terminology.providerFailure})`,
    `webUi=${webUi.status}(phase=${webUi.preparationPhase ?? "none"},batches=${webUi.completedBatches}/${webUi.totalBatches},dataReady=${webUi.dataReady},providerFailure=${webUi.providerFailure})`,
    `cv=${cv.status}(${cvMissing},conceptsChecked=${cv.conceptsChecked},preferredTermCoverage=${cv.conceptsWithTerminologyPreferredTerm},presentationReady=${cv.presentationReady})`,
    `ctRemaining=${input.domains.ct.remainingWorkItems}`,
    `plpRemaining=${input.domains.plp.remainingWorkItems}`,
  ].join(" · ");
}

export function buildHistoricalDomainProgress(input: {
  readonly bucket: LanguageLocalizationReadinessReport["ct"];
  readonly enqueueAttempted: boolean;
  readonly enqueuedAt: string | null;
  readonly owner: "CT" | "PLP";
}): LanguageActivationHistoricalDomainProgress {
  const { bucket, enqueueAttempted, enqueuedAt, owner } = input;
  const remaining = bucket.workItemsRequired;
  let status: LanguageActivationHistoricalDomainProgress["status"] = "pending";
  let detail: string | null = null;

  if ((bucket.activeWork ?? 0) > 0 && remaining === 0 && bucket.failed === 0) {
    status = "in_progress";
    detail = `${owner} translations already queued or processing: ${bucket.activeWork}.`;
  } else if (
    (bucket.preflightBlocked ?? 0) > 0 &&
    remaining === 0 &&
    bucket.failed === 0
  ) {
    status = "pending";
    detail = `${owner} sources cannot currently be translated: ${bucket.preflightBlocked}.`;
  } else if (remaining === 0 && bucket.failed === 0) {
    status = enqueueAttempted ? "ready" : "skipped";
    detail =
      remaining === 0 && bucket.current > 0
        ? `${owner} CURRENT usable — no residual enqueue required.`
        : `${owner} has no residual work items.`;
  } else if (enqueueAttempted) {
    status = bucket.pending > 0 || remaining > 0 ? "enqueued" : "in_progress";
    detail = `${owner} residual enqueue attempted; remaining=${remaining}.`;
  } else if (remaining > 0) {
    status = "pending";
    detail = `${owner} residual work items required: ${remaining}.`;
  } else if (bucket.failed > 0) {
    status = "in_progress";
    detail = `${owner} blocked current-version translation failures: ${bucket.failed}.`;
  } else if (bucket.pending > 0) {
    status = "in_progress";
    detail = `${owner} translations already queued or processing: ${bucket.pending}.`;
  }

  return {
    status,
    remainingWorkItems: remaining,
    current: bucket.current,
    missing: bucket.missing,
    stale: bucket.stale,
    failed: bucket.failed,
    pending: bucket.pending,
    enqueueAttempted,
    enqueuedAt,
    detail,
  };
}

/**
 * Derive durable job lifecycle from measured readiness + enqueue flags.
 * Owner provider failures are not classified as ordinary waiting_for_data.
 * Brand review/publication never forces waiting_for_data.
 */
export type ActivationAutomaticProgress = "progress" | "exhausted" | "unspecified";

export const ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL =
  "Automatic localization cannot progress.";

export type ActivationPlpWorkProgressRow = {
  readonly status: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly retryable: boolean | null;
  readonly recoveryGeneration: string | null;
  readonly nextAttemptAt: string | null;
  readonly failureCode: string | null;
  readonly lastError: string | null;
  readonly entityType: string;
};

/**
 * Whether automatic CT/PLP work can still move.
 * Pending, running, pacing/cooldown, recovery windows, and the legacy
 * pacing-mislabel adoption stay "progress". A generation-capped real
 * provider failure with required work left is "exhausted".
 * CT failed with no actionable, pending, or active CT work is exhausted
 * when PLP has nothing left to run.
 */
export function classifyActivationAutomaticProgress(input: {
  readonly readiness: Pick<LanguageLocalizationReadinessReport, "ct" | "plpMedia">;
  readonly plpWork: readonly ActivationPlpWorkProgressRow[];
}): ActivationAutomaticProgress {
  if (
    input.readiness.ct.workItemsRequired > 0 ||
    input.readiness.ct.pending > 0 ||
    (input.readiness.ct.activeWork ?? 0) > 0
  ) {
    return "progress";
  }
  const ctTerminalOnly = input.readiness.ct.failed > 0;
  const plpRequired =
    input.readiness.plpMedia.workItemsRequired > 0 ||
    input.readiness.plpMedia.failed > 0 ||
    input.readiness.plpMedia.pending > 0;
  if (!plpRequired) {
    return ctTerminalOnly ? "exhausted" : "unspecified";
  }
  if (input.plpWork.length === 0) {
    return "unspecified";
  }
  for (const row of input.plpWork) {
    if (row.status === "pending" || row.status === "running") {
      return "progress";
    }
    if (row.status !== "failed") {
      continue;
    }
    if (
      isLegacyPacingMisclassifiedTerminalFailure({
        failureCode: row.failureCode,
        retryable: row.retryable,
        safeReason: row.lastError,
      })
    ) {
      return "progress";
    }
    const dueMs = row.nextAttemptAt ? Date.parse(row.nextAttemptAt) : Number.NaN;
    if (Number.isFinite(dueMs) && dueMs > Date.now()) {
      return "progress";
    }
    if (
      row.retryable === true &&
      row.attempts >= row.maxAttempts &&
      parsePlpRecoveryGeneration(row.recoveryGeneration) < PLP_MAX_RECOVERY_GENERATIONS &&
      !isLocalizationSourceOriginalEntityType(row.entityType)
    ) {
      return "progress";
    }
  }
  if (input.plpWork.some((row) => row.status === "failed")) {
    return "exhausted";
  }
  return "unspecified";
}

export function deriveActivationJobStatus(input: {
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly domains: LanguageActivationJobDomains;
  readonly ctEnqueueAttempted: boolean;
  readonly plpEnqueueAttempted: boolean;
  readonly automaticProgress?: ActivationAutomaticProgress;
}): LanguageActivationJobStatus {
  const { readiness, domains } = input;
  if (!readiness.engineReady) {
    return "failed";
  }
  if (
    domains.brand.status === "failed" ||
    domains.terminology.status === "failed" ||
    domains.webUi.status === "failed" ||
    domains.brand.providerFailure ||
    domains.terminology.providerFailure ||
    domains.webUi.providerFailure
  ) {
    return "failed";
  }
  if (
    domains.brand.status === "in_progress" ||
    domains.terminology.status === "in_progress" ||
    domains.webUi.status === "in_progress"
  ) {
    return "running";
  }
  // Claimed automatic WEB_UI/Terminology work is pending, not an external data blocker.
  if (
    domains.webUi.status === "pending" &&
    !domains.webUi.dataReady &&
    !domains.webUi.providerFailure &&
    domains.webUi.preparationPhase !== "failed" &&
    domains.webUi.preparationPhase !== "ready"
  ) {
    return "running";
  }
  if (
    domains.webUi.status === "waiting_for_data" ||
    domains.controlledVocabulary.status === "waiting_for_data"
  ) {
    return "waiting_for_data";
  }
  if (
    readiness.languageDataReady &&
    readiness.ct.workItemsRequired === 0 &&
    readiness.plpMedia.workItemsRequired === 0 &&
    readiness.ct.failed === 0 &&
    readiness.plpMedia.failed === 0 &&
    readiness.ct.pending === 0 &&
    readiness.plpMedia.pending === 0 &&
    (readiness.ct.activeWork ?? 0) === 0 &&
    (readiness.plpMedia.activeWork ?? 0) === 0 &&
    (readiness.ct.preflightBlocked ?? 0) === 0 &&
    (readiness.plpMedia.preflightBlocked ?? 0) === 0
  ) {
    return "completed";
  }
  const requiredRemains =
    readiness.ct.workItemsRequired > 0 ||
    readiness.plpMedia.workItemsRequired > 0 ||
    readiness.ct.failed > 0 ||
    readiness.plpMedia.failed > 0;
  const waitingBucket =
    readiness.ct.pending > 0 ||
    readiness.plpMedia.pending > 0 ||
    (readiness.ct.activeWork ?? 0) > 0 ||
    (readiness.plpMedia.activeWork ?? 0) > 0;
  if (
    input.automaticProgress === "exhausted" &&
    readiness.state !== "READY" &&
    requiredRemains &&
    !waitingBucket
  ) {
    return "failed";
  }
  if (input.ctEnqueueAttempted || input.plpEnqueueAttempted) {
    const blocked =
      readiness.ct.failed > 0 ||
      readiness.plpMedia.failed > 0 ||
      readiness.ct.pending > 0 ||
      readiness.plpMedia.pending > 0 ||
      (readiness.ct.activeWork ?? 0) > 0 ||
      (readiness.plpMedia.activeWork ?? 0) > 0 ||
      (readiness.ct.preflightBlocked ?? 0) > 0 ||
      (readiness.plpMedia.preflightBlocked ?? 0) > 0;
    return readiness.state === "BACKFILL_IN_PROGRESS" ||
      readiness.ct.workItemsRequired > 0 ||
      readiness.plpMedia.workItemsRequired > 0 ||
      blocked
      ? "running"
      : "completed";
  }
  return "running";
}
