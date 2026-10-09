/**
 * Admin language localization activation job service.
 *
 * HTTP path: create/resume job + return status (no provider).
 * Explicit Activate/Resume reconciles currently actionable CT/PLP residual work.
 * enqueueAttempted is historical observability, not a permanent lock.
 * Status refresh does not reconcile, so waiting_for_data polling cannot enqueue.
 */

import { randomUUID } from "node:crypto";

import type {
  LanguageActivationAdminView,
  LanguageActivationJobRecord,
  LanguageLocalizationReadinessReport,
  LanguageRegistryRecord,
} from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../administration/administration.errors.js";
import { findAuthUserById } from "../../auth/auth-user.repository.js";
import {
  LanguageRegistryNotFoundError,
} from "../language-registry/language-registry.errors.js";
import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "../language-registry/language-registry.repository.js";
import { listPlpAutoBuildWorkForLocale } from "../published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { activateLanguageLocalization } from "./language-activation-orchestrator.js";
import type { ActivateLanguageLocalizationInput } from "./language-activation-orchestrator.js";
import type { LanguageHistoricalBackfillPlannerDeps } from "./language-historical-backfill-planner.js";
import {
  ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL,
  buildControlledVocabularyDomainProgress,
  buildDiagnosticSummary,
  buildHistoricalDomainProgress,
  buildWebUiDomainProgress,
  brandDomainFromPreparationResult,
  brandDomainPreparing,
  brandDomainProviderConfigFailure,
  classifyActivationAutomaticProgress,
  deriveActivationJobStatus,
  type ActivationAutomaticProgress,
  emptyPendingDomains,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
  terminologyDomainFromPreparationResult,
  terminologyDomainPreparing,
  terminologyDomainProviderConfigFailure,
} from "./language-activation-job.domains.js";
import { LanguageActivationJobValidationError } from "./language-activation-job.errors.js";
import {
  getActiveLanguageActivationJobByLocale,
  getLatestLanguageActivationJobByLocale,
  getLanguageActivationJobById,
  listLanguageActivationJobs,
  saveLanguageActivationJob,
} from "./language-activation-job.repository.js";
import { evaluateLanguageLocalizationReadiness } from "./language-localization-readiness-evaluator.js";
import { assessWebUiCatalogReadinessForLocale } from "./assess-web-ui-catalog-readiness.js";
import {
  readLocalizationProviderCooldown,
  type LocalizationProviderCooldownRead,
} from "../localization-provider-governor.js";
import {
  LanguageOwnerPreparationError,
  runLanguageOwnerPreparation,
  type LanguageOwnerPreparationInput,
  type LanguageOwnerPreparationResult,
} from "../../language-preparation/language-owner-preparation.js";
import { isActivationCooldownDue } from "../activation-provider-transient-recovery.js";
import {
  evaluateFailedWebUiActivationResume,
  listJobsNeedingWebUiActivationResume,
  processWebUiActivationTick,
  tryReopenRecoverableFailedWebUiCheckpoint,
  webUiProgressFromCheckpoint,
  type WebUiActivationPreparationDeps,
} from "../../web-ui-message-packs/web-ui-activation-preparation.js";
import {
  getWebUiActivationCheckpoint,
  getWebUiActivationCheckpointByJobId,
} from "../../web-ui-message-packs/web-ui-activation-checkpoint.repository.js";

type AdminActor = {
  userId: string;
  participantId: string;
};

let adminAssertOverrideForTests: ((userId: string) => Promise<AdminActor>) | null =
  null;

export function setLanguageActivationJobAdminAssertOverrideForTests(
  override: ((userId: string) => Promise<AdminActor>) | null,
): void {
  adminAssertOverrideForTests = override;
}

async function assertAdminActor(userId: string): Promise<AdminActor> {
  if (adminAssertOverrideForTests) {
    return adminAssertOverrideForTests(userId);
  }
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError();
  }
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

export type LanguageActivationJobProcessDeps = {
  readonly plannerDeps?: LanguageHistoricalBackfillPlannerDeps;
  readonly runResidualRetry?: ActivateLanguageLocalizationInput["runResidualRetry"];
  readonly enqueuePlpMediaConsumer?: ActivateLanguageLocalizationInput["enqueuePlpMediaConsumer"];
  readonly skipCorpusInReadiness?: boolean;
  readonly evaluateReadiness?: typeof evaluateLanguageLocalizationReadiness;
  readonly activate?: typeof activateLanguageLocalization;
  /** Deterministic tests inject preparation; production uses runLanguageOwnerPreparation. */
  readonly runOwnerPreparation?: (
    input: LanguageOwnerPreparationInput,
  ) => Promise<LanguageOwnerPreparationResult>;
  /** Skip Brand/Terminology preparation (existing activation unit tests). */
  readonly skipOwnerPreparation?: boolean;
  /** Skip durable WEB_UI preparation (15A/15B and measurement-only tests). */
  readonly skipWebUiPreparation?: boolean;
  /** Deterministic WEB_UI preparation deps (translator, includePaths, etc.). */
  readonly webUiPreparationDeps?: WebUiActivationPreparationDeps;
  /** Test seam for the shared Gate E cooldown read. Production uses the governor. */
  readonly readProviderCooldown?: () => Promise<LocalizationProviderCooldownRead>;
  /** Test seam for the cheap WEB_UI catalog gate. Production uses catalog readiness. */
  readonly assessWebUi?: typeof assessWebUiCatalogReadinessForLocale;
};

let processDepsOverrideForTests: LanguageActivationJobProcessDeps | null = null;

export function setLanguageActivationJobProcessDepsForTests(
  deps: LanguageActivationJobProcessDeps | null,
): void {
  processDepsOverrideForTests = deps;
}

