/**
 * Admin Languages — operator-facing activation status lines.
 * Presentation only. Renders allowlisted providerDiagnostic codes; never raw provider text.
 */

import type {
  LanguageActivationAdminView,
  LanguageActivationTerminologyDomainProgress,
} from "@hu/types";

/** Sanitized summary from durable providerDiagnostic, e.g. `rate_limited (23)`. */
export function formatTerminologyProviderDiagnosticSummary(
  terminology: LanguageActivationTerminologyDomainProgress | null | undefined,
): string | null {
  const codes = terminology?.providerDiagnostic?.failureCodes;
  if (!codes || codes.length === 0) {
    return null;
  }
  return codes.map((row) => `${row.code} (${row.count})`).join(", ");
}

/**
 * Failed Terminology status lines for Admin.
 * Always includes the stable retry detail; appends sanitized diagnostic when present.
 */
export function formatTerminologyFailureStatusLines(
  terminology: LanguageActivationTerminologyDomainProgress | null | undefined,
): string[] {
  if (!terminology || terminology.status !== "failed") {
    return [];
  }
  const lines: string[] = [
    terminology.detail ?? "Terminology preparation failed — retry activation",
  ];
  const diagnosticSummary = formatTerminologyProviderDiagnosticSummary(terminology);
  if (diagnosticSummary) {
    lines.push(`Terminology provider failure: ${diagnosticSummary}`);
  }
  return lines;
}

/**
 * Operator-facing Brand / Terminology / WEB_UI phase lines from the activation job.
 * When the overall job is already `failed` due to Terminology providerFailure,
 * Terminology failure lines are owned by {@link formatActivationWaitingGaps}
 * so the visible status block does not duplicate them.
 */
export function formatOwnerPreparationProgress(
  view: LanguageActivationAdminView,
): string[] {
  const job = view.job;
  if (!job) {
    return [];
  }
  const lines: string[] = [];
  const brand = job.domains.brand;
  if (brand?.status === "in_progress") {
    lines.push(brand.detail ?? "Preparing Brand…");
  } else if (brand?.status === "failed") {
    lines.push(brand.detail ?? "Brand preparation failed — retry activation");
  } else if (brand?.status === "ready") {
    lines.push(
      brand.reviewRequired
        ? "Brand prepared — review available"
        : brand.detail ?? "Brand ready",
    );
  }
  const terminology = job.domains.terminology;
  if (terminology?.status === "in_progress") {
    lines.push(terminology.detail ?? "Preparing terminology…");
  } else if (terminology?.status === "failed") {
    const deferredToWaitingGaps =
      job.status === "failed" && terminology.providerFailure === true;
    if (!deferredToWaitingGaps) {
      lines.push(...formatTerminologyFailureStatusLines(terminology));
    }
  } else if (terminology?.status === "ready") {
    lines.push(terminology.detail ?? "Terminology ready");
  }
  const webUi = job.domains.webUi;
  if (webUi.status === "failed" || webUi.providerFailure) {
    // Detailed WEB_UI failure is shown once in LanguageReadinessDetails.
  } else if (
    webUi.status === "pending" &&
    (job.status === "running" || job.status === "queued") &&
    job.domains.brand?.status !== "in_progress" &&
    job.domains.terminology?.status !== "in_progress"
  ) {
    lines.push(webUi.detail ?? "Preparing public interface…");
  } else if (webUi.status === "in_progress" || webUi.preparationPhase) {
    if (webUi.preparationPhase === "provider_cooldown") {
      lines.push(webUi.detail ?? "Waiting for translation provider…");
    } else if (webUi.preparationPhase === "quality") {
      lines.push(
        webUi.detail ??
          `Checking translation quality… ${webUi.completedBatches} / ${webUi.totalBatches}`,
      );
    } else if (
      webUi.preparationPhase === "validating" ||
      webUi.preparationPhase === "publishing"
    ) {
      lines.push(webUi.detail ?? "Validating…");
    } else if (webUi.preparationPhase === "ready") {
      lines.push(webUi.detail ?? "Public interface ready");
    } else if (webUi.preparationPhase === "primary" || webUi.status === "in_progress") {
      const completed = webUi.completedLeaves || webUi.completedBatches;
      const total = webUi.totalLeaves || webUi.totalBatches;
      lines.push(
        webUi.detail ??
          (total > 0
            ? `Preparing public interface… ${completed} / ${total}`
            : "Preparing public interface…"),
      );
    }
  } else if (webUi.status === "ready" && webUi.dataReady) {
    lines.push(webUi.detail ?? "Public interface ready");
  }
  return lines;
}

/**
 * Operator-facing blockers when activation is waiting on prepared data,
 * or when Brand/Terminology providerFailure failed the job.
 */
export function formatActivationWaitingGaps(view: LanguageActivationAdminView): string[] {
  const lines: string[] = [];
  const job = view.job;
  if (!job) {
    return lines;
  }
  if (job.status === "failed") {
    if (job.domains.terminology?.providerFailure) {
      return formatTerminologyFailureStatusLines(job.domains.terminology);
    }
    if (job.domains.brand?.providerFailure) {
      return [
        job.domains.brand.detail ??
          "Localization preparation failed — retry activation after the translation provider is available.",
      ];
    }
    return lines;
  }
  if (job.status !== "waiting_for_data") {
    return lines;
  }
  const webUi = job.domains.webUi;
  if (webUi.status === "waiting_for_data") {
    lines.push(
      `Public interface catalog is blocking: missing ${webUi.missingKeyCount} of ${webUi.requiredKeyCount} required strings` +
        (webUi.emptyKeyCount > 0 ? ` (${webUi.emptyKeyCount} empty).` : "."),
    );
  }
  const cv = job.domains.controlledVocabulary;
  if (cv.status === "waiting_for_data") {
    const ids =
      cv.missingConceptIds.length > 0
        ? ` Missing concepts: ${cv.missingConceptIds.join(", ")}.`
        : "";
    lines.push(
      `Controlled Vocabulary is blocking: ${cv.conceptsMissing} of ${cv.conceptsChecked} concepts still need a localized label.${ids}`,
    );
  }
  if (lines.length > 0) {
    lines.push("This is data preparation, not a translation-provider failure.");
  }
  return lines;
}

/**
 * Combined visible status lines for the Admin localization details block
 * (owner preparation + waiting/failed gaps), with Terminology failure shown once.
 */
export function formatActivationStatusLines(view: LanguageActivationAdminView): string[] {
  return [...formatOwnerPreparationProgress(view), ...formatActivationWaitingGaps(view)];
}
