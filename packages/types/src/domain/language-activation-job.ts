/**
 * Durable Admin language localization activation job (one Registry locale).
 * Parent orchestration only — CT/PLP materialization stays on existing queues.
 * Never invokes TranslationProvider / Gemini on Admin HTTP or status read.
 */

import type { LanguageLocalizationReadinessReport } from "./language-localization-readiness.js";

export type LanguageActivationJobStatus =
  | "queued"
  | "running"
  | "waiting_for_data"
  | "completed"
  | "failed";

export const LANGUAGE_ACTIVATION_JOB_STATUSES = [
  "queued",
  "running",
  "waiting_for_data",
  "completed",
  "failed",
] as const satisfies readonly LanguageActivationJobStatus[];

export function isLanguageActivationJobStatus(
  value: unknown,
): value is LanguageActivationJobStatus {
  return (
    typeof value === "string" &&
    (LANGUAGE_ACTIVATION_JOB_STATUSES as readonly string[]).includes(value)
  );
}

export type LanguageActivationDomainStatus =
  | "pending"
  | "ready"
  | "waiting_for_data"
  | "enqueued"
  | "in_progress"
  | "failed"
  | "skipped";

export const LANGUAGE_ACTIVATION_DOMAIN_STATUSES = [
  "pending",
  "ready",
  "waiting_for_data",
  "enqueued",
  "in_progress",
  "failed",
  "skipped",
] as const satisfies readonly LanguageActivationDomainStatus[];

export function isLanguageActivationDomainStatus(
  value: unknown,
): value is LanguageActivationDomainStatus {
  return (
    typeof value === "string" &&
    (LANGUAGE_ACTIVATION_DOMAIN_STATUSES as readonly string[]).includes(value)
  );
}

export type LanguageActivationWebUiDomainProgress = {
  readonly status: LanguageActivationDomainStatus;
  readonly dataReady: boolean;
  readonly missingKeyCount: number;
  readonly emptyKeyCount: number;
  readonly requiredKeyCount: number;
  readonly effectiveSource: "bundled" | "remote" | "none" | null;
  readonly detail: string | null;
};

export type LanguageActivationControlledVocabularyDomainProgress = {
  readonly status: LanguageActivationDomainStatus;
  readonly presentationReady: boolean;
  readonly conceptsChecked: number;
  readonly conceptsReady: number;
  readonly conceptsMissing: number;
  readonly conceptsWithTerminologyPreferredTerm: number;
  readonly conceptsWithWebUiFallbackOnly: number;
  /** Controlled conceptIds still missing a localized label. */
  readonly missingConceptIds: readonly string[];
  readonly detail: string | null;
};

export type LanguageActivationHistoricalDomainProgress = {
  readonly status: LanguageActivationDomainStatus;
  readonly remainingWorkItems: number;
  readonly current: number;
  readonly missing: number;
  readonly stale: number;
  readonly failed: number;
  readonly pending: number;
  readonly enqueueAttempted: boolean;
  readonly enqueuedAt: string | null;
  readonly detail: string | null;
};

export type LanguageActivationJobDomains = {
  readonly webUi: LanguageActivationWebUiDomainProgress;
  readonly controlledVocabulary: LanguageActivationControlledVocabularyDomainProgress;
  readonly ct: LanguageActivationHistoricalDomainProgress;
  readonly plp: LanguageActivationHistoricalDomainProgress;
};

export type LanguageActivationJobRecord = {
  readonly jobId: string;
  readonly locale: string;
  readonly languageId: string;
  /** Monotonic activation generation for this locale (idempotent within generation). */
  readonly generation: number;
  readonly status: LanguageActivationJobStatus;
  readonly domains: LanguageActivationJobDomains;
  readonly lastError: string | null;
  readonly diagnosticSummary: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly createdByParticipantId: string | null;
  /** Snapshots prove Search/SEO are not mutated by activation. */
  readonly searchEnabledSnapshot: boolean;
  readonly seoIndexingEnabledSnapshot: boolean;
};

export type LanguageActivationAdminView = {
  readonly job: LanguageActivationJobRecord | null;
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly languageDataReady: boolean;
  readonly searchReady: boolean;
  readonly seoReady: boolean;
  readonly searchEnabled: boolean;
  readonly seoIndexingEnabled: boolean;
  readonly notes: readonly string[];
};
