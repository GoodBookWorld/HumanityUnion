/**
 * Durable server-side WEB_UI preparation for LanguageActivationJob (Step 15C).
 *
 * One batch per tick. Checkpoints + batch values in child Mongo collections.
 * Never publishes partial catalogs. Live terminology only.
 * Does not call Gemini from HTTP/status paths — callers schedule ticks.
 */

import { randomUUID } from "node:crypto";

import type {
  LanguageActivationJobRecord,
  LanguageActivationWebUiDomainProgress,
  WebUiActivationCheckpointRecord,
  WebUiMessageTree,
} from "@hu/types";

import { resolveLanguagePreparationLocaleMetadata } from "../language-preparation/language-registry-metadata.js";
import { resolveProviderTerminologyContext } from "../language/terminology-glossary/terminology-glossary.provider-context.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../language/translation-provider.js";
import { TranslationProviderError } from "../language/translation.config.js";
import { classifyEnglishIdenticalWebUiTree } from "./web-ui-identical-classification.js";
import {
  assertCompletePublicWebUiDraft,
  buildWebUiDraftTerminologyContext,
  hashWebUiEnglishFlatMap,
  isWebUiProviderBatchNonRetryable,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  resolveOfflineWebUiProviderTimeoutMs,
  sanitizeWebUiActivationFailureDetail,
  translateWebUiProviderBatch,
  unflattenWebUiMessageMap,
  WebUiDraftBuilderError,
  type WebUiDraftBatchPlan,
} from "./web-ui-draft-builder.js";
import {
  computeWebUiCooldownNextAttemptAt,
  isWebUiRateLimitedError,
} from "./web-ui-provider-cooldown.js";
import {
  assembleWebUiActivationTranslatedMap,
  getWebUiActivationBatch,
  getWebUiActivationCheckpoint,
  getWebUiActivationCheckpointByJobId,
  listIncompleteWebUiActivationCheckpoints,
  upsertWebUiActivationBatch,
  upsertWebUiActivationCheckpoint,
} from "./web-ui-activation-checkpoint.repository.js";
import {
  getPublishedWebUiMessagePackByLocale,
  upsertWebUiMessagePack,
} from "./web-ui-message-pack.repository.js";
import { assessWebUiCatalogReadinessForLocale } from "../language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import { collectStringPaths } from "./web-ui-message-pack.validate.js";

export type WebUiActivationTickResult = {
  readonly done: boolean;
  readonly needsAnotherTick: boolean;
  readonly published: boolean;
  readonly webUi: LanguageActivationWebUiDomainProgress;
  readonly checkpoint: WebUiActivationCheckpointRecord | null;
  readonly providerCalls: number;
};

export type WebUiActivationPreparationDeps = {
  readonly translator?: (
    request: TranslationProviderRequest,
  ) => Promise<TranslationProviderResult>;
  readonly loadLiveTerminology?: (locale: string) => Promise<string>;
  readonly now?: () => string;
  /** Test-only: limit planned batches (does not change production). */
  readonly includePaths?: readonly string[];
  readonly env?: {
    readonly TRANSLATION_PROVIDER?: string;
    readonly HU_READ_ONLY_DIAGNOSTIC?: string;
  };
};

function nowIso(deps: WebUiActivationPreparationDeps): string {
  return (deps.now ?? (() => new Date().toISOString()))();
}

