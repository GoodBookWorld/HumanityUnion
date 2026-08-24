import { randomUUID } from "node:crypto";

import type {
  HumanityUnionAssistantAssistResult,
  HumanityUnionAssistantConversationTurn,
  HumanityUnionAssistantSessionContext,
  HumanityUnionAssistantSurfaceId,
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleStageId,
  LifecycleAiProviderDiagnostics,
} from "@hu/types";
import {
  HUMANITY_UNION_ASSISTANT_PRODUCT_NAME,
  HUMANITY_UNION_ASSISTANT_SESSION_HISTORY_POLICY,
  INITIATIVE_LIFECYCLE_AI_ASSIST_OPERATIONS,
  isHumanityUnionAssistantSurfaceId,
} from "@hu/types";

import {
  buildAssistantCommunityIntelligenceContext,
  buildEmptyAssistantCommunityContext,
  checkDraftSimilarity,
  formatCommunityIntelligenceForAssistantPrompt,
  instructionsRequestCommunityIntelligence,
} from "../community-intelligence/index.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { buildInitiativeLifecycleStageProjection } from "../initiatives/initiative-lifecycle-stage-projection.service.js";
import { assertAiPromptSafe } from "../lifecycle-safety/lifecycle-safety.service.js";
import {
  LifecycleSafetyNeedsReviewError,
  LifecycleSafetyRejectedError,
} from "../lifecycle-safety/lifecycle-safety.errors.js";
import { resolveParticipantLanguageContext } from "../language/participant-language-context.js";
import { DEFAULT_PLATFORM_LANGUAGE, normalizeLanguageCode } from "@hu/types";

import {
  resolveAssistantSpecialization,
  surfaceIdFromLifecycleStage,
} from "./assistant-specialization.js";
import {
  BLOG_PUBLICATION_AUTHORING_OPS,
  blogAuthoringInstructionBlock,
  buildBlogAuthoringSourceContext,
  isBlogPublicationAuthoringPath,
} from "./blog-authoring-assistant.js";
import {
  boundConversationHistory,
  enforcePromptBudget,
  estimatePromptChars,
  estimatePromptTokens,
  logPromptSizeInDevelopment,
  truncateText,
} from "./assistant-context-optimizer.js";
import { resolveAssistantPromptVersions } from "./assistant-prompt-versions.js";
import { recordAssistantUsageMetric } from "./assistant-usage-metrics.js";
import { buildLifecycleAiPrompt } from "./build-lifecycle-ai-prompt.js";
import { buildLifecycleAiProviderContext } from "./build-lifecycle-ai-provider-context.js";
import { resolveAssistantBehaviorGuard } from "./assistant-behavior-guards.js";
import {
  ASSISTANT_SAFETY_POLICY_SUMMARY,
  HUMANITY_UNION_PRINCIPLES,
  PLATFORM_KNOWLEDGE_TOPIC_LABELS,
  retrievePlatformKnowledge,
} from "./platform-ai-knowledge.js";
import { operationLabel, operationsForCapabilities } from "./lifecycle-ai-stage-instructions.js";
import { resolveLifecycleAiConfig } from "./lifecycle-ai.config.js";
import { LifecycleAiError } from "./lifecycle-ai.errors.js";
import { resolveLifecycleAiProvider } from "./resolve-lifecycle-ai-provider.js";
import { GeminiLifecycleAiProvider } from "./providers/gemini-lifecycle-ai-provider.js";

export interface PlatformAssistantSessionQuery {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly pagePath?: string;
}

export interface PlatformAssistantAssistBody {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly operation: InitiativeLifecycleAiAssistOperation;
  readonly initiativeId?: string;
  readonly stageId?: InitiativeLifecycleStageId;
  readonly pagePath?: string;
  readonly instructions?: string;
  readonly targetSectionId?: string;
  readonly currentDraftExcerpt?: string;
  readonly conversationHistory?: readonly HumanityUnionAssistantConversationTurn[];
}

function isAssistOperation(value: unknown): value is InitiativeLifecycleAiAssistOperation {
  return (
    typeof value === "string" &&
    (INITIATIVE_LIFECYCLE_AI_ASSIST_OPERATIONS as readonly string[]).includes(value)
  );
}

