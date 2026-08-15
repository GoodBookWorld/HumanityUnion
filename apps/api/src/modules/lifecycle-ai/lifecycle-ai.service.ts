import { randomUUID } from "node:crypto";

import type {
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleAiAssistResult,
  InitiativeLifecycleStageId,
  LifecycleAiAssistantSessionContext,
  LifecycleAiProviderDiagnostics,
} from "@hu/types";
import { INITIATIVE_LIFECYCLE_AI_ASSIST_OPERATIONS } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { buildInitiativeLifecycleStageProjection } from "../initiatives/initiative-lifecycle-stage-projection.service.js";
import { assertAiPromptSafe } from "../lifecycle-safety/lifecycle-safety.service.js";
import {
  LifecycleSafetyNeedsReviewError,
  LifecycleSafetyRejectedError,
} from "../lifecycle-safety/lifecycle-safety.errors.js";

import { buildLifecycleAiPrompt } from "./build-lifecycle-ai-prompt.js";
import { buildLifecycleAiProviderContext } from "./build-lifecycle-ai-provider-context.js";
import { HUMANITY_UNION_PRINCIPLES } from "./lifecycle-ai-platform-knowledge.js";
import { retrievePlatformKnowledge } from "./platform-ai-knowledge.js";
import {
  operationLabel,
  operationsForCapabilities,
} from "./lifecycle-ai-stage-instructions.js";
import { resolveLifecycleAiConfig } from "./lifecycle-ai.config.js";
import { LifecycleAiError } from "./lifecycle-ai.errors.js";
import { resolveLifecycleAiProvider } from "./resolve-lifecycle-ai-provider.js";

export interface LifecycleAiAssistBody {
  readonly initiativeId: string;
  readonly stageId: InitiativeLifecycleStageId;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly instructions?: string;
  readonly targetSectionId?: string;
  readonly currentDraftExcerpt?: string;
}

function isAssistOperation(value: unknown): value is InitiativeLifecycleAiAssistOperation {
  return (
    typeof value === "string" &&
    (INITIATIVE_LIFECYCLE_AI_ASSIST_OPERATIONS as readonly string[]).includes(value)
  );
}

function buildDiagnostics(
  activeProviderId: string,
  knowledge?: {
    readonly platformKnowledgeVersion: string;
    readonly moduleIds: readonly string[];
  },
): LifecycleAiProviderDiagnostics | undefined {
  const config = resolveLifecycleAiConfig();
  if (!config.diagnosticsEnabled) {
    return undefined;
  }

  return {
    configuredProvider: config.provider,
    activeProviderId,
    providerReady: config.provider === "deterministic" || Boolean(config.geminiApiKey),
    platformKnowledgeVersion: knowledge?.platformKnowledgeVersion,
    retrievedKnowledgeModuleIds: knowledge?.moduleIds,
  };
}

export async function getLifecycleAiAssistantSessionContext(
  identity: RequestIdentity,
  initiativeId: string,
  stageId: InitiativeLifecycleStageId,
): Promise<LifecycleAiAssistantSessionContext> {
  const initiative = getInitiativeById(initiativeId);

  if (!initiative) {
    throw new LifecycleAiError("not_found", "Initiative not found.");
  }

  const projection = await buildInitiativeLifecycleStageProjection({
    initiative,
    stageId,
    viewerParticipantId: identity.participantId,
  });

  if (!projection) {
    throw new LifecycleAiError("not_found", "Lifecycle stage not found.");
  }

  if (projection.presentationMode !== "author_workspace") {
    throw new LifecycleAiError("forbidden");
  }

  const context = await buildLifecycleAiProviderContext({
    identity,
    initiative,
    stageId,
    stageLabel: projection.stageLabel,
    presentationMode: projection.presentationMode,
    operation: "explain",
  });

  const allowedOperations = operationsForCapabilities(projection.aiCapabilities);
  const provider = resolveLifecycleAiProvider();
  const config = resolveLifecycleAiConfig();
  const providerReady =
    config.provider === "deterministic" || Boolean(config.geminiApiKey);

  return {
    participantDisplayName: context.participantDisplayName,
    initiativeId: initiative.initiativeId,
    initiativeTitle: initiative.title,
    stageId: projection.stageId,
    stageLabel: projection.stageLabel,
    presentationMode: projection.presentationMode,
    availableSourceLabels: context.availableSourceLabels,
    allowedOperations,
    allowedActionLabels: allowedOperations.map(operationLabel),
    humanityUnionPrinciples: HUMANITY_UNION_PRINCIPLES,
    providerId: provider.providerId,
    providerReady,
    diagnostics: buildDiagnostics(provider.providerId),
  };
}