function processDeps(): LanguageActivationJobProcessDeps {
  return processDepsOverrideForTests ?? {};
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertActivationEligible(record: LanguageRegistryRecord): void {
  if (!record.enabled) {
    throw new LanguageActivationJobValidationError(
      `Locale ${record.locale} is disabled; enable it before activation.`,
    );
  }
  if (!record.contentTranslationEnabled) {
    throw new LanguageActivationJobValidationError(
      `Locale ${record.locale} has contentTranslationEnabled=false; enable content translation before activation.`,
    );
  }
}

async function loadRegistryForLanguageId(
  languageId: string,
): Promise<LanguageRegistryRecord> {
  const records = await listLanguageRegistry();
  const record = records.find((row) => row.languageId === languageId);
  if (!record) {
    throw new LanguageRegistryNotFoundError(
      `Language registry record not found: ${languageId}`,
    );
  }
  return record;
}

async function refreshDomains(
  job: LanguageActivationJobRecord,
  readiness: LanguageLocalizationReadinessReport,
  options?: { readonly claimed?: boolean },
): Promise<LanguageActivationJobRecord["domains"]> {
  const webUi = await syncWebUiDomainProgress(job, readiness, options);
  const controlledVocabulary = buildControlledVocabularyDomainProgress(readiness);
  const ct = buildHistoricalDomainProgress({
    bucket: readiness.ct,
    enqueueAttempted: job.domains.ct.enqueueAttempted,
    enqueuedAt: job.domains.ct.enqueuedAt,
    owner: "CT",
  });
  const plp = buildHistoricalDomainProgress({
    bucket: readiness.plpMedia,
    enqueueAttempted: job.domains.plp.enqueueAttempted,
    enqueuedAt: job.domains.plp.enqueuedAt,
    owner: "PLP",
  });
  return {
    brand: job.domains.brand ?? emptyPendingDomains().brand,
    terminology: job.domains.terminology ?? emptyPendingDomains().terminology,
    webUi,
    controlledVocabulary,
    ct,
    plp,
  };
}

function isClaimedActivationStatus(
  status: LanguageActivationJobRecord["status"],
): boolean {
  return status === "queued" || status === "running";
}

/**
 * Provider-free: checkpoint progress outranks a missing-catalog measurement.
 * A claimed job must not project automatable WEB_UI as waiting_for_data.
 */
async function syncWebUiDomainProgress(
  job: LanguageActivationJobRecord,
  readiness: LanguageLocalizationReadinessReport,
  options?: { readonly claimed?: boolean },
): Promise<LanguageActivationJobRecord["domains"]["webUi"]> {
  const checkpointId =
    job.domains.webUi.checkpointId ??
    (await getWebUiActivationCheckpointByJobId(job.jobId))?.checkpointId ??
    null;
  if (checkpointId) {
    const checkpoint = await getWebUiActivationCheckpoint(checkpointId);
    if (checkpoint) {
      return webUiProgressFromCheckpoint({
        readinessDataReady: readiness.webUi.dataReady === true,
        missingKeyCount: readiness.webUi.missingKeyCount,
        emptyKeyCount: readiness.webUi.emptyKeyCount,
        requiredKeyCount: readiness.webUi.requiredKeyCount,
        effectiveSource: readiness.webUi.dataReady ? "remote" : "none",
        checkpoint,
        completedLeaves: job.domains.webUi.completedLeaves,
      });
    }
  }
  const measured = await buildWebUiDomainProgress(readiness, job.domains.webUi);
  if (
    options?.claimed &&
    measured.status === "waiting_for_data" &&
    !measured.providerFailure &&
    measured.preparationPhase !== "failed"
  ) {
    return {
      ...measured,
      status: "pending",
      dataReady: false,
      detail: "Preparing public interface…",
      preparationPhase: null,
      checkpointId: job.domains.webUi.checkpointId,
      sourceHash: job.domains.webUi.sourceHash,
      providerFailure: false,
    };
  }
  return measured;
}

/**
 * Project a running activation from readiness the caller already measured.
 * Does not call the provider and does not enqueue.
 */
export async function applySuppliedReadinessToRunningActivation(input: {
  readonly locale: string;
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly domains?: LanguageActivationJobRecord["domains"];
}): Promise<LanguageActivationJobRecord | null> {
  const job = await getActiveLanguageActivationJobByLocale(input.locale);
  if (!job || !isClaimedActivationStatus(job.status)) {
    return null;
  }
  const domains =
    input.domains ?? (await refreshDomains(job, input.readiness, { claimed: true }));
  const automaticProgress = await automaticProgressForLocale(input.locale, input.readiness);
  const status = deriveActivationJobStatus({
    readiness: input.readiness,
    domains,
    ctEnqueueAttempted: domains.ct.enqueueAttempted,
    plpEnqueueAttempted: domains.plp.enqueueAttempted,
    automaticProgress,
  });
  const saved = await saveLanguageActivationJob({
    ...job,
    status,
    domains,
    diagnosticSummary: buildDiagnosticSummary({ status, readiness: input.readiness, domains }),
    updatedAt: nowIso(),
    completedAt: status === "completed" || status === "failed" ? job.completedAt ?? nowIso() : null,
    lastError: lastErrorForDerivedActivation({
      status,
      automaticProgress,
      domains,
      previous: job.lastError,
    }),
  });
  return saved;
}

/**
 * After a PLP publish, derive the active activation job from live readiness.
 * Reuses the activation status function. No second readiness algorithm.
 */
export function isAuthoritativeLocalizationReady(
  readiness: Pick<
    LanguageLocalizationReadinessReport,
    "state" | "languageDataReady" | "ct" | "plpMedia"
  >,
): boolean {
  if (readiness.state !== "READY" || readiness.languageDataReady !== true) {
    return false;
  }
  return [readiness.ct, readiness.plpMedia].every(
    (bucket) =>
      bucket.workItemsRequired === 0 &&
      bucket.missing === 0 &&
      bucket.stale === 0 &&
      bucket.invalid === 0 &&
      bucket.failed === 0 &&
      bucket.pending === 0 &&
      (bucket.activeWork ?? 0) === 0 &&
      (bucket.preflightBlocked ?? 0) === 0,
  );
}

/**
 * Same locale and generation, failed only because automatic localization
 * could not progress, and the live readiness result is authoritative READY.
 * Does not open a new generation and does not call a provider.
 */
export function isEligibleFailedActivationConvergence(
  job: LanguageActivationJobRecord,
  readiness: Pick<
    LanguageLocalizationReadinessReport,
    "state" | "languageDataReady" | "ct" | "plpMedia"
  >,
  locale: string,
): boolean {
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey || normalizeLanguageRegistryLocaleKey(job.locale) !== localeKey) {
    return false;
  }
  if (job.status !== "failed") {
    return false;
  }
  if (job.lastError !== ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL) {
    return false;
  }
  if (
    job.domains.brand.status === "failed" ||
    job.domains.brand.providerFailure ||
    job.domains.terminology.status === "failed" ||
    job.domains.terminology.providerFailure ||
    job.domains.webUi.status === "failed" ||
    job.domains.webUi.providerFailure
  ) {
    return false;
  }
  return isAuthoritativeLocalizationReady(readiness);
}

/**
 * failed → completed exactly once for the current generation.
 * A completed job is returned unchanged and is not written again.
 */
export async function convergeFailedActivationWhenAuthoritativeReady(
  locale: string,
  readiness?: LanguageLocalizationReadinessReport,
): Promise<LanguageActivationJobRecord | null> {
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    return null;
  }
  const job = await getLatestLanguageActivationJobByLocale(localeKey);
  if (!job || job.status !== "failed") {
    return job?.status === "completed" ? job : null;
  }
  let measured = readiness;
  if (!measured) {
    let registry: LanguageRegistryRecord | null;
    try {
      registry = await resolveLanguageRegistryLocale(localeKey);
    } catch {
      return null;
    }
    if (!registry) {
      return null;
    }
    const evaluate = processDeps().evaluateReadiness ?? evaluateLanguageLocalizationReadiness;
    measured = await evaluate({
      locale: registry.locale,
      registryRecord: registry,
    });
  }
  if (!isEligibleFailedActivationConvergence(job, measured, localeKey)) {
    return null;
  }
  const completedAt = nowIso();
  return saveLanguageActivationJob({
    ...job,
    status: "completed",
    updatedAt: completedAt,
    completedAt,
    lastError: job.lastError,
    diagnosticSummary: [
      "job=completed",
      "converged_from=failed",
      `generation=${job.generation}`,
      `priorError=${job.lastError ?? ""}`,
      job.diagnosticSummary ?? "",
    ]
      .filter((part) => part.length > 0)
      .join(" · "),
  });
}

export async function syncRunningActivationAfterPlpPublish(locale: string): Promise<void> {
  const job = await getActiveLanguageActivationJobByLocale(locale);
  if (!job || !isClaimedActivationStatus(job.status)) {
    return;
  }
  const deps = processDeps();
  const evaluate = deps.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;
  let registry: LanguageRegistryRecord | null;
  try {
    registry = await resolveLanguageRegistryLocale(locale);
  } catch {
    return;
  }
  if (!registry) {
    return;
  }
  const readiness = await evaluate({
    locale: registry.locale,
    registryRecord: registry,
    plannerDeps: deps.plannerDeps,
    skipCorpusPlan: deps.skipCorpusInReadiness === true,
  });
  await applySuppliedReadinessToRunningActivation({
    locale: registry.locale,
    readiness,
  });
}

async function automaticProgressForLocale(
  locale: string,
  readiness: LanguageLocalizationReadinessReport,
): Promise<ActivationAutomaticProgress> {
  const plpWork = await listPlpAutoBuildWorkForLocale({ locale, limit: 50 });
  return classifyActivationAutomaticProgress({ readiness, plpWork });
}

function lastErrorForDerivedActivation(input: {
  readonly status: LanguageActivationJobRecord["status"];
  readonly automaticProgress: ActivationAutomaticProgress;
  readonly domains: LanguageActivationJobRecord["domains"];
  readonly previous: string | null;
}): string | null {
  if (input.status !== "failed") {
    return null;
  }
  if (input.automaticProgress === "exhausted") {
    return ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL;
  }
  return (
    input.domains.webUi.detail ??
    input.domains.terminology.detail ??
    input.domains.brand.detail ??
    input.previous
  );
}

async function claimLanguageActivationJob(
  job: LanguageActivationJobRecord,
  readiness: LanguageLocalizationReadinessReport,
): Promise<LanguageActivationJobRecord> {
  let domains = await refreshDomains(job, readiness, { claimed: true });
  const checkpointActive =
    domains.webUi.status === "in_progress" ||
    domains.webUi.preparationPhase === "primary" ||
    domains.webUi.preparationPhase === "quality" ||
    domains.webUi.preparationPhase === "validating" ||
    domains.webUi.preparationPhase === "publishing" ||
    domains.webUi.preparationPhase === "provider_cooldown" ||
    domains.webUi.preparationPhase === "structure_retry" ||
    domains.webUi.preparationPhase === "structure_blocked";
  const brand = domains.brand;
  if (
    !checkpointActive &&
    brand.status !== "ready" &&
    brand.status !== "failed" &&
    brand.status !== "in_progress"
  ) {
    domains = {
      ...domains,
      brand: {
        ...brand,
        status: "in_progress",
        detail: "Preparing Brand…",
      },
    };
  }
  const automaticProgress = await automaticProgressForLocale(job.locale, readiness);
  const derived = deriveActivationJobStatus({
    readiness,
    domains,
    ctEnqueueAttempted: domains.ct.enqueueAttempted,
    plpEnqueueAttempted: domains.plp.enqueueAttempted,
    automaticProgress,
  });
  const status = derived === "failed" ? "failed" : "running";
  const claimed: LanguageActivationJobRecord = {
    ...job,
    status,
    domains,
    startedAt: job.startedAt ?? nowIso(),
    completedAt: status === "failed" ? nowIso() : null,
    updatedAt: nowIso(),
    lastError: lastErrorForDerivedActivation({
      status,
      automaticProgress,
      domains,
      previous: job.lastError,
    }),
    diagnosticSummary: buildDiagnosticSummary({ status, readiness, domains }),
    searchEnabledSnapshot: job.searchEnabledSnapshot,
    seoIndexingEnabledSnapshot: job.seoIndexingEnabledSnapshot,
  };
  await saveLanguageActivationJob(claimed);
  return claimed;
}