function readMessagePathValue(messages: unknown, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Step 15D.1 — when the public required corpus expands, seed ok batches from
 * an existing published pack so previously translated paths are not retranslated.
 * Incomplete batches are left for the normal provider path.
 */
export async function seedWebUiActivationBatchesFromPublishedPack(input: {
  readonly checkpointId: string;
  readonly locale: string;
  readonly flat: Readonly<Record<string, string>>;
  readonly deps?: WebUiActivationPreparationDeps;
}): Promise<{
  readonly seededBatchCount: number;
  readonly totalBatchCount: number;
}> {
  const deps = input.deps ?? {};
  const stamp = nowIso(deps);
  const published = await getPublishedWebUiMessagePackByLocale(input.locale);
  const batches = planWebUiDraftBatches(input.flat);
  if (!published) {
    return { seededBatchCount: 0, totalBatchCount: batches.length };
  }

  let seededBatchCount = 0;
  for (const batch of batches) {
    const values: Record<string, string> = {};
    let complete = true;
    for (const key of batch.keys) {
      const value = readMessagePathValue(published.messages, key);
      if (typeof value !== "string" || value.trim().length === 0) {
        complete = false;
        break;
      }
      values[key] = value;
    }
    if (!complete) {
      continue;
    }
    await upsertWebUiActivationBatch({
      checkpointId: input.checkpointId,
      batchId: batch.id,
      phase: "primary",
      namespace: batch.namespace,
      keys: batch.keys,
      values,
      status: "ok",
      attempts: 0,
      reason: "reused from published pack",
      updatedAt: stamp,
    });
    seededBatchCount += 1;
  }
  return { seededBatchCount, totalBatchCount: batches.length };
}

/**
 * Rebase a checkpoint onto the current public English corpus fingerprint.
 * Preserves the checkpoint id; seeds reusable published values; resumes primary.
 */
export async function rebaseWebUiCheckpointForCatalogExpansion(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly sourceHash: string;
  readonly flat: Readonly<Record<string, string>>;
  readonly requiredPaths: readonly string[];
  readonly deps?: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationCheckpointRecord> {
  const deps = input.deps ?? {};
  const batches = planWebUiDraftBatches(input.flat);
  const seeded = await seedWebUiActivationBatchesFromPublishedPack({
    checkpointId: input.checkpoint.checkpointId,
    locale: input.checkpoint.locale,
    flat: input.flat,
    deps,
  });
  const rebased: WebUiActivationCheckpointRecord = {
    ...input.checkpoint,
    sourceHash: input.sourceHash,
    phase: "primary",
    leafCount: input.requiredPaths.length,
    batchCount: batches.length,
    completedBatchCount: seeded.seededBatchCount,
    failedBatchCount: 0,
    qualityBatchCount: 0,
    qualityCompletedBatchCount: 0,
    suspiciousPathCount: 0,
    nextAttemptAt: null,
    transientFailureCount: 0,
    lastTransientFailure: null,
    detail:
      seeded.seededBatchCount > 0
        ? `Preparing public interface… ${seeded.seededBatchCount} / ${batches.length} batches`
        : "Preparing public interface…",
    updatedAt: nowIso(deps),
  };
  await upsertWebUiActivationCheckpoint(rebased);
  return rebased;
}

function countCompletedLeaves(
  batches: readonly { status: string; keys: readonly string[] }[],
): number {
  let count = 0;
  for (const batch of batches) {
    if (batch.status === "ok") {
      count += batch.keys.length;
    }
  }
  return count;
}

export function webUiProgressFromCheckpoint(input: {
  readonly readinessDataReady: boolean;
  readonly missingKeyCount: number;
  readonly emptyKeyCount: number;
  readonly requiredKeyCount: number;
  readonly effectiveSource: LanguageActivationWebUiDomainProgress["effectiveSource"];
  readonly checkpoint: WebUiActivationCheckpointRecord | null;
  readonly completedLeaves?: number;
}): LanguageActivationWebUiDomainProgress {
  const cp = input.checkpoint;
  if (!cp) {
    return {
      status: input.readinessDataReady ? "ready" : "waiting_for_data",
      dataReady: input.readinessDataReady,
      missingKeyCount: input.missingKeyCount,
      emptyKeyCount: input.emptyKeyCount,
      requiredKeyCount: input.requiredKeyCount,
      effectiveSource: input.effectiveSource,
      detail: input.readinessDataReady
        ? "Public interface ready"
        : `waiting_for_data missing=${input.missingKeyCount}`,
      preparationPhase: null,
      checkpointId: null,
      sourceHash: null,
      totalBatches: 0,
      completedBatches: 0,
      totalLeaves: input.requiredKeyCount,
      completedLeaves: 0,
      providerFailure: false,
    };
  }

  if (cp.phase === "failed") {
    return {
      status: "failed",
      dataReady: false,
      missingKeyCount: input.missingKeyCount,
      emptyKeyCount: input.emptyKeyCount,
      requiredKeyCount: input.requiredKeyCount,
      effectiveSource: input.effectiveSource,
      detail:
        cp.detail ??
        sanitizeWebUiActivationFailureDetail("Public interface translation failed — retry activation"),
      preparationPhase: "failed",
      checkpointId: cp.checkpointId,
      sourceHash: cp.sourceHash,
      totalBatches: cp.batchCount,
      completedBatches: cp.completedBatchCount,
      totalLeaves: cp.leafCount,
      completedLeaves: input.completedLeaves ?? 0,
      providerFailure: true,
      nextAttemptAt: null,
      transientFailureCount: cp.transientFailureCount ?? 0,
      lastTransientFailure: cp.lastTransientFailure ?? null,
    };
  }

  if (cp.phase === "ready") {
    return {
      status: "ready",
      dataReady: true,
      missingKeyCount: 0,
      emptyKeyCount: 0,
      requiredKeyCount: input.requiredKeyCount,
      effectiveSource: input.effectiveSource ?? "remote",
      detail: "Public interface ready",
      preparationPhase: "ready",
      checkpointId: cp.checkpointId,
      sourceHash: cp.sourceHash,
      totalBatches: cp.batchCount,
      completedBatches: cp.batchCount,
      totalLeaves: cp.leafCount,
      completedLeaves: cp.leafCount,
      providerFailure: false,
      nextAttemptAt: null,
      transientFailureCount: 0,
      lastTransientFailure: null,
    };
  }

  if (cp.phase === "provider_cooldown") {
    return {
      status: "in_progress",
      dataReady: false,
      missingKeyCount: input.missingKeyCount,
      emptyKeyCount: input.emptyKeyCount,
      requiredKeyCount: input.requiredKeyCount,
      effectiveSource: input.effectiveSource,
      detail: cp.detail ?? "Waiting for translation provider…",
      preparationPhase: "provider_cooldown",
      checkpointId: cp.checkpointId,
      sourceHash: cp.sourceHash,
      totalBatches: cp.batchCount,
      completedBatches: cp.completedBatchCount,
      totalLeaves: cp.leafCount,
      completedLeaves: input.completedLeaves ?? 0,
      providerFailure: false,
      nextAttemptAt: cp.nextAttemptAt ?? null,
      transientFailureCount: cp.transientFailureCount ?? 0,
      lastTransientFailure: cp.lastTransientFailure ?? null,
    };
  }

  let detail = "Preparing public interface…";
  if (cp.phase === "primary") {
    detail = `Preparing public interface… ${cp.completedBatchCount} / ${cp.batchCount} batches`;
  } else if (cp.phase === "quality") {
    detail = `Checking translation quality… ${cp.qualityCompletedBatchCount} / ${Math.max(cp.qualityBatchCount, 1)}`;
  } else if (cp.phase === "validating") {
    detail = "Validating public interface…";
  } else if (cp.phase === "publishing") {
    detail = "Publishing public interface…";
  }

  return {
    status: "in_progress",
    dataReady: false,
    missingKeyCount: input.missingKeyCount,
    emptyKeyCount: input.emptyKeyCount,
    requiredKeyCount: input.requiredKeyCount,
    effectiveSource: input.effectiveSource,
    detail,
    preparationPhase: cp.phase,
    checkpointId: cp.checkpointId,
    sourceHash: cp.sourceHash,
    totalBatches: cp.batchCount,
    completedBatches: cp.completedBatchCount,
    totalLeaves: cp.leafCount,
    completedLeaves: input.completedLeaves ?? 0,
    providerFailure: false,
    nextAttemptAt: null,
    transientFailureCount: cp.transientFailureCount ?? 0,
    lastTransientFailure: null,
  };
}

async function resolveTranslator(
  deps: WebUiActivationPreparationDeps,
): Promise<(request: TranslationProviderRequest) => Promise<TranslationProviderResult>> {
  if (deps.translator) {
    return deps.translator;
  }
  const envProvider = deps.env?.TRANSLATION_PROVIDER ?? process.env.TRANSLATION_PROVIDER;
  const envDiagnostic = deps.env?.HU_READ_ONLY_DIAGNOSTIC ?? process.env.HU_READ_ONLY_DIAGNOSTIC;
  if (envDiagnostic === "1") {
    throw new WebUiDraftBuilderError(
      "REFUSED: read-only diagnostic cannot call the translation provider.",
    );
  }
  if (envProvider?.trim().toLowerCase() !== "gemini") {
    throw new WebUiDraftBuilderError("REFUSED: WEB_UI activation requires TRANSLATION_PROVIDER=gemini.");
  }
  const { assertGeminiTranslationConfigured, resolveTranslationConfig } = await import(
    "../language/translation.config.js"
  );
  const { GeminiTranslationProvider } = await import(
    "../language/providers/gemini-translation-provider.js"
  );
  const config = resolveTranslationConfig();
  if (config.provider !== "gemini") {
    throw new WebUiDraftBuilderError("REFUSED: WEB_UI activation requires TRANSLATION_PROVIDER=gemini.");
  }
  assertGeminiTranslationConfigured(config);
  const provider = new GeminiTranslationProvider({
    ...config,
    timeoutMs: resolveOfflineWebUiProviderTimeoutMs(config.timeoutMs),
  });
  return (request) => provider.translate(request);
}

/**
 * True when effective ordinary WEB_UI (public ∪ participant) is complete — skip generation.
 */
export async function isPublicWebUiAlreadyReady(locale: string): Promise<boolean> {
  const ordinary = await assessOrdinaryWebUiCatalogReadiness(locale);
  return ordinary.dataReady === true;
}

async function assessOrdinaryWebUiCatalogReadiness(locale: string): Promise<{
  readonly dataReady: boolean;
  readonly missingKeyCount: number;
  readonly emptyKeyCount: number;
  readonly requiredKeyCount: number;
}> {
  const [publicReadiness, participantReadiness] = await Promise.all([
    assessWebUiCatalogReadinessForLocale({ locale }),
    assessWebUiCatalogReadinessForLocale({ locale, scope: "participant" }),
  ]);
  return {
    dataReady:
      publicReadiness.dataReady === true && participantReadiness.dataReady === true,
    missingKeyCount:
      publicReadiness.missingKeyCount + participantReadiness.missingKeyCount,
    emptyKeyCount: publicReadiness.emptyKeyCount + participantReadiness.emptyKeyCount,
    requiredKeyCount:
      publicReadiness.requiredKeyCount + participantReadiness.requiredKeyCount,
  };
}

/**
 * True when a failed WEB_UI checkpoint can reopen on the same job without
 * mixing catalogs. Catalog identity uses the durable sourceHash contract.
 */
export function isFailedWebUiCheckpointResumable(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly currentSourceHash: string;
}): boolean {
  const checkpoint = input.checkpoint;
  if (checkpoint.phase !== "failed") {
    return false;
  }
  if (checkpoint.sourceHash !== input.currentSourceHash) {
    return false;
  }
  if (/source catalog changed/i.test(checkpoint.detail ?? "")) {
    return false;
  }
  return true;
}

function reopenPhaseForFailedCheckpoint(
  checkpoint: WebUiActivationCheckpointRecord,
): "primary" | "quality" | "validating" | "publishing" {
  if (checkpoint.completedBatchCount < checkpoint.batchCount) {
    return "primary";
  }
  if (checkpoint.qualityCompletedBatchCount < checkpoint.qualityBatchCount) {
    return "quality";
  }
  if (checkpoint.suspiciousPathCount > 0 && checkpoint.qualityBatchCount === 0) {
    return "quality";
  }
  return "validating";
}

async function enterWebUiProviderCooldown(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly batch: WebUiDraftBatchPlan;
  readonly batchPhase: "primary" | "quality";
  readonly providerCalls: number;
  readonly deps: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationTickResult> {
  const deps = input.deps;
  const stamp = nowIso(deps);
  const streak = (input.checkpoint.transientFailureCount ?? 0) + 1;
  const nextAttemptAt = computeWebUiCooldownNextAttemptAt({
    nowIso: stamp,
    transientFailureCount: streak,
  });
  await upsertWebUiActivationBatch({
    checkpointId: input.checkpoint.checkpointId,
    batchId: input.batch.id,
    phase: input.batchPhase,
    namespace: input.batch.namespace,
    keys: input.batch.keys,
    values: {},
    status: "pending",
    attempts: input.providerCalls,
    reason: "rate_limited",
    updatedAt: stamp,
  });
  const checkpoint: WebUiActivationCheckpointRecord = {
    ...input.checkpoint,
    phase: "provider_cooldown",
    nextAttemptAt,
    transientFailureCount: streak,
    lastTransientFailure: "rate_limited",
    detail: "Waiting for translation provider…",
    updatedAt: stamp,
  };
  await upsertWebUiActivationCheckpoint(checkpoint);
  return {
    done: false,
    needsAnotherTick: true,
    published: false,
    providerCalls: input.providerCalls,
    checkpoint,
    webUi: webUiProgressFromCheckpoint({
      readinessDataReady: false,
      missingKeyCount: checkpoint.leafCount,
      emptyKeyCount: 0,
      requiredKeyCount: checkpoint.leafCount,
      effectiveSource: "none",
      checkpoint,
      completedLeaves: Math.min(checkpoint.leafCount, checkpoint.completedBatchCount * 6),
    }),
  };
}

async function resumeWebUiCheckpointAfterCooldown(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly deps: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationCheckpointRecord> {
  const deps = input.deps;
  const nowMs = Date.parse(nowIso(deps));
  const dueAt = input.checkpoint.nextAttemptAt
    ? Date.parse(input.checkpoint.nextAttemptAt)
    : 0;
  if (Number.isFinite(dueAt) && dueAt > nowMs) {
    return input.checkpoint;
  }
  const phase = reopenPhaseForFailedCheckpoint(input.checkpoint);
  let detail = "Preparing public interface…";
  if (phase === "primary") {
    detail = `Preparing public interface… ${input.checkpoint.completedBatchCount} / ${input.checkpoint.batchCount} batches`;
  } else if (phase === "quality") {
    detail = `Checking translation quality… ${input.checkpoint.qualityCompletedBatchCount} / ${Math.max(input.checkpoint.qualityBatchCount, 1)}`;
  } else if (phase === "validating") {
    detail = "Validating public interface…";
  } else if (phase === "publishing") {
    detail = "Publishing public interface…";
  }
  const resumed: WebUiActivationCheckpointRecord = {
    ...input.checkpoint,
    phase,
    nextAttemptAt: null,
    detail,
    updatedAt: nowIso(deps),
  };
  await upsertWebUiActivationCheckpoint(resumed);
  return resumed;
}

/**
 * Reopen a compatible failed checkpoint so the next tick selects the first
 * non-ok planned batch. Preserves ok rows and the same checkpoint id.
 */
export async function reopenFailedWebUiActivationCheckpoint(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly sourceHash: string;
  readonly deps?: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationCheckpointRecord> {
  const deps = input.deps ?? {};
  if (
    !isFailedWebUiCheckpointResumable({
      checkpoint: input.checkpoint,
      currentSourceHash: input.sourceHash,
    })
  ) {
    throw new WebUiDraftBuilderError(
      "WEB_UI checkpoint is not resumable with the current public catalog.",
    );
  }
  const phase = reopenPhaseForFailedCheckpoint(input.checkpoint);
  let detail = "Preparing public interface…";
  if (phase === "primary") {
    detail = `Preparing public interface… ${input.checkpoint.completedBatchCount} / ${input.checkpoint.batchCount} batches`;
  } else if (phase === "quality") {
    detail = `Checking translation quality… ${input.checkpoint.qualityCompletedBatchCount} / ${Math.max(input.checkpoint.qualityBatchCount, 1)}`;
  } else if (phase === "validating") {
    detail = "Validating public interface…";
  } else if (phase === "publishing") {
    detail = "Publishing public interface…";
  }
  const reopened: WebUiActivationCheckpointRecord = {
    ...input.checkpoint,
    phase,
    detail,
    nextAttemptAt: null,
    transientFailureCount: 0,
    lastTransientFailure: null,
    updatedAt: nowIso(deps),
  };
  await upsertWebUiActivationCheckpoint(reopened);
  return reopened;
}

/**
 * Decide whether a failed LanguageActivationJob can resume the same WEB_UI
 * checkpoint on explicit Activate. Does not mutate when restart is required.
 */
export async function evaluateFailedWebUiActivationResume(input: {
  readonly job: LanguageActivationJobRecord;
  readonly deps?: WebUiActivationPreparationDeps;
}): Promise<
  | {
      readonly kind: "resume";
      readonly checkpoint: WebUiActivationCheckpointRecord;
      readonly webUi: LanguageActivationWebUiDomainProgress;
    }
  | {
      readonly kind: "restart_required";
      readonly checkpoint: WebUiActivationCheckpointRecord;
      readonly webUi: LanguageActivationWebUiDomainProgress;
      readonly detail: string;
    }
  | { readonly kind: "not_applicable" }
> {
  const deps = input.deps ?? {};
  const checkpoint = await getWebUiActivationCheckpointByJobId(input.job.jobId);
  if (!checkpoint || checkpoint.phase !== "failed") {
    return { kind: "not_applicable" };
  }
  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(deps.includePaths);
  const sourceHash = hashWebUiEnglishFlatMap(flat);
  if (checkpoint.sourceHash !== sourceHash) {
    // Public corpus fingerprint changed (e.g. required-scope expansion).
    // Rebase the same checkpoint and reuse published values for covered batches.
    const rebased = await rebaseWebUiCheckpointForCatalogExpansion({
      checkpoint,
      sourceHash,
      flat,
      requiredPaths,
      deps,
    });
    return {
      kind: "resume",
      checkpoint: rebased,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: Math.max(0, requiredPaths.length - rebased.completedBatchCount * 6),
        emptyKeyCount: 0,
        requiredKeyCount: requiredPaths.length,
        effectiveSource: "none",
        checkpoint: rebased,
        completedLeaves: Math.min(rebased.leafCount, rebased.completedBatchCount * 6),
      }),
    };
  }
  if (
    !isFailedWebUiCheckpointResumable({
      checkpoint,
      currentSourceHash: sourceHash,
    })
  ) {
    const detail =
      "Public interface source catalog changed. Retry activation to start a new preparation.";
    const failed: WebUiActivationCheckpointRecord = {
      ...checkpoint,
      phase: "failed",
      detail,
      updatedAt: nowIso(deps),
    };
    await upsertWebUiActivationCheckpoint(failed);
    return {
      kind: "restart_required",
      checkpoint: failed,
      detail,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: failed.leafCount,
        emptyKeyCount: 0,
        requiredKeyCount: failed.leafCount,
        effectiveSource: "none",
        checkpoint: failed,
      }),
    };
  }
  const reopened = await reopenFailedWebUiActivationCheckpoint({
    checkpoint,
    sourceHash,
    deps,
  });
  return {
    kind: "resume",
    checkpoint: reopened,
    webUi: webUiProgressFromCheckpoint({
      readinessDataReady: false,
      missingKeyCount: Math.max(0, reopened.leafCount - reopened.completedBatchCount * 6),
      emptyKeyCount: 0,
      requiredKeyCount: reopened.leafCount,
      effectiveSource: "none",
      checkpoint: reopened,
      completedLeaves: Math.min(reopened.leafCount, reopened.completedBatchCount * 6),
    }),
  };
}