export async function requestLifecycleAiAssist(
  identity: RequestIdentity,
  body: LifecycleAiAssistBody,
): Promise<InitiativeLifecycleAiAssistResult> {
  if (!body.initiativeId?.trim()) {
    throw new LifecycleAiError("bad_request", "initiativeId is required.");
  }

  if (!isAssistOperation(body.operation)) {
    throw new LifecycleAiError("bad_request", "Unknown Lifecycle AI assist operation.");
  }

  const initiative = getInitiativeById(body.initiativeId);

  if (!initiative) {
    throw new LifecycleAiError("not_found", "Initiative not found.");
  }

  const projection = await buildInitiativeLifecycleStageProjection({
    initiative,
    stageId: body.stageId,
    viewerParticipantId: identity.participantId,
  });

  if (!projection) {
    throw new LifecycleAiError("not_found", "Lifecycle stage not found.");
  }

  if (projection.presentationMode !== "author_workspace") {
    throw new LifecycleAiError("forbidden");
  }

  const allowedOperations = operationsForCapabilities(projection.aiCapabilities);

  if (!allowedOperations.includes(body.operation)) {
    throw new LifecycleAiError(
      "bad_request",
      `Operation "${body.operation}" is not allowed for stage "${body.stageId}".`,
    );
  }

  // Part 6 — Safety Layer before any external provider call.
  const safetyText =
    [body.instructions, body.currentDraftExcerpt].filter(Boolean).join("\n\n") || body.operation;

  try {
    await assertAiPromptSafe({
      initiativeId: initiative.initiativeId,
      actorParticipantId: identity.participantId,
      prompt: safetyText,
    });
  } catch (error) {
    if (
      error instanceof LifecycleSafetyRejectedError ||
      error instanceof LifecycleSafetyNeedsReviewError
    ) {
      throw new LifecycleAiError("safety_rejected", error.message);
    }
    throw error;
  }

  const providerContext = await buildLifecycleAiProviderContext({
    identity,
    initiative,
    stageId: body.stageId,
    stageLabel: projection.stageLabel,
    presentationMode: projection.presentationMode,
    operation: body.operation,
    instructions: body.instructions,
    currentDraftExcerpt: body.currentDraftExcerpt,
    targetSectionId: body.targetSectionId,
  });

  const retrievedKnowledge = retrievePlatformKnowledge({
    instructions: providerContext.instructions,
    stageId: providerContext.stageId,
    operation: providerContext.operation,
  });

  const providerRequestBase = {
    initiativeId: providerContext.initiativeId,
    stageId: providerContext.stageId,
    stageLabel: providerContext.stageLabel,
    operation: providerContext.operation,
    participantDisplayName: providerContext.participantDisplayName,
    initiativeTitle: providerContext.initiativeTitle,
    presentationMode: providerContext.presentationMode,
    availableSourceLabels: providerContext.availableSourceLabels,
    instructions: providerContext.instructions,
    currentDraftExcerpt: providerContext.currentDraftExcerpt,
    targetSectionId: providerContext.targetSectionId,
    sourceContextSummary: providerContext.sourceContextSummary,
    platformKnowledgePrompt: retrievedKnowledge.promptBlock,
    platformKnowledgeVersion: retrievedKnowledge.platformKnowledgeVersion,
  };

  const prompt = buildLifecycleAiPrompt(providerRequestBase);
  const provider = resolveLifecycleAiProvider();

  // No silent Gemini → deterministic fallback. Failures propagate as LifecycleAiError.
  const providerResult = await provider.assist({
    ...providerRequestBase,
    prompt,
  });

  return {
    requestId: randomUUID(),
    initiativeId: initiative.initiativeId,
    stageId: body.stageId,
    operation: body.operation,
    generatedAt: new Date().toISOString(),
    suggestions: providerResult.suggestions,
    providerId: provider.providerId,
    isPlaceholder: providerResult.isPlaceholder,
    autoApplied: false,
    autoPublished: false,
    diagnostics: buildDiagnostics(provider.providerId, {
      platformKnowledgeVersion: retrievedKnowledge.platformKnowledgeVersion,
      moduleIds: retrievedKnowledge.moduleIds,
    }),
  };
}