function toAdminView(input: {
  readonly job: LanguageActivationJobRecord | null;
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly notes?: readonly string[];
}): LanguageActivationAdminView {
  const { readiness, job } = input;
  return {
    job,
    readiness,
    languageDataReady: readiness.languageDataReady,
    searchReady: readiness.searchLocalizationReady,
    seoReady: readiness.seoReady,
    searchEnabled: readiness.registry.searchEnabled,
    seoIndexingEnabled: readiness.registry.seoIndexingEnabled,
    notes: input.notes ?? [],
  };
}

export type WebUiPreparationEnsureResult = {
  readonly action: "created" | "reused" | "skipped";
  readonly reason: string;
  readonly jobId: string | null;
  readonly generation: number | null;
  readonly locale: string;
};

/**
 * Idempotent system wake for authoritative WEB_UI that is not ready and has
 * no compatible active preparation. Same activation job engine as Activate.
 * Does not enqueue CT/PLP. Does not require an operator.
 */
export async function ensureWebUiPreparationForUnreadyLocale(input: {
  readonly locale: string;
  readonly scheduleProcess?: boolean;
}): Promise<WebUiPreparationEnsureResult> {
  const requestedKey = normalizeLanguageRegistryLocaleKey(input.locale);
  if (!requestedKey || requestedKey === "en") {
    return {
      action: "skipped",
      reason: "source_locale",
      jobId: null,
      generation: null,
      locale: input.locale,
    };
  }
  const record = await resolveLanguageRegistryLocale(input.locale);
  const localeKey = record
    ? normalizeLanguageRegistryLocaleKey(record.locale)
    : "";
  if (
    !record ||
    !localeKey ||
    localeKey === "en" ||
    record.enabled !== true ||
    record.contentTranslationEnabled !== true
  ) {
    return {
      action: "skipped",
      reason: !record || localeKey === "en" ? "source_locale" : "registry_ineligible",
      jobId: null,
      generation: null,
      locale: record?.locale ?? input.locale,
    };
  }

  const deps = processDeps();
  const assess = deps.assessWebUi ?? assessWebUiCatalogReadinessForLocale;
  const [publicWebUi, participantWebUi] = await Promise.all([
    assess({ locale: record.locale }),
    assess({ locale: record.locale, scope: "participant" }),
  ]);
  const active = await getActiveLanguageActivationJobByLocale(localeKey);
  if (
    publicWebUi.dataReady === true &&
    participantWebUi.dataReady === true &&
    !active
  ) {
    return {
      action: "skipped",
      reason: "web_ui_ready",
      jobId: null,
      generation: null,
      locale: record.locale,
    };
  }

  const latestBefore = await getLatestLanguageActivationJobByLocale(record.locale);
  const view = await startOrResumeLanguageActivationJobCore({
    record,
    createdByParticipantId: null,
    scheduleProcess: input.scheduleProcess,
    automaticRecovery: true,
  });
  const job = view.job;
  const created = Boolean(job && job.jobId !== latestBefore?.jobId);
  return {
    action: created ? "created" : job ? "reused" : "skipped",
    reason: created ? "scheduled" : "existing_work",
    jobId: job?.jobId ?? null,
    generation: job?.generation ?? null,
    locale: record.locale,
  };
}

/**
 * Create or resume a durable activation job for one Registry language.
 * Returns immediately after persisting queued/active state — no provider calls.
 */
export async function startOrResumeLanguageActivationJob(input: {
  readonly actorUserId: string;
  readonly languageId: string;
  readonly scheduleProcess?: boolean;
}): Promise<LanguageActivationAdminView> {
  const admin = await assertAdminActor(input.actorUserId);
  const record = await loadRegistryForLanguageId(input.languageId);
  return startOrResumeLanguageActivationJobCore({
    record,
    createdByParticipantId: admin.participantId,
    scheduleProcess: input.scheduleProcess,
  });
}

/**
 * Shared Activate / automatic WEB_UI recovery persistence.
 * Returns immediately after persisting queued/active state — no provider calls.
 */