function buildDiagnostics(input: {
  readonly activeProviderId: string;
  readonly knowledge?: {
    readonly platformKnowledgeVersion: string;
    readonly moduleIds: readonly string[];
  };
  readonly promptVersions?: readonly string[];
  readonly estimatedPromptChars?: number;
  readonly estimatedPromptTokens?: number;
  readonly retryCount?: number;
  readonly responseDurationMs?: number;
  readonly surfaceId?: string;
  readonly presentationMode?: string;
  readonly conversationHistoryTurns?: number;
}): LifecycleAiProviderDiagnostics | undefined {
  const config = resolveLifecycleAiConfig();
  if (!config.diagnosticsEnabled) {
    return undefined;
  }

  return {
    configuredProvider: config.provider,
    activeProviderId: input.activeProviderId,
    providerReady: config.provider === "deterministic" || Boolean(config.geminiApiKey),
    platformKnowledgeVersion: input.knowledge?.platformKnowledgeVersion,
    retrievedKnowledgeModuleIds: input.knowledge?.moduleIds,
    promptVersions: input.promptVersions,
    estimatedPromptChars: input.estimatedPromptChars,
    estimatedPromptTokens: input.estimatedPromptTokens,
    retryCount: input.retryCount,
    responseDurationMs: input.responseDurationMs,
    surfaceId: input.surfaceId,
    presentationMode: input.presentationMode,
    conversationHistoryTurns: input.conversationHistoryTurns,
  };
}

function firstName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "there";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function buildGreeting(displayName: string, featureLabel: string): string {
  return `Hello, ${firstName(displayName)}. I can help you with ${featureLabel} or answer questions about Humanity Union.`;
}

function resolveSurfaceId(input: {
  surfaceId?: string;
  stageId?: string;
}): HumanityUnionAssistantSurfaceId {
  if (isHumanityUnionAssistantSurfaceId(input.surfaceId)) {
    return input.surfaceId;
  }

  if (input.stageId && typeof input.stageId === "string") {
    return surfaceIdFromLifecycleStage(input.stageId as InitiativeLifecycleStageId);
  }

  throw new LifecycleAiError("bad_request", "A valid Assistant surfaceId is required.");
}