export async function ensureWebUiActivationCheckpoint(input: {
  readonly job: LanguageActivationJobRecord;
  readonly deps?: WebUiActivationPreparationDeps;
}): Promise<{
  readonly checkpoint: WebUiActivationCheckpointRecord | null;
  readonly skipped: boolean;
  readonly webUi: LanguageActivationWebUiDomainProgress;
}> {
  const locale = input.job.locale;
  const deps = input.deps ?? {};
  const readiness = await assessOrdinaryWebUiCatalogReadiness(locale);

  if (readiness.dataReady) {
    return {
      checkpoint: null,
      skipped: true,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: true,
        missingKeyCount: readiness.missingKeyCount,
        emptyKeyCount: readiness.emptyKeyCount,
        requiredKeyCount: readiness.requiredKeyCount,
        effectiveSource: "remote",
        checkpoint: null,
      }),
    };
  }

  // Prefer existing checkpoint for this job when sourceHash still matches.
  // Source-hash change (e.g. Step 15D.1 public-scope expansion) rebases the
  // same checkpoint and seeds reusable published values — no pack delete.
  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(deps.includePaths);
  const sourceHash = hashWebUiEnglishFlatMap(flat);
  const existing = await getWebUiActivationCheckpointByJobId(input.job.jobId);
  if (existing) {
    if (existing.sourceHash !== sourceHash) {
      const rebased = await rebaseWebUiCheckpointForCatalogExpansion({
        checkpoint: existing,
        sourceHash,
        flat,
        requiredPaths,
        deps,
      });
      return {
        checkpoint: rebased,
        skipped: false,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: false,
          missingKeyCount: readiness.missingKeyCount,
          emptyKeyCount: readiness.emptyKeyCount,
          requiredKeyCount: readiness.requiredKeyCount,
          effectiveSource: "none",
          checkpoint: rebased,
          completedLeaves: Math.min(rebased.leafCount, rebased.completedBatchCount * 6),
        }),
      };
    }
    if (existing.phase === "failed") {
      const reopened = await reopenFailedWebUiActivationCheckpoint({
        checkpoint: existing,
        sourceHash,
        deps,
      });
      return {
        checkpoint: reopened,
        skipped: false,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: false,
          missingKeyCount: readiness.missingKeyCount,
          emptyKeyCount: readiness.emptyKeyCount,
          requiredKeyCount: readiness.requiredKeyCount,
          effectiveSource: "none",
          checkpoint: reopened,
        }),
      };
    }
    if (existing.phase === "ready") {
      // Pack readiness already false above — reopen under the same hash.
      const reopened: WebUiActivationCheckpointRecord = {
        ...existing,
        phase: "primary",
        detail: `Preparing public interface… ${existing.completedBatchCount} / ${existing.batchCount} batches`,
        updatedAt: nowIso(deps),
      };
      await upsertWebUiActivationCheckpoint(reopened);
      return {
        checkpoint: reopened,
        skipped: false,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: false,
          missingKeyCount: readiness.missingKeyCount,
          emptyKeyCount: readiness.emptyKeyCount,
          requiredKeyCount: readiness.requiredKeyCount,
          effectiveSource: "none",
          checkpoint: reopened,
        }),
      };
    }
    return {
      checkpoint: existing,
      skipped: false,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: readiness.missingKeyCount,
        emptyKeyCount: readiness.emptyKeyCount,
        requiredKeyCount: readiness.requiredKeyCount,
        effectiveSource: "none",
        checkpoint: existing,
      }),
    };
  }

  const metadata = await resolveLanguagePreparationLocaleMetadata({
    locale,
  });
  const batches = planWebUiDraftBatches(flat);
  const checkpoint: WebUiActivationCheckpointRecord = {
    checkpointId: `webui-act-${input.job.jobId}-${randomUUID().slice(0, 8)}`,
    jobId: input.job.jobId,
    locale,
    generation: input.job.generation,
    sourceHash,
    terminologyMode: "live",
    phase: "primary",
    leafCount: requiredPaths.length,
    batchCount: batches.length,
    completedBatchCount: 0,
    failedBatchCount: 0,
    qualityBatchCount: 0,
    qualityCompletedBatchCount: 0,
    suspiciousPathCount: 0,
    englishName: metadata.englishName,
    nativeName: metadata.nativeName,
    textDirection: metadata.textDirection === "rtl" ? "rtl" : "ltr",
    detail: "Preparing public interface…",
    createdAt: nowIso(deps),
    updatedAt: nowIso(deps),
  };
  await upsertWebUiActivationCheckpoint(checkpoint);
  const seeded = await seedWebUiActivationBatchesFromPublishedPack({
    checkpointId: checkpoint.checkpointId,
    locale,
    flat,
    deps,
  });
  const seededCheckpoint: WebUiActivationCheckpointRecord =
    seeded.seededBatchCount > 0
      ? {
          ...checkpoint,
          completedBatchCount: seeded.seededBatchCount,
          detail: `Preparing public interface… ${seeded.seededBatchCount} / ${batches.length} batches`,
          updatedAt: nowIso(deps),
        }
      : checkpoint;
  if (seeded.seededBatchCount > 0) {
    await upsertWebUiActivationCheckpoint(seededCheckpoint);
  }
  return {
    checkpoint: seededCheckpoint,
    skipped: false,
    webUi: webUiProgressFromCheckpoint({
      readinessDataReady: false,
      missingKeyCount: readiness.missingKeyCount,
      emptyKeyCount: readiness.emptyKeyCount,
      requiredKeyCount: readiness.requiredKeyCount,
      effectiveSource: "none",
      checkpoint: seededCheckpoint,
      completedLeaves: Math.min(
        seededCheckpoint.leafCount,
        seededCheckpoint.completedBatchCount * 6,
      ),
    }),
  };
}

