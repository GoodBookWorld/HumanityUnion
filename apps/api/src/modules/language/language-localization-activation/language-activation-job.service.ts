/**
 * Admin language localization activation job service.
 *
 * HTTP path: create/resume job + return status (no provider).
 * Async tick: assess WEB_UI/CV, enqueue CT/PLP residual once per generation.
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
  deriveActivationJobStatus,
  emptyPendingDomains,
} from "./language-activation-job.domains.js";
import { LanguageActivationJobValidationError } from "./language-activation-job.errors.js";
import {
  getActiveLanguageActivationJobByLocale,
  getLatestLanguageActivationJobByLocale,
  getLanguageActivationJobById,
  saveLanguageActivationJob,
} from "./language-activation-job.repository.js";
import { evaluateLanguageLocalizationReadiness } from "./language-localization-readiness-evaluator.js";

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
  const webUi = await buildWebUiDomainProgress(readiness);
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
  return { webUi, controlledVocabulary, ct, plp };
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
      "Activation job queued. CT/PLP residual enqueue runs asynchronously (no provider in this request).",
      "Search/SEO flags are not modified by activation.",
    ],
  });
}

/**
 * Advance one activation job: readiness → WEB_UI/CV domains → CT/PLP enqueue once.
 * Side-effect free regarding Search/SEO. Provider only via existing CT/PLP workers later.
 */
export async function processLanguageActivationJob(
  jobId: string,
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
    let readiness = await evaluate({
      locale: job.locale,
      registryRecord: registry,
      plannerDeps: deps.plannerDeps,
      skipCorpusPlan: deps.skipCorpusInReadiness === true,
    });

    let domains = await refreshDomains(job, readiness);

    const enqueueAlreadyDone =
      job.domains.ct.enqueueAttempted && job.domains.plp.enqueueAttempted;

    // One execute per generation — residual CT/PLP enqueue is idempotent downstream.
    // WEB_UI waiting_for_data does not block enqueue; presentation-ready still requires WEB_UI.
    if (!enqueueAlreadyDone) {
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
        webUi: await buildWebUiDomainProgress(readiness),
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
      lastError: null,
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

export function scheduleLanguageActivationJobProcess(jobId: string): void {
  if (scheduled.has(jobId)) {
    return;
  }
  scheduled.add(jobId);
  queueMicrotask(() => {
    void processLanguageActivationJob(jobId)
      .catch(() => {
        /* persisted as failed inside process */
      })
      .finally(() => {
        scheduled.delete(jobId);
      });
  });
}

export function resetLanguageActivationJobSchedulerForTests(): void {
  scheduled.clear();
}

/** Test helper: run process synchronously without scheduler. */
export async function startAndProcessLanguageActivationJobForTests(input: {
  readonly actorUserId: string;
  readonly languageId: string;
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
  const job = await processLanguageActivationJob(started.job.jobId);
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
