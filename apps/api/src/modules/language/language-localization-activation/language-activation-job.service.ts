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
  listLanguageActivationJobs,
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
  evaluateFailedWebUiActivationResume,
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
 * Persist explicit Activate/Resume as active work before the Admin response.
 * Same job id and generation. Does not call the translation provider.
 */
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
    domains.webUi.preparationPhase === "provider_cooldown";
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
  const derived = deriveActivationJobStatus({
    readiness,
    domains,
    ctEnqueueAttempted: domains.ct.enqueueAttempted,
    plpEnqueueAttempted: domains.plp.enqueueAttempted,
  });
  const status = derived === "failed" ? "failed" : "running";
  const claimed: LanguageActivationJobRecord = {
    ...job,
    status,
    domains,
    startedAt: job.startedAt ?? nowIso(),
    completedAt: status === "failed" ? nowIso() : null,
    updatedAt: nowIso(),
    lastError: status === "failed" ? job.lastError : null,
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
    const readiness = await evaluate({
      locale,
      registryRecord: record,
      plannerDeps: deps.plannerDeps,
      skipCorpusPlan: deps.skipCorpusInReadiness === true,
    });
    const claimed = await claimLanguageActivationJob(active, readiness);
    const coolingDown =
      claimed.domains.webUi.preparationPhase === "provider_cooldown" ||
      (claimed.domains.webUi.nextAttemptAt != null &&
        claimed.domains.webUi.nextAttemptAt.length > 0);
    if (coolingDown) {
      const nextAttemptAt = claimed.domains.webUi.nextAttemptAt ?? null;
      if (nextAttemptAt) {
        scheduleWebUiActivationTickAt(claimed.jobId, nextAttemptAt);
      }
      return toAdminView({
        job: claimed,
        readiness,
        notes: [
          "Automatic translation-provider cooldown is pending. No new job or checkpoint created.",
        ],
      });
    }
    if (input.scheduleProcess !== false && claimed.status !== "failed") {
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

      if (
        tick.checkpoint?.phase === "provider_cooldown" ||
        tick.webUi.preparationPhase === "provider_cooldown"
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
      domains.webUi.preparationPhase === "publishing" ||
      domains.webUi.preparationPhase === "provider_cooldown";

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
  const locale = normalizeLanguageRegistryLocaleKey(record.locale);
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
      job.status === "queued")
  ) {
    const latest = (await getLanguageActivationJobById(job.jobId)) ?? job;
    const claimed = isClaimedActivationStatus(latest.status);
    const domains = await refreshDomains(latest, readiness, { claimed });
    let status = deriveActivationJobStatus({
      readiness,
      domains,
      ctEnqueueAttempted: domains.ct.enqueueAttempted,
      plpEnqueueAttempted: domains.plp.enqueueAttempted,
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
        raced.domains.webUi.preparationPhase === "provider_cooldown");
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
        if (job.domains.webUi.preparationPhase === "provider_cooldown") {
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
): void {
  const dueMs = Date.parse(nextAttemptAt);
  if (!Number.isFinite(dueMs)) {
    scheduleWebUiActivationTick(jobId);
    return;
  }
  const existingAt = webUiDelayedNextAttemptAt.get(jobId);
  if (existingAt) {
    const existingMs = Date.parse(existingAt);
    if (Number.isFinite(existingMs) && existingMs <= dueMs) {
      return;
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
    if (checkpoint.phase === "provider_cooldown") {
      const nextAttemptAt = checkpoint.nextAttemptAt ?? null;
      if (nextAttemptAt) {
        const dueMs = Date.parse(nextAttemptAt);
        if (Number.isFinite(dueMs) && dueMs > Date.now()) {
          scheduleWebUiActivationTickAt(job.jobId, nextAttemptAt);
        } else {
          scheduleWebUiActivationTick(job.jobId);
        }
      } else {
        scheduleWebUiActivationTick(job.jobId);
      }
    } else {
      scheduleWebUiActivationTick(job.jobId);
    }
    resumedJobIds.add(job.jobId);
    count += 1;
  }
  // Claimed jobs that died before the first checkpoint. Never scan historical
  // waiting_for_data jobs — those have no fresh activation intent.
  const jobs = await listLanguageActivationJobs();
  for (const job of jobs) {
    if (!isClaimedActivationStatus(job.status) || resumedJobIds.has(job.jobId)) {
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