async function processPrimaryBatchTick(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly deps: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationTickResult> {
  const deps = input.deps;
  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(deps.includePaths);
  const sourceHash = hashWebUiEnglishFlatMap(flat);
  let checkpoint = input.checkpoint;

  if (checkpoint.sourceHash !== sourceHash) {
    checkpoint = await rebaseWebUiCheckpointForCatalogExpansion({
      checkpoint,
      sourceHash,
      flat,
      requiredPaths,
      deps,
    });
    return {
      done: false,
      needsAnotherTick: true,
      published: false,
      providerCalls: 0,
      checkpoint,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: Math.max(0, requiredPaths.length - checkpoint.completedBatchCount * 6),
        emptyKeyCount: 0,
        requiredKeyCount: requiredPaths.length,
        effectiveSource: "none",
        checkpoint,
        completedLeaves: Math.min(checkpoint.leafCount, checkpoint.completedBatchCount * 6),
      }),
    };
  }

  const batches = planWebUiDraftBatches(flat);
  const translator = await resolveTranslator(deps);
  const glossary =
    (await (deps.loadLiveTerminology ?? resolveProviderTerminologyContext)(checkpoint.locale)) ??
    "";
  const terminologyContext = buildWebUiDraftTerminologyContext({
    locale: checkpoint.locale,
    englishName: checkpoint.englishName,
    nativeName: checkpoint.nativeName,
    textDirection: checkpoint.textDirection,
    glossary,
  });

  let nextBatch: WebUiDraftBatchPlan | null = null;
  for (const batch of batches) {
    const existing = await getWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: batch.id,
      phase: "primary",
    });
    if (
      existing?.status === "ok" &&
      existing.keys.join("\n") === batch.keys.join("\n")
    ) {
      continue;
    }
    nextBatch = batch;
    break;
  }

  if (!nextBatch) {
    // Primary complete → move to quality.
    const translated = await assembleWebUiActivationTranslatedMap(checkpoint.checkpointId);
    const classification = classifyEnglishIdenticalWebUiTree({
      englishFlat: flat,
      localizedFlat: Object.fromEntries(
        requiredPaths.map((pathKey) => [pathKey, translated[pathKey] ?? ""]),
      ),
    });
    const suspiciousFlat: Record<string, string> = {};
    for (const row of classification.suspiciousHuman) {
      suspiciousFlat[row.path] = flat[row.path] ?? "";
    }
    const qualityBatches = planWebUiDraftBatches(suspiciousFlat);
    checkpoint = {
      ...checkpoint,
      phase: qualityBatches.length > 0 ? "quality" : "validating",
      completedBatchCount: batches.length,
      qualityBatchCount: qualityBatches.length,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: classification.suspiciousHuman.length,
      detail:
        qualityBatches.length > 0
          ? "Checking translation quality…"
          : "Validating public interface…",
      updatedAt: nowIso(deps),
    };
    await upsertWebUiActivationCheckpoint(checkpoint);
    return {
      done: false,
      needsAnotherTick: true,
      published: false,
      providerCalls: 0,
      checkpoint,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        requiredKeyCount: requiredPaths.length,
        effectiveSource: "none",
        checkpoint,
        completedLeaves: requiredPaths.length,
      }),
    };
  }

  let attempt = 0;
  let lastReason = "Provider batch failed.";
  let providerCalls = 0;
  let missingKeyRecoveryAttempted = false;
  while (attempt < 2) {
    attempt += 1;
    try {
      const translated = await translateWebUiProviderBatch({
        locale: checkpoint.locale,
        englishFlat: flat,
        keys: nextBatch.keys,
        terminologyContext,
        translator,
      });
      providerCalls += translated.providerCalls;
      missingKeyRecoveryAttempted =
        missingKeyRecoveryAttempted || translated.missingKeyRecoveryAttempted;
      const values = translated.values;
      const discarded = translated.discardedUnexpectedKeys;
      let okReason: string | null = null;
      if (translated.missingKeyRecoveryAttempted && discarded.length > 0) {
        okReason = `ok after missing-key recovery (discarded unexpected: ${discarded.slice(0, 8).join(", ")})`;
      } else if (translated.missingKeyRecoveryAttempted) {
        okReason = "ok after missing-key recovery";
      } else if (discarded.length > 0) {
        okReason = `ok (discarded unexpected: ${discarded.slice(0, 8).join(", ")})`;
      }
      await upsertWebUiActivationBatch({
        checkpointId: checkpoint.checkpointId,
        batchId: nextBatch.id,
        phase: "primary",
        namespace: nextBatch.namespace,
        keys: nextBatch.keys,
        values,
        status: "ok",
        attempts: providerCalls,
        reason: okReason,
        updatedAt: nowIso(deps),
      });
      const completedBatchCount = checkpoint.completedBatchCount + 1;
      checkpoint = {
        ...checkpoint,
        completedBatchCount,
        nextAttemptAt: null,
        transientFailureCount: 0,
        lastTransientFailure: null,
        detail: `Preparing public interface… ${completedBatchCount} / ${checkpoint.batchCount} batches`,
        updatedAt: nowIso(deps),
      };
      await upsertWebUiActivationCheckpoint(checkpoint);
      return {
        done: false,
        needsAnotherTick: true,
        published: false,
        providerCalls,
        checkpoint,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: false,
          missingKeyCount: Math.max(0, checkpoint.leafCount - completedBatchCount * 6),
          emptyKeyCount: 0,
          requiredKeyCount: checkpoint.leafCount,
          effectiveSource: "none",
          checkpoint,
          completedLeaves: Math.min(checkpoint.leafCount, completedBatchCount * 6),
        }),
      };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "Provider batch failed.";
      const recoveryInThisAttempt = /omitted keys after recovery/i.test(lastReason);
      if (recoveryInThisAttempt) {
        missingKeyRecoveryAttempted = true;
        providerCalls += 2;
      } else {
        providerCalls += 1;
      }
      if (isWebUiRateLimitedError(error)) {
        return enterWebUiProviderCooldown({
          checkpoint,
          batch: nextBatch,
          batchPhase: "primary",
          providerCalls,
          deps,
        });
      }
      if (isWebUiProviderBatchNonRetryable(error) || attempt >= 2) {
        const operatorDetail = sanitizeWebUiActivationFailureDetail(lastReason);
        await upsertWebUiActivationBatch({
          checkpointId: checkpoint.checkpointId,
          batchId: nextBatch.id,
          phase: "primary",
          namespace: nextBatch.namespace,
          keys: nextBatch.keys,
          values: {},
          status: "failed",
          attempts: providerCalls,
          reason: missingKeyRecoveryAttempted
            ? `${lastReason} (missing-key recovery attempted)`
            : lastReason,
          updatedAt: nowIso(deps),
        });
        checkpoint = {
          ...checkpoint,
          phase: "failed",
          failedBatchCount: checkpoint.failedBatchCount + 1,
          detail: operatorDetail,
          nextAttemptAt: null,
          updatedAt: nowIso(deps),
        };
        await upsertWebUiActivationCheckpoint(checkpoint);
        return {
          done: true,
          needsAnotherTick: false,
          published: false,
          providerCalls,
          checkpoint,
          webUi: webUiProgressFromCheckpoint({
            readinessDataReady: false,
            missingKeyCount: checkpoint.leafCount,
            emptyKeyCount: 0,
            requiredKeyCount: checkpoint.leafCount,
            effectiveSource: "none",
            checkpoint,
          }),
        };
      }
    }
  }

  throw new WebUiDraftBuilderError(lastReason);
}