async function startOrResumeLanguageActivationJobCore(input: {
  readonly record: LanguageRegistryRecord;
  readonly createdByParticipantId: string | null;
  readonly scheduleProcess?: boolean;
  /** Leave a healthy running job alone. Still creates when none is active. */
  readonly automaticRecovery?: boolean;
}): Promise<LanguageActivationAdminView> {
  const record = input.record;
  assertActivationEligible(record);

  /** Gate A — job.locale stores Registry CANONICAL; jobId uses IDENTITY KEY. */
  const locale = record.locale;
  const localeKey = normalizeLanguageRegistryLocaleKey(record.locale);
  const deps = processDeps();
  const evaluate = deps.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;

  const active = await getActiveLanguageActivationJobByLocale(localeKey);
  if (active) {
    const readiness = await evaluate({
      locale,
      registryRecord: record,
      plannerDeps: deps.plannerDeps,
      skipCorpusPlan: deps.skipCorpusInReadiness === true,
    });
    const claimed = await claimLanguageActivationJob(active, readiness);
    if (claimed.domains.webUi.preparationPhase === "structure_blocked") {
      // Outer recovery, when still open, already has a durable nextAttemptAt.
      // Do not create a generation, reset counters, or move that wake earlier.
      return toAdminView({
        job: claimed,
        readiness,
        notes: [
          "Automatic translation is blocked by a structural defect. No operator retry is required.",
        ],
      });
    }
    const webUiWaiting =
      claimed.domains.webUi.preparationPhase === "provider_cooldown" ||
      claimed.domains.webUi.preparationPhase === "structure_retry";
    const coolingDown =
      webUiWaiting ||
      (claimed.domains.brand.status === "in_progress" &&
        claimed.domains.brand.nextAttemptAt != null &&
        claimed.domains.brand.nextAttemptAt.length > 0) ||
      (claimed.domains.terminology.status === "in_progress" &&
        claimed.domains.terminology.nextAttemptAt != null &&
        claimed.domains.terminology.nextAttemptAt.length > 0);
    if (coolingDown) {
      const nextAttemptAt =
        claimed.domains.webUi.nextAttemptAt ??
        claimed.domains.brand.nextAttemptAt ??
        claimed.domains.terminology.nextAttemptAt ??
        null;
      if (nextAttemptAt) {
        if (webUiWaiting) {
          scheduleWebUiActivationTickAt(claimed.jobId, nextAttemptAt);
        } else {
          scheduleLanguageActivationJobProcessAt(claimed.jobId, nextAttemptAt);
        }
      }
      return toAdminView({
        job: claimed,
        readiness,
        notes: [
          claimed.domains.webUi.preparationPhase === "structure_retry"
            ? "Automatic retry is scheduled. No operator action is required."
            : "Automatic translation-provider cooldown is pending. No new job or checkpoint created.",
        ],
      });
    }
    if (input.automaticRecovery) {
      const neverStarted = active.status === "queued" && active.startedAt == null;
      const currentWebUiReady =
        readiness.webUi.dataReady === true &&
        readiness.participantWebUi.dataReady === true;
      const eligible =
        input.scheduleProcess !== false && claimed.status !== "failed";
      if (neverStarted && eligible) {
        scheduleLanguageActivationJobProcess(claimed.jobId);
      } else if (!currentWebUiReady && eligible) {
        // Measured readiness, not claimed.domains.webUi. Claim may still
        // project a historical ready checkpoint. The tick rebases that
        // checkpoint on this same job and generation.
        scheduleWebUiActivationTick(claimed.jobId);
      }
    } else if (input.scheduleProcess !== false && claimed.status !== "failed") {
      scheduleLanguageActivationJobProcess(claimed.jobId);
    }
    return toAdminView({
      job: claimed,
      readiness,
      notes: [
        "Resumed existing activation job (idempotent). Activation claimed for automatic preparation; no provider in this request.",
      ],
    });
  }

  const latest = await getLatestLanguageActivationJobByLocale(locale);
  if (latest?.status === "completed") {
    const readiness = await evaluate({
      locale,
      registryRecord: record,
      plannerDeps: deps.plannerDeps,
      skipCorpusPlan: deps.skipCorpusInReadiness === true,
    });
    if (readiness.languageDataReady && readiness.state === "READY") {
      return toAdminView({
        job: latest,
        readiness,
        notes: ["Activation already completed for this locale; no new job created."],
      });
    }
  }

  if (latest?.status === "failed" && deps.skipWebUiPreparation !== true) {
    const resume = await evaluateFailedWebUiActivationResume({
      job: latest,
      deps: deps.webUiPreparationDeps,
    });
    if (resume.kind === "resume") {
      const readiness = await evaluate({
        locale,
        registryRecord: record,
        plannerDeps: deps.plannerDeps,
        skipCorpusPlan: deps.skipCorpusInReadiness === true,
      });
      const domains = await refreshDomains(
        {
          ...latest,
          domains: {
            ...latest.domains,
            webUi: resume.webUi,
          },
        },
        readiness,
        { claimed: true },
      );
      const resumed: LanguageActivationJobRecord = {
        ...latest,
        status: "running",
        domains: {
          ...domains,
          webUi: resume.webUi,
        },
        lastError: null,
        completedAt: null,
        startedAt: latest.startedAt ?? nowIso(),
        diagnosticSummary: resume.webUi.detail ?? "running — Preparing public interface…",
        updatedAt: nowIso(),
      };
      await saveLanguageActivationJob(resumed);
      if (input.scheduleProcess !== false) {
        scheduleLanguageActivationJobProcess(resumed.jobId);
      }
      return toAdminView({
        job: resumed,
        readiness,
        notes: [
          "Resumed existing failed WEB_UI activation on the same checkpoint. Completed batches are preserved; no provider in this request.",
        ],
      });
    }
    if (resume.kind === "restart_required") {
      const readiness = await evaluate({
        locale,
        registryRecord: record,
        plannerDeps: deps.plannerDeps,
        skipCorpusPlan: deps.skipCorpusInReadiness === true,
      });
      const failed: LanguageActivationJobRecord = {
        ...latest,
        domains: {
          ...latest.domains,
          webUi: resume.webUi,
        },
        lastError: resume.detail,
        diagnosticSummary: `failed — WEB_UI: ${resume.detail}`,
        updatedAt: nowIso(),
      };
      await saveLanguageActivationJob(failed);
      // Fall through to create a new generation — catalog identity changed.
    }
  }

  const createdAt = nowIso();
  const generation = (latest?.generation ?? 0) + 1;
  const job: LanguageActivationJobRecord = {
    jobId: `lang-act-${localeKey}-${generation}-${randomUUID().slice(0, 8)}`,
    locale,
    languageId: record.languageId,
    generation,
    status: "queued",
    domains: emptyPendingDomains(),
    lastError: null,
    diagnosticSummary: "queued — awaiting async tick",
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    completedAt: null,
    createdByParticipantId: input.createdByParticipantId,
    searchEnabledSnapshot: record.searchEnabled,
    seoIndexingEnabledSnapshot: record.seoIndexingEnabled,
  };
  await saveLanguageActivationJob(job);

  if (input.scheduleProcess !== false) {
    scheduleLanguageActivationJobProcess(job.jobId);
  }

  const readiness = await evaluate({
    locale,
    registryRecord: record,
    plannerDeps: deps.plannerDeps,
    skipCorpusPlan: deps.skipCorpusInReadiness === true,
  });

  return toAdminView({
    job,
    readiness,
    notes: [
      "Activation job queued. Brand, Terminology, then public interface preparation run asynchronously (no provider in this request).",
      "Search/SEO flags are not modified by activation.",
    ],
  });
}

export type ProcessLanguageActivationJobOptions = {
  /**
   * Explicit Activate/Resume. Recomputes residual eligibility even after
   * enqueueAttempted. Status refresh omits this.
   */
  readonly reconcileResiduals?: boolean;
  /**
   * Background WEB_UI tick only — advances at most one batch; never Brand/Term.
   * Provider allowed. Status refresh must not set this.
   */
  readonly webUiTick?: boolean;
};

/**
 * Advance one activation job: owners → WEB_UI batch tick → CT/PLP reconcile.
 * Side-effect free regarding Search/SEO.
 * Provider only via Activate/Resume, WEB_UI ticks, and existing CT/PLP workers.
 */
async function activationCorpusMeasurementBlockedByProviderCooldown(input: {
  readonly job: LanguageActivationJobRecord;
  readonly deps: LanguageActivationJobProcessDeps;
  readonly locale: string;
  readonly ownersDeferred: boolean;
}): Promise<boolean> {
  if (input.ownersDeferred) {
    return true;
  }
  const phase = input.job.domains.webUi.preparationPhase;
  // Validate/publish is local checkpoint work. Do not skip the rest of the tick
  // for it, and do not treat it as provider-blocked corpus work.
  if (phase === "validating" || phase === "publishing") {
    return false;
  }
  if (
    phase === "primary" ||
    phase === "quality" ||
    phase === "provider_cooldown" ||
    phase === "structure_retry"
  ) {
    return true;
  }
  const assess = input.deps.assessWebUi ?? assessWebUiCatalogReadinessForLocale;
  const publicWebUi = await assess({ locale: input.locale });
  const participantWebUi = await assess({ locale: input.locale, scope: "participant" });
  return isLanguageActivationWebUiReadyForHistoricalEnqueue({
    webUi: input.job.domains.webUi,
    publicWebUiDataReady: publicWebUi.dataReady === true,
    participantWebUiDataReady: participantWebUi.dataReady === true,
  });
}