export async function getHumanityUnionAssistantSessionContext(
  identity: RequestIdentity,
  query: PlatformAssistantSessionQuery,
): Promise<HumanityUnionAssistantSessionContext> {
  const surfaceId = resolveSurfaceId(query);
  const specialization = resolveAssistantSpecialization(surfaceId);
  const provider = resolveLifecycleAiProvider();
  const config = resolveLifecycleAiConfig();
  const providerReady =
    config.provider === "deterministic" || Boolean(config.geminiApiKey);
  const displayName = identity.displayName?.trim() || "Participant";
  const languageContext = resolveParticipantLanguageContext(identity.participantId);

  const initiativeId: string | null = query.initiativeId?.trim() || null;
  let initiativeTitle: string | null = null;
  let stageId = specialization.stageId;
  let stageLabel: string | null = specialization.featureLabel;
  let presentationMode: HumanityUnionAssistantSessionContext["presentationMode"] = null;
  let viewerRole: HumanityUnionAssistantSessionContext["viewerRole"] = identity.participantId
    ? "participant"
    : "guest";
  let availableSourceLabels: readonly string[] = [];
  let allowedOperations = [...specialization.defaultOperations];
  let canApplySuggestionsToDraft = false;
  let sourceContentLanguage: HumanityUnionAssistantSessionContext["sourceContentLanguage"] = null;
  let specializationSummary = specialization.specializationSummary;
  let suggestedQuestions = specialization.suggestedQuestions;
  let pageLabel = specialization.pageLabel;
  let featureLabel = specialization.featureLabel;

  const blogAuthoring = surfaceId === "blog" && isBlogPublicationAuthoringPath(query.pagePath);
  if (blogAuthoring) {
    allowedOperations = [...BLOG_PUBLICATION_AUTHORING_OPS];
    canApplySuggestionsToDraft = true;
    presentationMode = "author_workspace";
    stageLabel = "Publication Authoring";
    pageLabel = "Publication editor";
    featureLabel = "Publication Authoring";
    specializationSummary =
      "Suggest title, wording, structure, SEO, and social preview improvements. Author must Apply or Dismiss — Assistant never publishes.";
    suggestedQuestions = [
      "Suggest a clearer title.",
      "Improve clarity and readability.",
      "Suggest structure improvements.",
      "Suggest an SEO title and meta description.",
      "Suggest keywords and topics.",
      "Suggest social preview title and description.",
    ];
  }

  if (initiativeId) {
    const initiative = getInitiativeById(initiativeId);
    if (!initiative) {
      throw new LifecycleAiError("not_found", "Initiative not found.");
    }

    initiativeTitle = initiative.title;
    sourceContentLanguage = normalizeLanguageCode(
      initiative.metadata?.language,
      DEFAULT_PLATFORM_LANGUAGE,
    );
    const projectionStageId =
      query.stageId ?? specialization.stageId ?? ("initiative" as InitiativeLifecycleStageId);

    const projection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: projectionStageId,
      viewerParticipantId: identity.participantId,
    });

    if (projection) {
      stageId = projection.stageId;
      stageLabel = projection.stageLabel;
      presentationMode = projection.presentationMode;
      viewerRole = projection.viewerRole;
      availableSourceLabels =
        projection.presentationMode === "author_workspace"
          ? (
              await buildLifecycleAiProviderContext({
                identity,
                initiative,
                stageId: projection.stageId,
                stageLabel: projection.stageLabel,
                presentationMode: projection.presentationMode,
                operation: "explain",
              })
            ).availableSourceLabels
          : [];

      if (projection.presentationMode === "author_workspace") {
        allowedOperations = Array.from(
          new Set<InitiativeLifecycleAiAssistOperation>([
            ...operationsForCapabilities(projection.aiCapabilities),
            "explain",
            "answer_question",
          ]),
        );
        canApplySuggestionsToDraft = specialization.canApplySuggestionsToDraft;
      } else {
        allowedOperations = ["explain", "answer_question"];
        canApplySuggestionsToDraft = false;
      }
    }
  }

  return {
    assistantName: HUMANITY_UNION_ASSISTANT_PRODUCT_NAME,
    greeting: buildGreeting(displayName, featureLabel),
    participantDisplayName: displayName,
    currentPageLabel: pageLabel,
    currentFeatureLabel: featureLabel,
    surfaceId,
    initiativeId,
    initiativeTitle,
    stageId,
    stageLabel,
    presentationMode,
    viewerRole,
    specializationSummary,
    suggestedQuestions,
    availableSourceLabels,
    allowedOperations,
    allowedActionLabels: allowedOperations.map(operationLabel),
    humanityUnionPrinciples: HUMANITY_UNION_PRINCIPLES,
    platformKnowledgeTopics: PLATFORM_KNOWLEDGE_TOPIC_LABELS,
    safetyPolicySummary: ASSISTANT_SAFETY_POLICY_SUMMARY,
    sessionHistoryPolicy: HUMANITY_UNION_ASSISTANT_SESSION_HISTORY_POLICY,
    canApplySuggestionsToDraft,
    providerId: provider.providerId,
    providerReady,
    interfaceLanguage: languageContext.interfaceLanguage,
    preferredResponseLanguage: languageContext.preferredReadingLanguage,
    sourceContentLanguage,
    diagnostics: buildDiagnostics({ activeProviderId: provider.providerId, surfaceId }),
  };
}

