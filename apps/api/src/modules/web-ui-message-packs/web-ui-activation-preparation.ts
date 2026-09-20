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
  translateWebUiProviderBatch,
  unflattenWebUiMessageMap,
  WebUiDraftBuilderError,
  type WebUiDraftBatchPlan,
} from "./web-ui-draft-builder.js";
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
      detail: cp.detail ?? "Public interface translation failed — retry activation",
      preparationPhase: "failed",
      checkpointId: cp.checkpointId,
      sourceHash: cp.sourceHash,
      totalBatches: cp.batchCount,
      completedBatches: cp.completedBatchCount,
      totalLeaves: cp.leafCount,
      completedLeaves: input.completedLeaves ?? 0,
      providerFailure: true,
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
 * True when an effective public WEB_UI pack is already complete — skip generation.
 */
export async function isPublicWebUiAlreadyReady(locale: string): Promise<boolean> {
  const readiness = await assessWebUiCatalogReadinessForLocale({ locale });
  return readiness.dataReady === true;
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
  const readiness = await assessWebUiCatalogReadinessForLocale({ locale });

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
  const { flat, requiredPaths } = loadPublicWebUiEnglishCorpus(deps.includePaths);
  const sourceHash = hashWebUiEnglishFlatMap(flat);
  const existing = await getWebUiActivationCheckpointByJobId(input.job.jobId);
  if (existing) {
    if (existing.sourceHash !== sourceHash) {
      const failed: WebUiActivationCheckpointRecord = {
        ...existing,
        phase: "failed",
        detail:
          "Public interface source catalog changed. Retry activation to start a new preparation.",
        updatedAt: nowIso(deps),
      };
      await upsertWebUiActivationCheckpoint(failed);
      return {
        checkpoint: failed,
        skipped: false,
        webUi: webUiProgressFromCheckpoint({
          readinessDataReady: false,
          missingKeyCount: readiness.missingKeyCount,
          emptyKeyCount: readiness.emptyKeyCount,
          requiredKeyCount: readiness.requiredKeyCount,
          effectiveSource: "none",
          checkpoint: failed,
        }),
      };
    }
    if (existing.phase !== "failed") {
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
  return {
    checkpoint,
    skipped: false,
    webUi: webUiProgressFromCheckpoint({
      readinessDataReady: false,
      missingKeyCount: readiness.missingKeyCount,
      emptyKeyCount: readiness.emptyKeyCount,
      requiredKeyCount: readiness.requiredKeyCount,
      effectiveSource: "none",
      checkpoint,
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
    checkpoint = {
      ...checkpoint,
      phase: "failed",
      detail: "Public interface source catalog changed during preparation.",
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
  while (attempt < 2) {
    attempt += 1;
    try {
      providerCalls += 1;
      const values = await translateWebUiProviderBatch({
        locale: checkpoint.locale,
        englishFlat: flat,
        keys: nextBatch.keys,
        terminologyContext,
        translator,
      });
      await upsertWebUiActivationBatch({
        checkpointId: checkpoint.checkpointId,
        batchId: nextBatch.id,
        phase: "primary",
        namespace: nextBatch.namespace,
        keys: nextBatch.keys,
        values,
        status: "ok",
        attempts: attempt,
        reason: null,
        updatedAt: nowIso(deps),
      });
      const completedBatchCount = checkpoint.completedBatchCount + 1;
      checkpoint = {
        ...checkpoint,
        completedBatchCount,
        detail: `Preparing public interface… ${completedBatchCount} / ${checkpoint.batchCount} batches`,
        updatedAt: nowIso(deps),
      };
      await upsertWebUiActivationCheckpoint(checkpoint);
      const more = completedBatchCount < checkpoint.batchCount;
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
      if (isWebUiProviderBatchNonRetryable(error) || attempt >= 2) {
        await upsertWebUiActivationBatch({
          checkpointId: checkpoint.checkpointId,
          batchId: nextBatch.id,
          phase: "primary",
          namespace: nextBatch.namespace,
          keys: nextBatch.keys,
          values: {},
          status: "failed",
          attempts: attempt,
          reason: lastReason,
          updatedAt: nowIso(deps),
        });
        checkpoint = {
          ...checkpoint,
          phase: "failed",
          failedBatchCount: checkpoint.failedBatchCount + 1,
          detail: "Public interface translation failed — retry activation",
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
  while (attempt < 2) {
    attempt += 1;
    try {
      providerCalls += 1;
      const values = await translateWebUiProviderBatch({
        locale: checkpoint.locale,
        englishFlat: flat,
        keys: nextBatch.keys,
        terminologyContext,
        translator,
      });
      await upsertWebUiActivationBatch({
        checkpointId: checkpoint.checkpointId,
        batchId: nextBatch.id,
        phase: "quality",
        namespace: nextBatch.namespace,
        keys: nextBatch.keys,
        values,
        status: "ok",
        attempts: attempt,
        reason: null,
        updatedAt: nowIso(deps),
      });
      const qualityCompletedBatchCount = checkpoint.qualityCompletedBatchCount + 1;
      checkpoint = {
        ...checkpoint,
        qualityBatchCount: qualityBatches.length,
        qualityCompletedBatchCount,
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
      if (isWebUiProviderBatchNonRetryable(error) || attempt >= 2) {
        await upsertWebUiActivationBatch({
          checkpointId: checkpoint.checkpointId,
          batchId: nextBatch.id,
          phase: "quality",
          namespace: nextBatch.namespace,
          keys: nextBatch.keys,
          values: {},
          status: "failed",
          attempts: attempt,
          reason: lastReason,
          updatedAt: nowIso(deps),
        });
        checkpoint = {
          ...checkpoint,
          phase: "failed",
          detail: "Public interface translation failed — retry activation",
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
  const readiness = await assessWebUiCatalogReadinessForLocale({ locale: input.job.locale });
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

  const checkpoint = await getWebUiActivationCheckpoint(checkpointId);
  if (!checkpoint) {
    throw new WebUiDraftBuilderError(`WEB_UI checkpoint not found: ${checkpointId}`);
  }

  if (checkpoint.phase === "ready") {
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
        requiredKeyCount: checkpoint.leafCount,
        effectiveSource: "remote",
        checkpoint,
        completedLeaves: checkpoint.leafCount,
      }),
    };
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