export async function processLanguageActivationJob(
  jobId: string,
  options?: ProcessLanguageActivationJobOptions,
): Promise<LanguageActivationJobRecord> {
  const existing = await getLanguageActivationJobById(jobId);
  if (!existing) {
    throw new LanguageActivationJobValidationError(`Activation job not found: ${jobId}`);
  }
  if (existing.status === "completed" || existing.status === "failed") {
    return existing;
  }

  const deps = processDeps();
  const evaluate = deps.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;
  const activate = deps.activate ?? activateLanguageLocalization;

  let job: LanguageActivationJobRecord = {
    ...existing,
    status: "running",
    startedAt: existing.startedAt ?? nowIso(),
    updatedAt: nowIso(),
    lastError: null,
  };
  await saveLanguageActivationJob(job);

  const registry = await resolveLanguageRegistryLocale(job.locale);

  if (!registry) {
    job = {
      ...job,
      status: "failed",
      lastError: `Locale ${job.locale} no longer exists in Language Registry.`,
      diagnosticSummary: "failed — registry missing",
      updatedAt: nowIso(),
      completedAt: nowIso(),
    };
    await saveLanguageActivationJob(job);
    return job;
  }

  /** Gate A — historical jobs may store identity-key locale; owners use CANONICAL. */
  const canonicalLocale = registry.locale;

  if (!registry.enabled || !registry.contentTranslationEnabled) {
    job = {
      ...job,
      status: "failed",
      lastError:
        "Locale became ineligible (disabled or contentTranslationEnabled=false).",
      diagnosticSummary: "failed — registry ineligible",
      updatedAt: nowIso(),
      completedAt: nowIso(),
      searchEnabledSnapshot: registry.searchEnabled,
      seoIndexingEnabledSnapshot: registry.seoIndexingEnabled,
    };
    await saveLanguageActivationJob(job);
    return job;
  }

  try {
    // Explicit Activate/Resume runs Brand then Terminology before WEB_UI.
    // Status refresh and WEB_UI-only ticks omit this so they never call Brand/Term providers.
    const shouldPrepareOwners =
      options?.reconcileResiduals === true &&
      options?.webUiTick !== true &&
      deps.skipOwnerPreparation !== true &&
      normalizeLanguageRegistryLocaleKey(canonicalLocale) !== "en";

    const inactiveCooldown: LocalizationProviderCooldownRead = {
      active: false,
      cooldownUntil: null,
      pressureCategory: null,
    };
    const readCooldown = deps.readProviderCooldown ?? readLocalizationProviderCooldown;
    let ownerCooldown: LocalizationProviderCooldownRead = inactiveCooldown;
    if (shouldPrepareOwners) {
      try {
        ownerCooldown = await readCooldown();
      } catch (error) {
        if (deps.readProviderCooldown) {
          throw error;
        }
      }
    }
    const deferOwnerProviders =
      shouldPrepareOwners &&
      ownerCooldown.active === true &&
      Boolean(ownerCooldown.cooldownUntil);

    if (shouldPrepareOwners && !deferOwnerProviders) {
      const prepare = deps.runOwnerPreparation ?? runLanguageOwnerPreparation;
      const nowMs = Date.now();

      const brandCooling =
        job.domains.brand.status === "in_progress" &&
        Boolean(job.domains.brand.nextAttemptAt);
      if (brandCooling && !isActivationCooldownDue({
        nextAttemptAt: job.domains.brand.nextAttemptAt,
        nowMs,
      })) {
        const nextAttemptAt = job.domains.brand.nextAttemptAt!;
        job = {
          ...job,
          status: "running",
          completedAt: null,
          lastError: null,
          diagnosticSummary:
            job.domains.brand.detail ??
            "running — Waiting for translation provider…",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        scheduleLanguageActivationJobProcessAt(job.jobId, nextAttemptAt);
        return job;
      }

      if (
        job.domains.brand.status !== "failed" &&
        !(
          brandCooling &&
          !isActivationCooldownDue({
            nextAttemptAt: job.domains.brand.nextAttemptAt,
            nowMs,
          })
        )
      ) {
        // Gap-only prepare — re-run even when previously ready so Activate fills new gaps.
        job = {
          ...job,
          domains: {
            ...job.domains,
            brand: {
              ...brandDomainPreparing(),
              fieldsPreserved: job.domains.brand.fieldsPreserved,
              fieldsGenerated: job.domains.brand.fieldsGenerated,
              brandStatus: job.domains.brand.brandStatus,
              reviewRequired: job.domains.brand.reviewRequired,
              transientFailureCount: job.domains.brand.transientFailureCount ?? 0,
              lastTransientFailure: job.domains.brand.lastTransientFailure ?? null,
            },
          },
          diagnosticSummary: "running — Preparing Brand…",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);

        try {
          const brandResult = await prepare({
            locale: canonicalLocale,
            execute: true,
            owners: ["brand"],
            log: () => undefined,
          });
          const brandDomain = brandDomainFromPreparationResult(brandResult, {
            previous: job.domains.brand,
            nowIso: nowIso(),
          });
          job = {
            ...job,
            domains: {
              ...job.domains,
              brand: brandDomain,
            },
            updatedAt: nowIso(),
          };
          await saveLanguageActivationJob(job);

          if (brandDomain.nextAttemptAt && brandDomain.status === "in_progress") {
            job = {
              ...job,
              status: "running",
              completedAt: null,
              lastError: null,
              diagnosticSummary:
                brandDomain.detail ?? "running — Waiting for translation provider…",
              updatedAt: nowIso(),
            };
            await saveLanguageActivationJob(job);
            scheduleLanguageActivationJobProcessAt(job.jobId, brandDomain.nextAttemptAt);
            return job;
          }
        } catch (error) {
          const message =
            error instanceof LanguageOwnerPreparationError || error instanceof Error
              ? error.message
              : "Owner preparation failed.";
          const providerFailureMessage = message.replace(/^REFUSED:\s*/i, "");
          job = {
            ...job,
            domains: {
              ...job.domains,
              brand: brandDomainProviderConfigFailure(providerFailureMessage),
            },
            status: "failed",
            lastError: providerFailureMessage,
            diagnosticSummary: `failed — owner preparation: ${providerFailureMessage}`,
            updatedAt: nowIso(),
            completedAt: nowIso(),
          };
          await saveLanguageActivationJob(job);
          return job;
        }
      }

      // Early return already handled when brandCooling && !due (above).
      // Recompute after possible brand work:
      const brandStillCooling =
        job.domains.brand.status === "in_progress" &&
        Boolean(job.domains.brand.nextAttemptAt) &&
        !isActivationCooldownDue({
          nextAttemptAt: job.domains.brand.nextAttemptAt,
          nowMs: Date.now(),
        });
      if (brandStillCooling) {
        scheduleLanguageActivationJobProcessAt(
          job.jobId,
          job.domains.brand.nextAttemptAt!,
        );
        return job;
      }

      if (job.domains.brand.status === "failed") {
        job = {
          ...job,
          status: "failed",
          lastError: job.domains.brand.detail ?? "Brand preparation failed.",
          diagnosticSummary: buildDiagnosticSummary({
            status: "failed",
            readiness: await evaluate({
              locale: canonicalLocale,
              registryRecord: registry,
              plannerDeps: deps.plannerDeps,
              skipCorpusPlan: deps.skipCorpusInReadiness === true,
            }),
            domains: job.domains,
          }),
          updatedAt: nowIso(),
          completedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        return job;
      }

      const terminologyCooling =
        job.domains.terminology.status === "in_progress" &&
        Boolean(job.domains.terminology.nextAttemptAt);
      if (
        terminologyCooling &&
        !isActivationCooldownDue({
          nextAttemptAt: job.domains.terminology.nextAttemptAt,
          nowMs,
        })
      ) {
        const nextAttemptAt = job.domains.terminology.nextAttemptAt!;
        job = {
          ...job,
          status: "running",
          completedAt: null,
          lastError: null,
          diagnosticSummary:
            job.domains.terminology.detail ??
            "running — Waiting for translation provider…",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        scheduleLanguageActivationJobProcessAt(job.jobId, nextAttemptAt);
        return job;
      }

      if (job.domains.terminology.status !== "failed") {
        job = {
          ...job,
          domains: {
            ...job.domains,
            terminology: {
              ...terminologyDomainPreparing(),
              conceptsPreserved: job.domains.terminology.conceptsPreserved,
              conceptsGenerated: job.domains.terminology.conceptsGenerated,
              transientFailureCount:
                job.domains.terminology.transientFailureCount ?? 0,
              lastTransientFailure:
                job.domains.terminology.lastTransientFailure ?? null,
              providerDiagnostic:
                job.domains.terminology.providerDiagnostic ?? null,
            },
          },
          diagnosticSummary: "running — Preparing terminology…",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);

        try {
          const terminologyResult = await prepare({
            locale: canonicalLocale,
            execute: true,
            owners: ["terminology"],
            log: () => undefined,
          });
          const terminologyDomain = terminologyDomainFromPreparationResult(
            terminologyResult,
            {
              previous: job.domains.terminology,
              nowIso: nowIso(),
            },
          );
          job = {
            ...job,
            domains: {
              ...job.domains,
              terminology: terminologyDomain,
            },
            updatedAt: nowIso(),
          };
          await saveLanguageActivationJob(job);

          if (
            terminologyDomain.nextAttemptAt &&
            terminologyDomain.status === "in_progress"
          ) {
            job = {
              ...job,
              status: "running",
              completedAt: null,
              lastError: null,
              diagnosticSummary:
                terminologyDomain.detail ??
                "running — Waiting for translation provider…",
              updatedAt: nowIso(),
            };
            await saveLanguageActivationJob(job);
            scheduleLanguageActivationJobProcessAt(
              job.jobId,
              terminologyDomain.nextAttemptAt,
            );
            return job;
          }
        } catch (error) {
          const message =
            error instanceof LanguageOwnerPreparationError || error instanceof Error
              ? error.message
              : "Owner preparation failed.";
          const providerFailureMessage = message.replace(/^REFUSED:\s*/i, "");
          job = {
            ...job,
            domains: {
              ...job.domains,
              terminology: terminologyDomainProviderConfigFailure(
                providerFailureMessage,
              ),
            },
            status: "failed",
            lastError: providerFailureMessage,
            diagnosticSummary: `failed — owner preparation: ${providerFailureMessage}`,
            updatedAt: nowIso(),
            completedAt: nowIso(),
          };
          await saveLanguageActivationJob(job);
          return job;
        }
      }

      if (job.domains.terminology.status === "failed") {
        job = {
          ...job,
          status: "failed",
          lastError:
            job.domains.terminology.detail ?? "Terminology preparation failed.",
          diagnosticSummary: buildDiagnosticSummary({
            status: "failed",
            readiness: await evaluate({
              locale: canonicalLocale,
              registryRecord: registry,
              plannerDeps: deps.plannerDeps,
              skipCorpusPlan: deps.skipCorpusInReadiness === true,
            }),
            domains: job.domains,
          }),
          updatedAt: nowIso(),
          completedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        return job;
      }
    }

    // Durable WEB_UI preparation: at most one batch per tick (Activate or WEB_UI tick).
    // Status refresh never sets reconcileResiduals/webUiTick — no provider.
    const shouldPrepareWebUi =
      (options?.reconcileResiduals === true || options?.webUiTick === true) &&
      deps.skipWebUiPreparation !== true &&
      normalizeLanguageRegistryLocaleKey(canonicalLocale) !== "en";

    if (shouldPrepareWebUi) {
      const tick = await processWebUiActivationTick({
        job,
        checkpointId: job.domains.webUi.checkpointId,
        deps: deps.webUiPreparationDeps,
      });
      job = {
        ...job,
        domains: {
          ...job.domains,
          webUi: tick.webUi,
        },
        diagnosticSummary: tick.webUi.detail ?? "running — Preparing public interface…",
        updatedAt: nowIso(),
      };

      if (tick.deferredUntil) {
        job = {
          ...job,
          status: "running",
          completedAt: null,
          lastError: null,
          diagnosticSummary:
            tick.webUi.detail ?? "running — Waiting for translation provider…",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        if (options?.webUiTick === true) {
          scheduleWebUiActivationTickAt(job.jobId, tick.deferredUntil, { notBefore: true });
        } else {
          scheduleLanguageActivationJobProcessAt(job.jobId, tick.deferredUntil, {
            notBefore: true,
          });
        }
        return job;
      }

      if (tick.webUi.status === "failed" || tick.checkpoint?.phase === "failed") {
        job = {
          ...job,
          status: "failed",
          lastError: tick.webUi.detail ?? "Public interface translation failed",
          diagnosticSummary: `failed — WEB_UI: ${tick.webUi.detail ?? "translation failed"}`,
          completedAt: nowIso(),
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        return job;
      }

      if (
        tick.checkpoint?.phase === "provider_cooldown" ||
        tick.webUi.preparationPhase === "provider_cooldown" ||
        tick.checkpoint?.phase === "structure_retry" ||
        tick.webUi.preparationPhase === "structure_retry"
      ) {
        const nextAttemptAt = tick.webUi.nextAttemptAt ?? tick.checkpoint?.nextAttemptAt ?? null;
        job = {
          ...job,
          status: "running",
          completedAt: null,
          lastError: null,
          diagnosticSummary: tick.webUi.detail ?? "running — Waiting for translation provider…",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        if (nextAttemptAt) {
          scheduleWebUiActivationTickAt(job.jobId, nextAttemptAt);
        } else {
          scheduleWebUiActivationTick(job.jobId);
        }
        return job;
      }

      if (
        tick.checkpoint?.phase === "structure_blocked" ||
        tick.webUi.preparationPhase === "structure_blocked"
      ) {
        job = {
          ...job,
          status: "running",
          completedAt: null,
          lastError: null,
          diagnosticSummary:
            tick.webUi.detail ??
            "running — Automatic translation is blocked by a structural defect.",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        return job;
      }

      if (tick.needsAnotherTick && !tick.done) {
        job = {
          ...job,
          status: "running",
          completedAt: null,
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
        scheduleWebUiActivationTick(job.jobId);
        return job;
      }

      await saveLanguageActivationJob(job);
    }

    if (
      !shouldPrepareOwners &&
      job.domains.brand.status === "in_progress" &&
      job.domains.brand.preparationAttempted !== true
    ) {
      job = {
        ...job,
        domains: {
          ...job.domains,
          brand: {
            ...job.domains.brand,
            status: "pending",
            detail: null,
          },
        },
      };
    }

    let corpusCooldown: LocalizationProviderCooldownRead = inactiveCooldown;
    try {
      corpusCooldown = await readCooldown();
    } catch (error) {
      if (deps.readProviderCooldown) {
        throw error;
      }
    }
    if (
      corpusCooldown.active &&
      corpusCooldown.cooldownUntil &&
      (await activationCorpusMeasurementBlockedByProviderCooldown({
        job,
        deps,
        locale: canonicalLocale,
        ownersDeferred: deferOwnerProviders,
      }))
    ) {
      // Durable wake target. In-memory timers do not survive restart.
      // Phase, batches, and attempts stay as they were.
      if (
        job.domains.webUi.preparationPhase !== "provider_cooldown" &&
        job.domains.webUi.preparationPhase !== "structure_retry"
      ) {
        job = {
          ...job,
          status: "running",
          completedAt: null,
          lastError: null,
          domains: {
            ...job.domains,
            webUi: {
              ...job.domains.webUi,
              nextAttemptAt: corpusCooldown.cooldownUntil,
            },
          },
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
      }
      if (options?.webUiTick === true) {
        scheduleWebUiActivationTickAt(job.jobId, corpusCooldown.cooldownUntil, {
          notBefore: true,
        });
      } else {
        scheduleLanguageActivationJobProcessAt(job.jobId, corpusCooldown.cooldownUntil, {
          notBefore: true,
        });
      }
      return job;
    }

    if (
      job.domains.webUi.nextAttemptAt &&
      job.domains.webUi.preparationPhase !== "provider_cooldown" &&
      job.domains.webUi.preparationPhase !== "structure_retry"
    ) {
      job = {
        ...job,
        domains: {
          ...job.domains,
          webUi: {
            ...job.domains.webUi,
            nextAttemptAt: null,
          },
        },
        updatedAt: nowIso(),
      };
      await saveLanguageActivationJob(job);
    }

    let readiness = await evaluate({
      locale: canonicalLocale,
      registryRecord: registry,
      plannerDeps: deps.plannerDeps,
      skipCorpusPlan: deps.skipCorpusInReadiness === true,
    });

    let domains = await refreshDomains(job, readiness);

    const enqueueAlreadyDone =
      job.domains.ct.enqueueAttempted && job.domains.plp.enqueueAttempted;

    // Historical flags stay for status. They do not block a later explicit reconcile.
    // The first tick still runs when no enqueue has been attempted.
    // Selection stays inside activateLanguageLocalization (residual preflight + PLP planner).
    const shouldReconcileResiduals =
      options?.reconcileResiduals === true ||
      options?.webUiTick === true ||
      !enqueueAlreadyDone;

    // Residual CT/PLP only after authoritative WEB_UI READY for the current corpus.
    // Incomplete WEB_UI (pending / waiting_for_data / active phases / cooldown / failed /
    // dataReady=false / stale catalog vs measured readiness) blocks enqueue.
    const webUiReadyForHistorical =
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: domains.webUi,
        publicWebUiDataReady: readiness.webUi.dataReady === true,
        participantWebUiDataReady: readiness.participantWebUi.dataReady === true,
      });

    if (shouldReconcileResiduals && webUiReadyForHistorical) {
      const stamp = nowIso();
      const result = await activate({
        locale: canonicalLocale,
        execute: true,
        plannerDeps: deps.plannerDeps,
        runResidualRetry: deps.runResidualRetry,
        enqueuePlpMediaConsumer: deps.enqueuePlpMediaConsumer,
        skipCorpusInReadiness: deps.skipCorpusInReadiness,
      });

      readiness = result.readiness;
      domains = {
        brand: job.domains.brand ?? emptyPendingDomains().brand,
        terminology: job.domains.terminology ?? emptyPendingDomains().terminology,
        webUi: await syncWebUiDomainProgress(job, readiness),
        controlledVocabulary: buildControlledVocabularyDomainProgress(readiness),
        ct: buildHistoricalDomainProgress({
          bucket: readiness.ct,
          enqueueAttempted: true,
          enqueuedAt: job.domains.ct.enqueuedAt ?? stamp,
          owner: "CT",
        }),
        plp: buildHistoricalDomainProgress({
          bucket: readiness.plpMedia,
          enqueueAttempted: true,
          enqueuedAt: job.domains.plp.enqueuedAt ?? stamp,
          owner: "PLP",
        }),
      };
    }

    const automaticProgress = await automaticProgressForLocale(
      canonicalLocale,
      readiness,
    );
    const status = deriveActivationJobStatus({
      readiness,
      domains,
      ctEnqueueAttempted: domains.ct.enqueueAttempted,
      plpEnqueueAttempted: domains.plp.enqueueAttempted,
      automaticProgress,
    });

    job = {
      ...job,
      status,
      domains,
      diagnosticSummary: buildDiagnosticSummary({ status, readiness, domains }),
      updatedAt: nowIso(),
      completedAt:
        status === "completed" || status === "failed" ? nowIso() : null,
      lastError: lastErrorForDerivedActivation({
        status,
        automaticProgress,
        domains,
        previous: job.lastError,
      }),
      searchEnabledSnapshot: registry.searchEnabled,
      seoIndexingEnabledSnapshot: registry.seoIndexingEnabled,
    };

    await saveLanguageActivationJob(job);

    // Gate C.2 — durable residual driver wake. Does not reopen completed→running.
    // Activation prepares the language; reconciliation converges content after READY.
    const workItemsRequired =
      readiness.ct.workItemsRequired + readiness.plpMedia.workItemsRequired;
    if (webUiReadyForHistorical && workItemsRequired > 0) {
      void import("../localization-reconciliation-driver.js").then(
        ({ wakeLocalizationReconciliationAfterActivation }) => {
          wakeLocalizationReconciliationAfterActivation({
            locale: canonicalLocale,
            webUiReady: true,
            activationStatus: job.status,
            workItemsRequired,
          });
        },
      );
    }

    return job;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed.";
    job = {
      ...job,
      status: "failed",
      lastError: message,
      diagnosticSummary: `failed — ${message}`,
      updatedAt: nowIso(),
      completedAt: nowIso(),
    };
    await saveLanguageActivationJob(job);
    return job;
  }
}

/**
 * Provider-free Admin status: project persisted activation + checkpoint progress.
 * Does not call the translation provider and does not enqueue preparation.
 */
export async function getLanguageActivationAdminView(input: {
  readonly actorUserId: string;
  readonly languageId: string;
  readonly refreshJob?: boolean;
}): Promise<LanguageActivationAdminView> {
  await assertAdminActor(input.actorUserId);
  const record = await loadRegistryForLanguageId(input.languageId);
  /** Gate A — Admin readiness always evaluates Registry CANONICAL LOCALE. */
  const locale = record.locale;
  const deps = processDeps();
  const evaluate = deps.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;

  let job =
    (await getActiveLanguageActivationJobByLocale(locale)) ??
    (await getLatestLanguageActivationJobByLocale(locale));

  const readiness = await evaluate({
    locale,
    registryRecord: record,
    plannerDeps: deps.plannerDeps,
    skipCorpusPlan: deps.skipCorpusInReadiness === true,
  });

  if (
    job &&
    input.refreshJob !== false &&
    (job.status === "waiting_for_data" ||
      job.status === "running" ||
      job.status === "queued" ||
      job.status === "failed")
  ) {
    const latest = (await getLanguageActivationJobById(job.jobId)) ?? job;
    const claimed = isClaimedActivationStatus(latest.status);
    const domains = await refreshDomains(latest, readiness, { claimed });
    const automaticProgress = await automaticProgressForLocale(locale, readiness);
    let status = deriveActivationJobStatus({
      readiness,
      domains,
      ctEnqueueAttempted: domains.ct.enqueueAttempted,
      plpEnqueueAttempted: domains.plp.enqueueAttempted,
      automaticProgress,
    });
    if (
      claimed &&
      status === "waiting_for_data" &&
      domains.webUi.status !== "failed" &&
      !domains.webUi.providerFailure &&
      domains.webUi.dataReady !== true
    ) {
      status = latest.status === "queued" ? "queued" : "running";
    }
    const raced = await getLanguageActivationJobById(job.jobId);
    const tickWon =
      raced != null &&
      raced.updatedAt !== latest.updatedAt &&
      isClaimedActivationStatus(raced.status) &&
      (raced.domains.webUi.status === "in_progress" ||
        raced.domains.webUi.preparationPhase === "primary" ||
        raced.domains.webUi.preparationPhase === "quality" ||
        raced.domains.webUi.preparationPhase === "validating" ||
        raced.domains.webUi.preparationPhase === "publishing" ||
        raced.domains.webUi.preparationPhase === "provider_cooldown" ||
        raced.domains.webUi.preparationPhase === "structure_retry" ||
        raced.domains.webUi.preparationPhase === "structure_blocked");
    if (tickWon && raced) {
      job = raced;
    } else if (
      status !== latest.status ||
      domains.webUi.status !== latest.domains.webUi.status ||
      domains.webUi.preparationPhase !== latest.domains.webUi.preparationPhase ||
      domains.webUi.completedBatches !== latest.domains.webUi.completedBatches ||
      domains.webUi.missingKeyCount !== latest.domains.webUi.missingKeyCount ||
      domains.controlledVocabulary.conceptsMissing !==
        latest.domains.controlledVocabulary.conceptsMissing
    ) {
      job = {
        ...latest,
        status,
        domains,
        diagnosticSummary: buildDiagnosticSummary({ status, readiness, domains }),
        updatedAt: nowIso(),
        completedAt:
          status === "completed" || status === "failed"
            ? latest.completedAt ?? nowIso()
            : null,
        lastError: lastErrorForDerivedActivation({
          status,
          automaticProgress,
          domains,
          previous: latest.lastError,
        }),
      };
      await saveLanguageActivationJob(job);
    } else {
      job = latest;
    }
  }

  return toAdminView({
    job,
    readiness,
    notes: [
      "Manual uiTranslationStatus never overrides measured WEB_UI readiness.",
      "Search/SEO remain separate Admin opt-in flags.",
    ],
  });
}

const scheduled = new Set<string>();
const scheduledWebUi = new Set<string>();
/** Coalesced follow-up when a tick is requested while this job already owns the slot. */
const webUiFollowUpRequested = new Set<string>();
/** One delayed cooldown timer per jobId (live-process optimization). */
const webUiDelayedTimers = new Map<string, ReturnType<typeof setTimeout>>();
const webUiDelayedNextAttemptAt = new Map<string, string>();
/** Delayed full-process wake for Brand/Terminology provider cooldown. */
const ownerDelayedTimers = new Map<string, ReturnType<typeof setTimeout>>();
const ownerDelayedNextAttemptAt = new Map<string, string>();

export function scheduleLanguageActivationJobProcess(jobId: string): void {
  if (scheduled.has(jobId)) {
    return;
  }
  scheduled.add(jobId);
  queueMicrotask(() => {
    void processLanguageActivationJob(jobId, { reconcileResiduals: true })
      .catch(() => {
        /* persisted as failed inside process */
      })
      .finally(() => {
        scheduled.delete(jobId);
      });
  });
}

/**
 * Schedule a delayed full activation process for Brand/Terminology cooldown.
 * Does not hold the translation worker slot while waiting.
 */
export function scheduleLanguageActivationJobProcessAt(
  jobId: string,
  nextAttemptAt: string,
  options?: { readonly notBefore?: boolean },
): void {
  const dueMs = Date.parse(nextAttemptAt);
  if (!Number.isFinite(dueMs)) {
    scheduleLanguageActivationJobProcess(jobId);
    return;
  }
  const existingAt = ownerDelayedNextAttemptAt.get(jobId);
  if (existingAt) {
    const existingMs = Date.parse(existingAt);
    if (Number.isFinite(existingMs)) {
      if (options?.notBefore) {
        if (existingMs >= dueMs) {
          return;
        }
      } else if (existingMs <= dueMs) {
        return;
      }
    }
    const prior = ownerDelayedTimers.get(jobId);
    if (prior) {
      clearTimeout(prior);
    }
  }
  const delayMs = Math.max(0, Math.min(dueMs - Date.now(), 2_147_483_647));
  ownerDelayedNextAttemptAt.set(jobId, nextAttemptAt);
  const timer = setTimeout(() => {
    ownerDelayedTimers.delete(jobId);
    ownerDelayedNextAttemptAt.delete(jobId);
    scheduleLanguageActivationJobProcess(jobId);
  }, delayMs);
  ownerDelayedTimers.set(jobId, timer);
}

/**
 * One WEB_UI tick at a time per job. A request made while the tick is in
 * flight is remembered and run after the lock is released, not dropped.
 */
export function scheduleWebUiActivationTick(jobId: string): void {
  if (scheduledWebUi.has(jobId)) {
    webUiFollowUpRequested.add(jobId);
    return;
  }
  scheduledWebUi.add(jobId);
  setImmediate(() => {
    let status: string | null = null;
    let nextCooldownAt: string | null = null;
    void processLanguageActivationJob(jobId, { webUiTick: true })
      .then((job) => {
        status = job.status;
        if (
          job.domains.webUi.preparationPhase === "provider_cooldown" ||
          job.domains.webUi.preparationPhase === "structure_retry" ||
          (job.domains.webUi.preparationPhase === "structure_blocked" &&
            job.domains.webUi.nextAttemptAt)
        ) {
          nextCooldownAt = job.domains.webUi.nextAttemptAt ?? null;
        }
      })
      .catch(() => {
        status = "failed";
      })
      .finally(() => {
        scheduledWebUi.delete(jobId);
        // Prefer delayed cooldown over an immediate follow-up tick.
        if (nextCooldownAt && (status === "running" || status === "queued")) {
          webUiFollowUpRequested.delete(jobId);
          scheduleWebUiActivationTickAt(jobId, nextCooldownAt);
          return;
        }
        const followUp = webUiFollowUpRequested.delete(jobId);
        if (followUp && (status === "running" || status === "queued")) {
          scheduleWebUiActivationTick(jobId);
        }
      });
  });
}

/**
 * Schedule a single delayed WEB_UI tick for provider cooldown.
 * Duplicate requests coalesce to one timer per jobId; earlier due time wins.
 */
export function scheduleWebUiActivationTickAt(
  jobId: string,
  nextAttemptAt: string,
  options?: { readonly notBefore?: boolean },
): void {
  const dueMs = Date.parse(nextAttemptAt);
  if (!Number.isFinite(dueMs)) {
    scheduleWebUiActivationTick(jobId);
    return;
  }
  const existingAt = webUiDelayedNextAttemptAt.get(jobId);
  if (existingAt) {
    const existingMs = Date.parse(existingAt);
    if (Number.isFinite(existingMs)) {
      if (options?.notBefore) {
        if (existingMs >= dueMs) {
          return;
        }
      } else if (existingMs <= dueMs) {
        return;
      }
    }
    const prior = webUiDelayedTimers.get(jobId);
    if (prior) {
      clearTimeout(prior);
    }
  }
  const delayMs = Math.max(0, Math.min(dueMs - Date.now(), 2_147_483_647));
  webUiDelayedNextAttemptAt.set(jobId, nextAttemptAt);
  const timer = setTimeout(() => {
    webUiDelayedTimers.delete(jobId);
    webUiDelayedNextAttemptAt.delete(jobId);
    scheduleWebUiActivationTick(jobId);
  }, delayMs);
  webUiDelayedTimers.set(jobId, timer);
}

export function getWebUiActivationSchedulerSnapshotForTests(jobId: string): {
  readonly inFlight: boolean;
  readonly followUpRequested: boolean;
  readonly delayedPending: boolean;
  readonly delayedNextAttemptAt: string | null;
} {
  return {
    inFlight: scheduledWebUi.has(jobId),
    followUpRequested: webUiFollowUpRequested.has(jobId),
    delayedPending: webUiDelayedTimers.has(jobId),
    delayedNextAttemptAt: webUiDelayedNextAttemptAt.get(jobId) ?? null,
  };
}

/**
 * API boot: resume incomplete WEB_UI checkpoints so Render recycle does not
 * depend on an operator clicking Activate again.
 * Provider_cooldown: schedule delayed or immediate continuation; zero provider
 * calls until a due tick executes.
 */
export async function resumeIncompleteWebUiActivationJobsOnBoot(): Promise<{
  readonly scheduled: number;
}> {
  const checkpoints = await listJobsNeedingWebUiActivationResume();
  const resumedJobIds = new Set<string>();
  let count = 0;
  for (const checkpoint of checkpoints) {
    const job = await getLanguageActivationJobById(checkpoint.jobId);
    if (!job) {
      continue;
    }
    if (!isClaimedActivationStatus(job.status)) {
      continue;
    }
    const nextAttemptAt = checkpoint.nextAttemptAt ?? null;
    const dueMs = nextAttemptAt ? Date.parse(nextAttemptAt) : NaN;
    if (nextAttemptAt && Number.isFinite(dueMs) && dueMs > Date.now()) {
      scheduleWebUiActivationTickAt(job.jobId, nextAttemptAt);
    } else {
      scheduleWebUiActivationTick(job.jobId);
    }
    resumedJobIds.add(job.jobId);
    count += 1;
  }
  // Brand / Terminology durable cooldown — resume running jobs after restart.
  // A failed job reopens only when its open WEB_UI batch is a recoverable
  // provider-shape failure on the current source and plan. Other failed jobs
  // stay closed.
  const jobs = await listLanguageActivationJobs();
  for (const job of jobs) {
    if (job.status !== "failed" || resumedJobIds.has(job.jobId)) {
      continue;
    }
    const recovered = await tryReopenRecoverableFailedWebUiCheckpoint({
      jobId: job.jobId,
      deps: processDeps().webUiPreparationDeps,
    });
    if (!recovered) {
      continue;
    }
    const restored = await saveLanguageActivationJob({
      ...job,
      status: "running",
      lastError: null,
      completedAt: null,
      domains: {
        ...job.domains,
        webUi: recovered.webUi,
      },
      diagnosticSummary:
        recovered.webUi.detail ?? "running — Preparing public interface…",
      updatedAt: nowIso(),
    });
    scheduleWebUiActivationTick(restored.jobId);
    resumedJobIds.add(restored.jobId);
    count += 1;
  }
  for (const job of jobs) {
    if (!isClaimedActivationStatus(job.status) || resumedJobIds.has(job.jobId)) {
      continue;
    }
    const brandNext = job.domains.brand.nextAttemptAt ?? null;
    const termNext = job.domains.terminology.nextAttemptAt ?? null;
    const ownerCooling =
      (job.domains.brand.status === "in_progress" && brandNext) ||
      (job.domains.terminology.status === "in_progress" && termNext);
    if (ownerCooling) {
      const nextAttemptAt = brandNext ?? termNext!;
      const dueMs = Date.parse(nextAttemptAt);
      if (Number.isFinite(dueMs) && dueMs > Date.now()) {
        scheduleLanguageActivationJobProcessAt(job.jobId, nextAttemptAt);
      } else {
        scheduleLanguageActivationJobProcess(job.jobId);
      }
      resumedJobIds.add(job.jobId);
      count += 1;
      continue;
    }
    const webUi = job.domains.webUi;
    if (
      webUi.dataReady ||
      webUi.status === "ready" ||
      webUi.status === "failed" ||
      webUi.providerFailure ||
      webUi.checkpointId
    ) {
      // Shared-cooldown corpus deferral stores the wake here without changing
      // WEB_UI phase. A restart has no in-memory timer.
      const wakeAt = webUi.nextAttemptAt ?? null;
      if (
        wakeAt &&
        job.status === "running" &&
        webUi.status !== "failed" &&
        webUi.preparationPhase !== "provider_cooldown" &&
        webUi.preparationPhase !== "structure_retry"
      ) {
        const dueMs = Date.parse(wakeAt);
        if (Number.isFinite(dueMs) && dueMs > Date.now()) {
          scheduleLanguageActivationJobProcessAt(job.jobId, wakeAt, { notBefore: true });
        } else {
          scheduleLanguageActivationJobProcess(job.jobId);
        }
        resumedJobIds.add(job.jobId);
        count += 1;
      }
      continue;
    }
    scheduleLanguageActivationJobProcess(job.jobId);
    count += 1;
  }
  return { scheduled: count };
}

export function resetLanguageActivationJobSchedulerForTests(): void {
  scheduled.clear();
  scheduledWebUi.clear();
  webUiFollowUpRequested.clear();
  for (const timer of webUiDelayedTimers.values()) {
    clearTimeout(timer);
  }
  webUiDelayedTimers.clear();
  webUiDelayedNextAttemptAt.clear();
  for (const timer of ownerDelayedTimers.values()) {
    clearTimeout(timer);
  }
  ownerDelayedTimers.clear();
  ownerDelayedNextAttemptAt.clear();
}

/** Test helper: run process synchronously without scheduler. */
export async function startAndProcessLanguageActivationJobForTests(input: {
  readonly actorUserId: string;
  readonly languageId: string;
  /** Drain WEB_UI ticks until done or failed (default true). */
  readonly drainWebUiTicks?: boolean;
}): Promise<LanguageActivationAdminView> {
  const started = await startOrResumeLanguageActivationJob({
    ...input,
    scheduleProcess: false,
  });
  if (!started.job) {
    return started;
  }
  if (started.job.status === "completed" || started.job.status === "failed") {
    return started;
  }
  let job = await processLanguageActivationJob(started.job.jobId, {
    reconcileResiduals: true,
  });
  if (input.drainWebUiTicks !== false) {
    let guard = 0;
    while (
      job.status === "running" &&
      job.domains.webUi.preparationPhase !== "provider_cooldown" &&
      job.domains.webUi.preparationPhase !== "structure_retry" &&
      job.domains.webUi.preparationPhase !== "structure_blocked" &&
      (job.domains.webUi.status === "in_progress" ||
        job.domains.webUi.preparationPhase === "primary" ||
        job.domains.webUi.preparationPhase === "quality" ||
        job.domains.webUi.preparationPhase === "validating" ||
        job.domains.webUi.preparationPhase === "publishing") &&
      guard < 5000
    ) {
      guard += 1;
      job = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    }
  }
  const record = await loadRegistryForLanguageId(input.languageId);
  const deps = processDeps();
  const evaluate = deps.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;
  const readiness = await evaluate({
    locale: record.locale,
    registryRecord: record,
    plannerDeps: deps.plannerDeps,
    skipCorpusPlan: deps.skipCorpusInReadiness === true,
  });
  return toAdminView({ job, readiness });
}