async function processQualityBatchTick(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly deps: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationTickResult> {
  const deps = input.deps;
  let checkpoint = input.checkpoint;
  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(deps.includePaths);
  const translated = await assembleWebUiActivationTranslatedMap(checkpoint.checkpointId);
  const classification = classifyEnglishIdenticalWebUiTree({
    englishFlat: flat,
    localizedFlat: Object.fromEntries(
      requiredPaths.map((pathKey) => [pathKey, translated[pathKey] ?? ""]),
    ),
  });
  const suspiciousFlat: Record<string, string> = {};
  for (const row of classification.suspiciousHuman) {
    suspiciousFlat[row.path] = flat[row.path] ?? "";
  }
  const qualityBatches = planWebUiDraftBatches(suspiciousFlat);

  let nextBatch: WebUiDraftBatchPlan | null = null;
  for (const batch of qualityBatches) {
    const existing = await getWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: batch.id,
      phase: "quality",
    });
    if (existing?.status === "ok" && existing.keys.join("\n") === batch.keys.join("\n")) {
      continue;
    }
    nextBatch = batch;
    break;
  }

  if (!nextBatch) {
    checkpoint = {
      ...checkpoint,
      phase: "validating",
      qualityBatchCount: qualityBatches.length,
      qualityCompletedBatchCount: qualityBatches.length,
      detail: "Validating public interface…",
      updatedAt: nowIso(deps),
    };
    await upsertWebUiActivationCheckpoint(checkpoint);
    return {
      done: false,
      needsAnotherTick: true,
      published: false,
      providerCalls: 0,
      checkpoint,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        requiredKeyCount: requiredPaths.length,
        effectiveSource: "none",
        checkpoint,
        completedLeaves: requiredPaths.length,
      }),
    };
  }

  const translator = await resolveTranslator(deps);
  const glossary =
    (await (deps.loadLiveTerminology ?? resolveProviderTerminologyContext)(checkpoint.locale)) ??
    "";
  const terminologyContext = buildWebUiDraftTerminologyContext({
    locale: checkpoint.locale,
    englishName: checkpoint.englishName,
    nativeName: checkpoint.nativeName,
    textDirection: checkpoint.textDirection,
    glossary,
  });

  let attempt = 0;
  let providerCalls = 0;
  let lastReason = "Quality batch failed.";
  let missingKeyRecoveryAttempted = false;
  while (attempt < 2) {
    attempt += 1;
    try {
      const translated = await translateWebUiProviderBatch({
        locale: checkpoint.locale,
        englishFlat: flat,
        keys: nextBatch.keys,
        terminologyContext,
        translator,
      });
      providerCalls += translated.providerCalls;
      missingKeyRecoveryAttempted =
        missingKeyRecoveryAttempted || translated.missingKeyRecoveryAttempted;
      const discarded = translated.discardedUnexpectedKeys;
      let okReason: string | null = null;
      if (translated.missingKeyRecoveryAttempted && discarded.length > 0) {
        okReason = `ok after missing-key recovery (discarded unexpected: ${discarded.slice(0, 8).join(", ")})`;
      } else if (translated.missingKeyRecoveryAttempted) {
        okReason = "ok after missing-key recovery";
      } else if (discarded.length > 0) {
        okReason = `ok (discarded unexpected: ${discarded.slice(0, 8).join(", ")})`;
      }
      await upsertWebUiActivationBatch({
        checkpointId: checkpoint.checkpointId,
        batchId: nextBatch.id,
        phase: "quality",
        namespace: nextBatch.namespace,
        keys: nextBatch.keys,
        values: translated.values,
        status: "ok",
        attempts: providerCalls,
        reason: okReason,
        updatedAt: nowIso(deps),
      });
      const qualityCompletedBatchCount = checkpoint.qualityCompletedBatchCount + 1;
      checkpoint = {
        ...checkpoint,
        qualityBatchCount: qualityBatches.length,
        qualityCompletedBatchCount,
        nextAttemptAt: null,
        transientFailureCount: 0,
        lastTransientFailure: null,
        detail: `Checking translation quality… ${qualityCompletedBatchCount} / ${qualityBatches.length}`,
        updatedAt: nowIso(deps),
      };
      await upsertWebUiActivationCheckpoint(checkpoint);
      return {
        done: false,
        needsAnotherTick: true,
        published: false,
        providerCalls,
        checkpoint,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: false,
          missingKeyCount: 0,
          emptyKeyCount: 0,
          requiredKeyCount: requiredPaths.length,
          effectiveSource: "none",
          checkpoint,
          completedLeaves: requiredPaths.length,
        }),
      };
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "Quality batch failed.";
      const recoveryInThisAttempt = /omitted keys after recovery/i.test(lastReason);
      if (recoveryInThisAttempt) {
        missingKeyRecoveryAttempted = true;
        providerCalls += 2;
      } else {
        providerCalls += 1;
      }
      if (isWebUiRateLimitedError(error)) {
        return enterWebUiProviderCooldown({
          checkpoint,
          batch: nextBatch,
          batchPhase: "quality",
          providerCalls,
          deps,
        });
      }
      if (isWebUiProviderBatchNonRetryable(error) || attempt >= 2) {
        await upsertWebUiActivationBatch({
          checkpointId: checkpoint.checkpointId,
          batchId: nextBatch.id,
          phase: "quality",
          namespace: nextBatch.namespace,
          keys: nextBatch.keys,
          values: {},
          status: "failed",
          attempts: providerCalls,
          reason: missingKeyRecoveryAttempted
            ? `${lastReason} (missing-key recovery attempted)`
            : lastReason,
          updatedAt: nowIso(deps),
        });
        checkpoint = {
          ...checkpoint,
          phase: "failed",
          detail: sanitizeWebUiActivationFailureDetail(lastReason),
          updatedAt: nowIso(deps),
        };
        await upsertWebUiActivationCheckpoint(checkpoint);
        return {
          done: true,
          needsAnotherTick: false,
          published: false,
          providerCalls,
          checkpoint,
          webUi: webUiProgressFromCheckpoint({
            readinessDataReady: false,
            missingKeyCount: 0,
            emptyKeyCount: 0,
            requiredKeyCount: requiredPaths.length,
            effectiveSource: "none",
            checkpoint,
          }),
        };
      }
    }
  }
  throw new WebUiDraftBuilderError(lastReason);
}

