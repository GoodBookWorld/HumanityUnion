/**
 * Map Closure 07 readiness → activation job domain progress slices.
 */

import type {
  LanguageActivationControlledVocabularyDomainProgress,
  LanguageActivationHistoricalDomainProgress,
  LanguageActivationJobDomains,
  LanguageActivationJobStatus,
  LanguageActivationWebUiDomainProgress,
  LanguageLocalizationReadinessReport,
} from "@hu/types";

import { resolveEffectiveWebUiMessagePack } from "../../web-ui-message-packs/resolve-effective-web-ui-message-pack.js";

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
    webUi: {
      status: "pending",
      dataReady: false,
      missingKeyCount: 0,
      emptyKeyCount: 0,
      requiredKeyCount: 0,
      effectiveSource: null,
      detail: null,
    },
    controlledVocabulary: {
      status: "pending",
      presentationReady: false,
      conceptsChecked: 0,
      conceptsReady: 0,
      conceptsMissing: 0,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 0,
      detail: null,
    },
    ct: historical(),
    plp: historical(),
  };
}

export async function buildWebUiDomainProgress(
  readiness: LanguageLocalizationReadinessReport,
): Promise<LanguageActivationWebUiDomainProgress> {
  const effective = await resolveEffectiveWebUiMessagePack(readiness.locale);
  const dataReady = readiness.webUi.dataReady === true;
  return {
    status: dataReady ? "ready" : "waiting_for_data",
    dataReady,
    missingKeyCount: readiness.webUi.missingKeyCount,
    emptyKeyCount: readiness.webUi.emptyKeyCount,
    requiredKeyCount: readiness.webUi.requiredKeyCount,
    effectiveSource: effective?.source ?? "none",
    detail: dataReady
      ? `Public WEB_UI ready via ${effective?.source ?? "unknown"}`
      : `Public WEB_UI waiting_for_data (missing=${readiness.webUi.missingKeyCount}, empty=${readiness.webUi.emptyKeyCount}). Import Admin pack or Terminology does not fill public WEB_UI chrome.`,
  };
}

export function buildControlledVocabularyDomainProgress(
  readiness: LanguageLocalizationReadinessReport,
): LanguageActivationControlledVocabularyDomainProgress {
  const cv = readiness.controlledVocabulary;
  const ready =
    cv.conceptsWithTerminologyPreferredTerm + cv.conceptsWithWebUiFallbackOnly;
  const presentationReady = cv.presentationReady === true;
  return {
    status: presentationReady ? "ready" : "waiting_for_data",
    presentationReady,
    conceptsChecked: cv.conceptsChecked,
    conceptsReady: ready,
    conceptsMissing: cv.conceptsMissingLocalizedLabel,
    conceptsWithTerminologyPreferredTerm: cv.conceptsWithTerminologyPreferredTerm,
    conceptsWithWebUiFallbackOnly: cv.conceptsWithWebUiFallbackOnly,
    detail: presentationReady
      ? "Controlled vocabulary presentation-ready (Terminology preferredTerm outranks WEB_UI)."
      : `Missing ${cv.conceptsMissingLocalizedLabel} concept label(s). Fill via Terminology preferredTerm and/or complete WEB_UI pack.`,
  };
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

  if (remaining === 0 && bucket.failed === 0) {
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
    detail = `${owner} live identities are not actionable: ${bucket.pending}.`;
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
 * Does not treat manual uiTranslationStatus as authority.
 */
export function deriveActivationJobStatus(input: {
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly domains: LanguageActivationJobDomains;
  readonly ctEnqueueAttempted: boolean;
  readonly plpEnqueueAttempted: boolean;
}): LanguageActivationJobStatus {
  const { readiness, domains } = input;
  if (!readiness.engineReady) {
    return "failed";
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
    readiness.plpMedia.pending === 0
  ) {
    return "completed";
  }
  if (input.ctEnqueueAttempted || input.plpEnqueueAttempted) {
    const blocked =
      readiness.ct.failed > 0 ||
      readiness.plpMedia.failed > 0 ||
      readiness.ct.pending > 0 ||
      readiness.plpMedia.pending > 0;
    return readiness.state === "BACKFILL_IN_PROGRESS" ||
      readiness.ct.workItemsRequired > 0 ||
      readiness.plpMedia.workItemsRequired > 0 ||
      blocked
      ? "running"
      : "completed";
  }
  return "running";
}

export function buildDiagnosticSummary(input: {
  readonly status: LanguageActivationJobStatus;
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly domains: LanguageActivationJobDomains;
}): string {
  return [
    `job=${input.status}`,
    `readiness=${input.readiness.state}`,
    `languageDataReady=${input.readiness.languageDataReady}`,
    `webUi=${input.domains.webUi.status}(missing=${input.domains.webUi.missingKeyCount})`,
    `cv=${input.domains.controlledVocabulary.status}(missing=${input.domains.controlledVocabulary.conceptsMissing})`,
    `ctRemaining=${input.domains.ct.remainingWorkItems}`,
    `plpRemaining=${input.domains.plp.remainingWorkItems}`,
  ].join(" · ");
}
