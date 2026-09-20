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
import { activateLanguageLocalization } from "./language-activation-orchestrator.js";
import type { ActivateLanguageLocalizationInput } from "./language-activation-orchestrator.js";
import type { LanguageHistoricalBackfillPlannerDeps } from "./language-historical-backfill-planner.js";
import {
  buildControlledVocabularyDomainProgress,
  buildDiagnosticSummary,
  buildHistoricalDomainProgress,
  buildWebUiDomainProgress,
  brandDomainFromPreparationResult,
  brandDomainPreparing,
  brandDomainProviderConfigFailure,
  deriveActivationJobStatus,
  emptyPendingDomains,
  terminologyDomainFromPreparationResult,
  terminologyDomainPreparing,
  terminologyDomainProviderConfigFailure,
} from "./language-activation-job.domains.js";
import { LanguageActivationJobValidationError } from "./language-activation-job.errors.js";
import {
  getActiveLanguageActivationJobByLocale,
  getLatestLanguageActivationJobByLocale,
  getLanguageActivationJobById,
  saveLanguageActivationJob,
} from "./language-activation-job.repository.js";
import { evaluateLanguageLocalizationReadiness } from "./language-localization-readiness-evaluator.js";
import {
  LanguageOwnerPreparationError,
  runLanguageOwnerPreparation,
  type LanguageOwnerPreparationInput,
  type LanguageOwnerPreparationResult,
} from "../../language-preparation/language-owner-preparation.js";
import { withContentTranslationWorkerSlot } from "../content-translation-worker-concurrency.js";
import {
  listJobsNeedingWebUiActivationResume,
  processWebUiActivationTick,
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
): Promise<LanguageActivationJobRecord["domains"]> {
  const webUi = await syncWebUiDomainProgress(job, readiness);
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

/**
 * Provider-free: copy durable checkpoint progress onto domains.webUi, else measure.
 */
async function syncWebUiDomainProgress(
  job: LanguageActivationJobRecord,
  readiness: LanguageLocalizationReadinessReport,
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
  return buildWebUiDomainProgress(readiness, job.domains.webUi);
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
  assertActivationEligible(record);

  const locale = normalizeLanguageRegistryLocaleKey(record.locale);
  const deps = processDeps();
  const evaluate = deps.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;

  const active = await getActiveLanguageActivationJobByLocale(locale);
  if (active) {
    if (input.scheduleProcess !== false) {
      scheduleLanguageActivationJobProcess(active.jobId);
    }
    const readiness = await evaluate({
      locale,
      registryRecord: record,
      plannerDeps: deps.plannerDeps,
      skipCorpusPlan: deps.skipCorpusInReadiness === true,
    });
    return toAdminView({
      job: active,
      readiness,
      notes: ["Resumed existing activation job (idempotent)."],
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

  const createdAt = nowIso();
  const generation = (latest?.generation ?? 0) + 1;
  const job: LanguageActivationJobRecord = {
    jobId: `lang-act-${locale}-${generation}-${randomUUID().slice(0, 8)}`,
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
    createdByParticipantId: admin.participantId,
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
      job.locale !== "en";

    if (shouldPrepareOwners) {
      const prepare = deps.runOwnerPreparation ?? runLanguageOwnerPreparation;

      job = {
        ...job,
        domains: {
          ...job.domains,
          brand: brandDomainPreparing(),
        },
        diagnosticSummary: "running — Preparing Brand…",
        updatedAt: nowIso(),
      };
      await saveLanguageActivationJob(job);

      try {
        const brandResult = await prepare({
          locale: job.locale,
          execute: true,
          owners: ["brand"],
          log: () => undefined,
        });
        job = {
          ...job,
          domains: {
            ...job.domains,
            brand: brandDomainFromPreparationResult(brandResult),
            terminology: terminologyDomainPreparing(),
          },
          diagnosticSummary: "running — Preparing terminology…",
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);

        const terminologyResult = await prepare({
          locale: job.locale,
          execute: true,
          owners: ["terminology"],
          log: () => undefined,
        });
        job = {
          ...job,
          domains: {
            ...job.domains,
            terminology: terminologyDomainFromPreparationResult(terminologyResult),
          },
          updatedAt: nowIso(),
        };
        await saveLanguageActivationJob(job);
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
            brand:
              job.domains.brand.status === "ready"
                ? job.domains.brand
                : brandDomainProviderConfigFailure(providerFailureMessage),
            terminology: terminologyDomainProviderConfigFailure(providerFailureMessage),
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

      if (
        job.domains.brand.status === "failed" ||
        job.domains.terminology.status === "failed"
      ) {
        job = {
          ...job,
          status: "failed",
          lastError:
            job.domains.terminology.detail ??
            job.domains.brand.detail ??
            "Owner preparation failed.",
          diagnosticSummary: buildDiagnosticSummary({
            status: "failed",
            readiness: await evaluate({
              locale: job.locale,
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
      job.locale !== "en";

    if (shouldPrepareWebUi) {
      const tick = await withContentTranslationWorkerSlot(() =>
        processWebUiActivationTick({
          job,
          checkpointId: job.domains.webUi.checkpointId,
          deps: deps.webUiPreparationDeps,
        }),
      );
      job = {
        ...job,
        domains: {
          ...job.domains,
          webUi: tick.webUi,
        },
        diagnosticSummary: tick.webUi.detail ?? "running — Preparing public interface…",
        updatedAt: nowIso(),
      };

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

    let readiness = await evaluate({
      locale: job.locale,
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

    // WEB_UI waiting_for_data does not block enqueue; presentation-ready still requires WEB_UI.
    // Skip residual reconcile while WEB_UI preparation is still in progress.
    const webUiStillPreparing =
      domains.webUi.status === "in_progress" ||
      domains.webUi.preparationPhase === "primary" ||
      domains.webUi.preparationPhase === "quality" ||
      domains.webUi.preparationPhase === "validating" ||
      domains.webUi.preparationPhase === "publishing";

    if (shouldReconcileResiduals && !webUiStillPreparing) {
      const stamp = nowIso();
      const result = await activate({
        locale: job.locale,
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

    const status = deriveActivationJobStatus({
      readiness,
      domains,
      ctEnqueueAttempted: domains.ct.enqueueAttempted,
      plpEnqueueAttempted: domains.plp.enqueueAttempted,
    });

    job = {
      ...job,
      status,
      domains,
      diagnosticSummary: buildDiagnosticSummary({ status, readiness, domains }),
      updatedAt: nowIso(),
      completedAt:
        status === "completed" || status === "failed" ? nowIso() : null,
      lastError:
        status === "failed"
          ? domains.webUi.detail ??
            domains.terminology.detail ??
            domains.brand.detail ??
            job.lastError
          : null,
      searchEnabledSnapshot: registry.searchEnabled,
      seoIndexingEnabledSnapshot: registry.seoIndexingEnabled,
    };

    await saveLanguageActivationJob(job);
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
 * Provider-free Admin status: refresh measured readiness onto the job record.
 */
export async function getLanguageActivationAdminView(input: {
  readonly actorUserId: string;
  readonly languageId: string;
  readonly refreshJob?: boolean;
}): Promise<LanguageActivationAdminView> {
  await assertAdminActor(input.actorUserId);
  const record = await loadRegistryForLanguageId(input.languageId);
  const locale = normalizeLanguageRegistryLocaleKey(record.locale);
  const deps = processDeps();
  const evaluate = deps.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;

  let job =
    (await getActiveLanguageActivationJobByLocale(locale)) ??
    (await getLatestLanguageActivationJobByLocale(locale));

  if (job && input.refreshJob !== false && (job.status === "waiting_for_data" || job.status === "running" || job.status === "queued")) {
    // Status refresh may finish a never-attempted tick. It does not reconcile
    // after enqueueAttempted, so polling cannot enqueue in a loop.
    job = await processLanguageActivationJob(job.jobId);
  }

  const readiness = await evaluate({
    locale,
    registryRecord: record,
    plannerDeps: deps.plannerDeps,
    skipCorpusPlan: deps.skipCorpusInReadiness === true,
  });

  if (job) {
    const domains = await refreshDomains(job, readiness);
    const status = deriveActivationJobStatus({
      readiness,
      domains,
      ctEnqueueAttempted: domains.ct.enqueueAttempted,
      plpEnqueueAttempted: domains.plp.enqueueAttempted,
    });
    if (
      status !== job.status ||
      domains.webUi.missingKeyCount !== job.domains.webUi.missingKeyCount ||
      domains.controlledVocabulary.conceptsMissing !==
        job.domains.controlledVocabulary.conceptsMissing
    ) {
      job = {
        ...job,
        status,
        domains,
        diagnosticSummary: buildDiagnosticSummary({ status, readiness, domains }),
        updatedAt: nowIso(),
        completedAt:
          status === "completed" || status === "failed"
            ? job.completedAt ?? nowIso()
            : null,
      };
      await saveLanguageActivationJob(job);
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
 * Schedule the next one-batch WEB_UI tick (setImmediate so HTTP returns first).
 */
export function scheduleWebUiActivationTick(jobId: string): void {
  if (scheduledWebUi.has(jobId)) {
    return;
  }
  scheduledWebUi.add(jobId);
  setImmediate(() => {
    void processLanguageActivationJob(jobId, { webUiTick: true })
      .catch(() => {
        /* persisted as failed inside process */
      })
      .finally(() => {
        scheduledWebUi.delete(jobId);
      });
  });
}

/**
 * API boot: resume incomplete WEB_UI checkpoints so Render recycle does not
 * depend on an operator clicking Activate again.
 */
export async function resumeIncompleteWebUiActivationJobsOnBoot(): Promise<{
  readonly scheduled: number;
}> {
  const checkpoints = await listJobsNeedingWebUiActivationResume();
  let count = 0;
  for (const checkpoint of checkpoints) {
    const job = await getLanguageActivationJobById(checkpoint.jobId);
    if (!job) {
      continue;
    }
    if (job.status !== "queued" && job.status !== "running") {
      continue;
    }
    scheduleWebUiActivationTick(job.jobId);
    count += 1;
  }
  return { scheduled: count };
}

export function resetLanguageActivationJobSchedulerForTests(): void {
  scheduled.clear();
  scheduledWebUi.clear();
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