async function finalizeValidateAndPublish(input: {
  readonly checkpoint: WebUiActivationCheckpointRecord;
  readonly deps: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationTickResult> {
  const deps = input.deps;
  let checkpoint: WebUiActivationCheckpointRecord = {
    ...input.checkpoint,
    phase: "validating",
    detail: "Validating public interface…",
    updatedAt: nowIso(deps),
  };
  await upsertWebUiActivationCheckpoint(checkpoint);

  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(deps.includePaths);
  const translated = await assembleWebUiActivationTranslatedMap(checkpoint.checkpointId);
  const messages = unflattenWebUiMessageMap(
    Object.fromEntries(requiredPaths.map((path) => [path, translated[path] ?? ""])),
  ) as WebUiMessageTree;

  try {
    assertCompletePublicWebUiDraft({ messages, requiredPaths });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation failed.";
    checkpoint = {
      ...checkpoint,
      phase: "failed",
      detail: `Public interface validation failed — ${message}`,
      updatedAt: nowIso(deps),
    };
    await upsertWebUiActivationCheckpoint(checkpoint);
    return {
      done: true,
      needsAnotherTick: false,
      published: false,
      providerCalls: 0,
      checkpoint,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: requiredPaths.length,
        emptyKeyCount: 0,
        requiredKeyCount: requiredPaths.length,
        effectiveSource: "none",
        checkpoint,
      }),
    };
  }

  // Skip unnecessary overwrite when an identical published pack already exists.
  const existing = await getPublishedWebUiMessagePackByLocale(checkpoint.locale);
  if (existing) {
    const existingPaths = new Set(
      collectStringPaths(existing.messages as Record<string, unknown>),
    );
    const allMatch =
      requiredPaths.every((path) => existingPaths.has(path)) &&
      requiredPaths.every((path) => {
        let cursor: unknown = existing.messages;
        for (const segment of path.split(".")) {
          if (cursor == null || typeof cursor !== "object") {
            return false;
          }
          cursor = (cursor as Record<string, unknown>)[segment];
        }
        return cursor === translated[path];
      });
    if (allMatch) {
      checkpoint = {
        ...checkpoint,
        phase: "ready",
        detail: "Public interface ready",
        updatedAt: nowIso(deps),
      };
      await upsertWebUiActivationCheckpoint(checkpoint);
      return {
        done: true,
        needsAnotherTick: false,
        published: false,
        providerCalls: 0,
        checkpoint,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: true,
          missingKeyCount: 0,
          emptyKeyCount: 0,
          requiredKeyCount: requiredPaths.length,
          effectiveSource: "remote",
          checkpoint,
          completedLeaves: requiredPaths.length,
        }),
      };
    }
  }

  checkpoint = {
    ...checkpoint,
    phase: "publishing",
    detail: "Publishing public interface…",
    updatedAt: nowIso(deps),
  };
  await upsertWebUiActivationCheckpoint(checkpoint);

  await upsertWebUiMessagePack({
    locale: checkpoint.locale,
    messages,
    status: "published",
    sourceNote: `Language activation generation ${checkpoint.generation}; live terminology; sourceHash=${checkpoint.sourceHash}`,
  });

  checkpoint = {
    ...checkpoint,
    phase: "ready",
    detail: "Public interface ready",
    updatedAt: nowIso(deps),
  };
  await upsertWebUiActivationCheckpoint(checkpoint);

  return {
    done: true,
    needsAnotherTick: false,
    published: true,
    providerCalls: 0,
    checkpoint,
    webUi: webUiProgressFromCheckpoint({
      readinessDataReady: true,
      missingKeyCount: 0,
      emptyKeyCount: 0,
      requiredKeyCount: requiredPaths.length,
      effectiveSource: "remote",
      checkpoint,
      completedLeaves: requiredPaths.length,
    }),
  };
}