export async function requestHumanityUnionAssistantAssist(
  identity: RequestIdentity,
  body: PlatformAssistantAssistBody,
): Promise<HumanityUnionAssistantAssistResult> {
  const startedAt = Date.now();
  let retryCount = 0;
  let estimatedPromptTokens: number | null = null;
  let safetyRejected = false;
  let activeProviderId = "deterministic";
  let stageForMetrics: string | null = body.stageId ?? null;
  const surfaceIdEarly = isHumanityUnionAssistantSurfaceId(body.surfaceId)
    ? body.surfaceId
    : "workspace";

  const recordFailure = (error: unknown) => {
    const code = error instanceof LifecycleAiError ? error.code : "unavailable";
    recordAssistantUsageMetric({
      provider: activeProviderId,
      operation: typeof body.operation === "string" ? body.operation : "unknown",
      stage: stageForMetrics,
      surfaceId: surfaceIdEarly,
      success: false,
      responseDurationMs: Date.now() - startedAt,
      estimatedPromptTokens,
      retryCount,
      safetyRejected: safetyRejected || code === "safety_rejected" || code === "safety_refusal",
      rateLimited: code === "rate_limited",
      errorCode: code,
    });
  };

  try {
    if (!isAssistOperation(body.operation)) {
      throw new LifecycleAiError("bad_request", "Unknown Assistant operation.");
    }

    const surfaceId = resolveSurfaceId(body);
    const specialization = resolveAssistantSpecialization(surfaceId);
    const displayName = identity.displayName?.trim() || "Participant";
    const config = resolveLifecycleAiConfig();

    const behaviorGuard = resolveAssistantBehaviorGuard(body.instructions);
    if (behaviorGuard) {
      activeProviderId = "deterministic";
      const result: HumanityUnionAssistantAssistResult = {
        requestId: randomUUID(),
        surfaceId,
        initiativeId: body.initiativeId?.trim() || null,
        stageId: body.stageId ?? specialization.stageId,
        operation: body.operation,
        generatedAt: new Date().toISOString(),
        suggestions: [
          {
            suggestionId: `${surfaceId}-policy-${behaviorGuard.kind}`,
            targetSectionId: null,
            suggestedText: behaviorGuard.reply,
            provenanceNote: behaviorGuard.provenanceNote,
          },
        ],
        providerId: "deterministic",
        isPlaceholder: false,
        autoApplied: false,
        autoPublished: false,
        outOfScope: behaviorGuard.outOfScope,
        diagnostics: buildDiagnostics({
          activeProviderId: "deterministic",
          promptVersions: resolveAssistantPromptVersions({
            stageId: body.stageId ?? specialization.stageId,
            surfaceId,
          }),
          responseDurationMs: Date.now() - startedAt,
          surfaceId,
          retryCount: 0,
        }),
      };
      recordAssistantUsageMetric({
        provider: "deterministic",
        operation: body.operation,
        stage: result.stageId,
        surfaceId,
        success: true,
        responseDurationMs: Date.now() - startedAt,
        estimatedPromptTokens: 0,
        retryCount: 0,
        safetyRejected: false,
        rateLimited: false,
      });
      return result;
    }

    const safetyText =
      [body.instructions, body.currentDraftExcerpt].filter(Boolean).join("\n\n") || body.operation;

    try {
      await assertAiPromptSafe({
        initiativeId: body.initiativeId?.trim() || "platform",
        actorParticipantId: identity.participantId,
        prompt: safetyText,
      });
    } catch (error) {
      if (
        error instanceof LifecycleSafetyRejectedError ||
        error instanceof LifecycleSafetyNeedsReviewError
      ) {
        safetyRejected = true;
        throw new LifecycleAiError("safety_rejected", error.message);
      }
      throw error;
    }

    const initiativeId = body.initiativeId?.trim() || "";
    let initiativeTitle = "Humanity Union";
    let stageId: InitiativeLifecycleStageId = body.stageId ?? specialization.stageId ?? "initiative";
    let stageLabel = specialization.featureLabel;
    let presentationMode = "public";
    let availableSourceLabels: readonly string[] = [];
    let sourceContextSummary =
      `Surface: ${surfaceId}. Feature: ${specialization.featureLabel}. ` +
      specialization.specializationSummary;
    let allowedOperations = [...specialization.defaultOperations];
    let lifecycleProfile: string | undefined;
    let specializationInstructions = specialization.instructionBlock;
    const blogAuthoring = surfaceId === "blog" && isBlogPublicationAuthoringPath(body.pagePath);

    if (blogAuthoring) {
      allowedOperations = [...BLOG_PUBLICATION_AUTHORING_OPS];
      presentationMode = "author_workspace";
      stageLabel = "Publication Authoring";
      specializationInstructions = blogAuthoringInstructionBlock(specialization.instructionBlock);
      sourceContextSummary = buildBlogAuthoringSourceContext({
        pagePath: body.pagePath,
        draftExcerpt: body.currentDraftExcerpt,
      });
      availableSourceLabels = ["Author-provided publication draft excerpt"];
      initiativeTitle =
        body.currentDraftExcerpt?.match(/^title:\s*(.+)$/im)?.[1]?.trim() || "Publication draft";
    }

    if (initiativeId) {
      const initiative = getInitiativeById(initiativeId);
      if (!initiative) {
        throw new LifecycleAiError("not_found", "Initiative not found.");
      }

      initiativeTitle = initiative.title;
      lifecycleProfile = initiative.lifecycleProfile ?? "STANDARD";
      const projection = await buildInitiativeLifecycleStageProjection({
        initiative,
        stageId,
        viewerParticipantId: identity.participantId,
      });

      if (!projection) {
        throw new LifecycleAiError("not_found", "Lifecycle stage not found.");
      }

      stageId = projection.stageId;
      stageLabel = projection.stageLabel;
      presentationMode = projection.presentationMode;
      stageForMetrics = stageId;

      if (projection.presentationMode === "author_workspace") {
        allowedOperations = Array.from(
          new Set<InitiativeLifecycleAiAssistOperation>([
            ...operationsForCapabilities(projection.aiCapabilities),
            "explain",
            "answer_question",
          ]),
        );
        const providerContext = await buildLifecycleAiProviderContext({
          identity,
          initiative,
          stageId: projection.stageId,
          stageLabel: projection.stageLabel,
          presentationMode: projection.presentationMode,
          operation: body.operation,
          instructions: body.instructions,
          currentDraftExcerpt: body.currentDraftExcerpt,
          targetSectionId: body.targetSectionId,
        });
        availableSourceLabels = providerContext.availableSourceLabels;
        lifecycleProfile = providerContext.lifecycleProfile;
        // Context minimization: only attach source snapshot when needed.
        const isPlatformOrientation =
          body.operation === "answer_question" &&
          body.instructions &&
          /\b(save draft|preferences|active ally|notification|workspace|what is)\b/i.test(
            body.instructions,
          );
        sourceContextSummary = isPlatformOrientation
          ? `${specialization.featureLabel}. Platform orientation question — stage snapshot omitted.`
          : truncateText(providerContext.sourceContextSummary, config.maxSourceContextChars);
      } else {
        allowedOperations = ["explain", "answer_question"];
        if (!allowedOperations.includes(body.operation)) {
          throw new LifecycleAiError(
            "forbidden",
            "Draft assistance is only available in Author Workspace.",
          );
        }
      }
    } else if (blogAuthoring) {
      // Pack 16D — publication editor may use draft ops without an Initiative id.
      if (!allowedOperations.includes(body.operation)) {
        throw new LifecycleAiError(
          "bad_request",
          `Operation "${body.operation}" is not allowed for Blog publication authoring.`,
        );
      }
    } else if (!specialization.defaultOperations.includes(body.operation)) {
      throw new LifecycleAiError(
        "bad_request",
        `Operation "${body.operation}" is not available on ${specialization.featureLabel}.`,
      );
    }

    if (!allowedOperations.includes(body.operation)) {
      throw new LifecycleAiError(
        "bad_request",
        `Operation "${body.operation}" is not allowed for this Assistant context.`,
      );
    }

    const conversationHistory = boundConversationHistory(
      body.conversationHistory,
      config.maxConversationHistoryTurns,
      config.maxConversationTurnChars,
    );
    const currentDraftExcerpt = body.currentDraftExcerpt
      ? truncateText(body.currentDraftExcerpt, config.maxDraftExcerptChars)
      : undefined;

    const retrievedKnowledge = retrievePlatformKnowledge({
      instructions: body.instructions,
      surfaceId,
      stageId,
      operation: body.operation,
    });

    if (
      body.instructions &&
      instructionsRequestCommunityIntelligence(body.instructions)
    ) {
      let communityContext = await buildAssistantCommunityIntelligenceContext({
        initiativeId: initiativeId || null,
        participantId: identity.participantId,
        includePersonalized: Boolean(identity.participantId),
      });

      // Creation-context grounding: when no Initiative id is present, reuse the
      // Author's draft excerpt for a bounded public similarity check.
      if (communityContext.relatedInitiatives.length === 0 && body.currentDraftExcerpt?.trim()) {
        const excerpt = body.currentDraftExcerpt.trim();
        const draftCheck = await checkDraftSimilarity({
          title: excerpt.slice(0, 120) || "Untitled draft",
          description: excerpt,
          excludeInitiativeId: initiativeId || undefined,
        });
        if (draftCheck.items.length > 0) {
          communityContext = buildEmptyAssistantCommunityContext(
            draftCheck.providerId,
            initiativeId || null,
            draftCheck.items,
            [],
          );
        }
      }

      const communityBlock = formatCommunityIntelligenceForAssistantPrompt(communityContext);
      sourceContextSummary = truncateText(
        `${sourceContextSummary}\n\n${communityBlock}`,
        config.maxSourceContextChars,
      );
    }

    const languageContext = resolveParticipantLanguageContext(identity.participantId);
    const sourceContentLanguage = initiativeId
      ? normalizeLanguageCode(
          getInitiativeById(initiativeId)?.metadata?.language,
          DEFAULT_PLATFORM_LANGUAGE,
        )
      : null;

    const promptVersions = resolveAssistantPromptVersions({
      stageId,
      surfaceId,
      platformKnowledgeVersion: retrievedKnowledge.platformKnowledgeVersion,
    });

    const providerRequestBase = {
      initiativeId: initiativeId || "platform",
      stageId,
      stageLabel,
      operation: body.operation,
      participantDisplayName: displayName,
      initiativeTitle,
      lifecycleProfile,
      presentationMode,
      availableSourceLabels,
      instructions: body.instructions,
      currentDraftExcerpt,
      targetSectionId: body.targetSectionId,
      sourceContextSummary,
      surfaceId,
      featureLabel: blogAuthoring ? "Publication Authoring" : specialization.featureLabel,
      specializationInstructions,
      platformKnowledgePrompt: retrievedKnowledge.promptBlock,
      platformKnowledgeVersion: retrievedKnowledge.platformKnowledgeVersion,
      interfaceLanguage: languageContext.interfaceLanguage,
      preferredResponseLanguage: languageContext.preferredReadingLanguage,
      sourceContentLanguage,
      conversationHistory,
    };

    const rawPrompt = buildLifecycleAiPrompt(providerRequestBase);
    const prompt = enforcePromptBudget(rawPrompt, config);
    const estimatedPromptChars = estimatePromptChars(prompt);
    estimatedPromptTokens = estimatePromptTokens(prompt);
    logPromptSizeInDevelopment({
      estimatedPromptChars,
      estimatedPromptTokens,
      surfaceId,
      stageId,
    });

    const provider = resolveLifecycleAiProvider();
    activeProviderId = provider.providerId;

    let providerResult: {
      readonly suggestions: HumanityUnionAssistantAssistResult["suggestions"];
      readonly isPlaceholder: boolean;
    };

    if (provider instanceof GeminiLifecycleAiProvider) {
      const geminiResult = await provider.assistWithRetries({
        ...providerRequestBase,
        prompt,
      });
      retryCount = geminiResult.retryCount;
      providerResult = {
        suggestions: geminiResult.suggestions,
        isPlaceholder: geminiResult.isPlaceholder,
      };
    } else {
      providerResult = await provider.assist({
        ...providerRequestBase,
        prompt,
      });
    }

    const responseDurationMs = Date.now() - startedAt;
    recordAssistantUsageMetric({
      provider: provider.providerId,
      operation: body.operation,
      stage: stageId,
      surfaceId,
      success: true,
      responseDurationMs,
      estimatedPromptTokens,
      retryCount,
      safetyRejected: false,
      rateLimited: false,
    });

    return {
      requestId: randomUUID(),
      surfaceId,
      initiativeId: initiativeId || null,
      stageId,
      operation: body.operation,
      generatedAt: new Date().toISOString(),
      suggestions: providerResult.suggestions,
      providerId: provider.providerId,
      isPlaceholder: providerResult.isPlaceholder,
      autoApplied: false,
      autoPublished: false,
      outOfScope: false,
      diagnostics: buildDiagnostics({
        activeProviderId: provider.providerId,
        knowledge: {
          platformKnowledgeVersion: retrievedKnowledge.platformKnowledgeVersion,
          moduleIds: retrievedKnowledge.moduleIds,
        },
        promptVersions,
        estimatedPromptChars,
        estimatedPromptTokens,
        retryCount,
        responseDurationMs,
        surfaceId,
        presentationMode,
        conversationHistoryTurns: conversationHistory.length,
      }),
    };
  } catch (error) {
    recordFailure(error);
    throw error;
  }
}

/** Compatibility: map legacy lifecycle session opens onto the platform Assistant. */
export function lifecycleStageToAssistantSurface(
  stageId: InitiativeLifecycleStageId,
): HumanityUnionAssistantSurfaceId {
  return surfaceIdFromLifecycleStage(stageId);
}