/**
 * Advance WEB_UI activation by at most one provider batch (or finalize validate/publish).
 */
export async function processWebUiActivationTick(input: {
  readonly job: LanguageActivationJobRecord;
  readonly checkpointId?: string | null;
  readonly deps?: WebUiActivationPreparationDeps;
}): Promise<WebUiActivationTickResult> {
  const deps = input.deps ?? {};
  const readiness = await assessOrdinaryWebUiCatalogReadiness(input.job.locale);
  if (readiness.dataReady) {
    return {
      done: true,
      needsAnotherTick: false,
      published: false,
      providerCalls: 0,
      checkpoint: null,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: true,
        missingKeyCount: readiness.missingKeyCount,
        emptyKeyCount: readiness.emptyKeyCount,
        requiredKeyCount: readiness.requiredKeyCount,
        effectiveSource: "remote",
        checkpoint: null,
      }),
    };
  }

  const checkpointId =
    input.checkpointId ??
    input.job.domains.webUi.checkpointId ??
    (await getWebUiActivationCheckpointByJobId(input.job.jobId))?.checkpointId ??
    null;
  if (!checkpointId) {
    const ensured = await ensureWebUiActivationCheckpoint({ job: input.job, deps });
    const ensuredCheckpoint = ensured.checkpoint;
    if (ensured.skipped || !ensuredCheckpoint) {
      return {
        done: true,
        needsAnotherTick: false,
        published: false,
        providerCalls: 0,
        checkpoint: null,
        webUi: ensured.webUi,
      };
    }
    if (ensuredCheckpoint.phase === "failed") {
      return {
        done: true,
        needsAnotherTick: false,
        published: false,
        providerCalls: 0,
        checkpoint: ensuredCheckpoint,
        webUi: ensured.webUi,
      };
    }
    return processWebUiActivationTick({
      job: input.job,
      checkpointId: ensuredCheckpoint.checkpointId,
      deps,
    });
  }

  let checkpoint = await getWebUiActivationCheckpoint(checkpointId);
  if (!checkpoint) {
    throw new WebUiDraftBuilderError(`WEB_UI checkpoint not found: ${checkpointId}`);
  }

  if (checkpoint.phase === "ready") {
    // Pack readiness is already false (checked above). Rebase/resume so an
    // expanded public corpus cannot stay stuck on a stale ready checkpoint.
    const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(deps.includePaths);
    const sourceHash = hashWebUiEnglishFlatMap(flat);
    checkpoint = await rebaseWebUiCheckpointForCatalogExpansion({
      checkpoint,
      sourceHash,
      flat,
      requiredPaths,
      deps,
    });
  }
  if (checkpoint.phase === "failed") {
    return {
      done: true,
      needsAnotherTick: false,
      published: false,
      providerCalls: 0,
      checkpoint,
      webUi: webUiProgressFromCheckpoint({
        readinessDataReady: false,
        missingKeyCount: checkpoint.leafCount,
        emptyKeyCount: 0,
        requiredKeyCount: checkpoint.leafCount,
        effectiveSource: "none",
        checkpoint,
      }),
    };
  }
  if (checkpoint.phase === "provider_cooldown") {
    const nowMs = Date.parse(nowIso(deps));
    const dueAt = checkpoint.nextAttemptAt ? Date.parse(checkpoint.nextAttemptAt) : 0;
    if (Number.isFinite(dueAt) && dueAt > nowMs) {
      return {
        done: false,
        needsAnotherTick: true,
        published: false,
        providerCalls: 0,
        checkpoint,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: false,
          missingKeyCount: checkpoint.leafCount,
          emptyKeyCount: 0,
          requiredKeyCount: checkpoint.leafCount,
          effectiveSource: "none",
          checkpoint,
          completedLeaves: Math.min(checkpoint.leafCount, checkpoint.completedBatchCount * 6),
        }),
      };
    }
    checkpoint = await resumeWebUiCheckpointAfterCooldown({ checkpoint, deps });
  }
  if (checkpoint.phase === "primary") {
    return processPrimaryBatchTick({ checkpoint, deps });
  }
  if (checkpoint.phase === "quality") {
    return processQualityBatchTick({ checkpoint, deps });
  }
  return finalizeValidateAndPublish({ checkpoint, deps });
}

export async function listJobsNeedingWebUiActivationResume(): Promise<
  readonly WebUiActivationCheckpointRecord[]
> {
  return listIncompleteWebUiActivationCheckpoints();
}

export { TranslationProviderError };
