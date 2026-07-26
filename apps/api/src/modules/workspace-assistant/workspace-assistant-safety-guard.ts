import type {
  WorkspaceAssistantAdvisoryContext,
  WorkspaceAssistantContextSnapshot,
  WorkspaceAssistantProhibitedAction,
  WorkspaceAssistantRequest,
  WorkspaceAssistantResponse,
} from "@hu/types";
import { WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS } from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { resolveKnowledgeArticlesForAssistant } from "../knowledge-center/knowledge-center.service.js";
import { resolveCivicMediaForAssistant } from "../civic-media-center/civic-media-center.service.js";
import { getWorkspaceIntelligence } from "../workspace-intelligence/workspace-intelligence.service.js";
import { buildWorkspaceAssistantAdvisoryContext } from "./assistant-engine/build-advisory-context.js";
import {
  assertAllowedWorkspaceAssistantCapability,
  resolveWorkspaceAssistantProvider,
} from "./assistant-engine/workspace-assistant-provider.js";

const PRIVATE_CONTEXT_KEYS = [
  "participantId",
  "stewardId",
  "authorId",
  "memberId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "sessionId",
  "recordedByParticipantId",
  "createdByParticipantId",
  "verifiedByParticipantId",
  "senderParticipantId",
  "providerMetadata",
  "messageHeaders",
  "rawSource",
  "voteId",
  "transparencyCohort",
  "userId",
  "jwt",
  "token",
] as const;

const PROHIBITED_CAPABILITY_IDS = new Set<string>([
  "publish_initiative",
  "vote",
  "change_vote",
  "verify_response",
  "verify_public_impact",
  "send_cap",
  "archive_record",
  "decide_proposal",
  "close_decision",
  "create_official_claim_of_truth",
  "perform_legal_interpretation",
]);

const COMMAND_LIKE_PATTERNS: Array<{
  pattern: RegExp;
  action: WorkspaceAssistantProhibitedAction;
}> = [
  { pattern: /\bpublish(?:ed|ing)?\s+initiative\b/gi, action: "publish_initiative" },
  { pattern: /\bcast(?:ing)?\s+(?:a\s+)?vote\b/gi, action: "vote" },
  { pattern: /\bchange(?:d|ing)?\s+(?:your\s+)?vote\b/gi, action: "change_vote" },
  { pattern: /\bverify(?:ing)?\s+(?:the\s+)?response\b/gi, action: "verify_response" },
  { pattern: /\bverify(?:ing)?\s+public impact\b/gi, action: "verify_public_impact" },
  { pattern: /\bsend(?:ing)?\s+(?:the\s+)?cap\b/gi, action: "send_cap" },
  { pattern: /\barchive(?:d|ing)?\s+record\b/gi, action: "archive_record" },
  { pattern: /\bdecide(?:d|ing)?\s+proposal\b/gi, action: "decide_proposal" },
  { pattern: /\bclose(?:d|ing)?\s+decision\b/gi, action: "close_decision" },
  { pattern: /\bofficial claim of truth\b/gi, action: "create_official_claim_of_truth" },
  { pattern: /\blegal interpretation\b/gi, action: "perform_legal_interpretation" },
];

const PROHIBITED_USER_PROMPT_PATTERNS = COMMAND_LIKE_PATTERNS.map(({ pattern }) => pattern);

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value).toLowerCase();

  for (const key of PRIVATE_CONTEXT_KEYS) {
    if (serialized.includes(`"${key.toLowerCase()}"`)) {
      throw new Error(`${label} must not include private field: ${key}`);
    }
  }
}

function assertUserPromptIsAllowed(userPrompt: string): void {
  for (const pattern of PROHIBITED_USER_PROMPT_PATTERNS) {
    if (pattern.test(userPrompt)) {
      throw new Error("Assistant user prompt requests a prohibited civic action.");
    }
  }
}

function stripCommandLikeTokens(text: string): string {
  let sanitized = text;

  for (const { pattern } of COMMAND_LIKE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[advisory reference removed]");
  }

  return sanitized;
}

export function sanitizeWorkspaceAssistantContextSnapshot(
  snapshot: WorkspaceAssistantContextSnapshot,
): WorkspaceAssistantContextSnapshot {
  assertNoPrivateFields(snapshot, "Assistant context snapshot");

  return {
    initiativeId: snapshot.initiativeId,
    initiativeTitle: snapshot.initiativeTitle,
    lifecyclePhase: snapshot.lifecyclePhase,
    currentSection: snapshot.currentSection,
    currentSectionLabel: snapshot.currentSectionLabel,
    currentCivicStage: snapshot.currentCivicStage,
    nextAvailableStep: snapshot.nextAvailableStep,
    relatedRecordsCount: snapshot.relatedRecordsCount,
    visibilityLabel: snapshot.visibilityLabel,
    contextSummary: snapshot.contextSummary,
  };
}

export function sanitizeWorkspaceAssistantAdvisoryContext(
  advisoryContext: WorkspaceAssistantAdvisoryContext,
): WorkspaceAssistantAdvisoryContext {
  assertNoPrivateFields(advisoryContext, "Assistant advisory context");
  return advisoryContext;
}

export function applyWorkspaceAssistantSafetyGuard(
  response: WorkspaceAssistantResponse,
): WorkspaceAssistantResponse {
  const assistantMessage = stripCommandLikeTokens(response.assistantMessage);
  const suggestedDraft = response.suggestedDraft
    ? stripCommandLikeTokens(response.suggestedDraft)
    : undefined;
  const suggestedChecklist = response.suggestedChecklist?.map((item) =>
    stripCommandLikeTokens(item),
  );
  const followUpPrompts = response.followUpPrompts.map((prompt) => stripCommandLikeTokens(prompt));

  if (!response.safetyNotices.some((notice) => notice.code === "advisory_only")) {
    throw new Error("Assistant response must include advisory safety notice.");
  }

  if (!response.safetyNotices.some((notice) => notice.code === "review_before_use")) {
    throw new Error("Assistant response must include review_before_use safety notice.");
  }

  if (!response.confidenceLevel) {
    throw new Error("Assistant response must include confidence level.");
  }

  return {
    ...response,
    assistantMessage,
    suggestedDraft,
    suggestedChecklist,
    followUpPrompts,
    prohibitedActions: [...WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS],
  };
}

export interface WorkspaceAssistantRespondInput {
  participantId: string;
  userId: string;
  displayName: string;
  initiativeId: string;
  currentSection: string;
  requestedAction: {
    capability: string;
    label: string;
  };
  userPrompt?: string;
  contextSnapshot: WorkspaceAssistantContextSnapshot;
  timestamp: string;
}

export async function generateWorkspaceAssistantResponse(
  input: WorkspaceAssistantRespondInput,
): Promise<WorkspaceAssistantResponse> {
  if (PROHIBITED_CAPABILITY_IDS.has(input.requestedAction.capability)) {
    throw new Error("Assistant capability is prohibited.");
  }

  assertAllowedWorkspaceAssistantCapability(input.requestedAction.capability);

  const sanitizedSnapshot = sanitizeWorkspaceAssistantContextSnapshot(input.contextSnapshot);

  if (sanitizedSnapshot.initiativeId !== input.initiativeId) {
    throw new Error("Assistant context snapshot initiative mismatch.");
  }

  if (input.userPrompt) {
    assertNoPrivateFields({ prompt: input.userPrompt }, "Assistant user prompt");
    assertUserPromptIsAllowed(input.userPrompt);
  }

  const initiative = getInitiativeById(input.initiativeId);
  const intelligence = await getWorkspaceIntelligence({
    identity: {
      participantId: input.participantId,
      displayName: input.displayName,
    },
    userId: input.userId,
    displayName: input.displayName,
    initiativeId: input.initiativeId,
    currentSection: input.currentSection,
  });

  const advisoryContext = sanitizeWorkspaceAssistantAdvisoryContext(
    buildWorkspaceAssistantAdvisoryContext(intelligence, initiative?.description),
  );

  const request: WorkspaceAssistantRequest = {
    participantId: input.participantId,
    initiativeId: input.initiativeId,
    currentSection: input.currentSection,
    requestedAction: {
      capability: input.requestedAction.capability,
      label: input.requestedAction.label,
    },
    userPrompt: input.userPrompt,
    contextSnapshot: sanitizedSnapshot,
    advisoryContext,
    timestamp: input.timestamp,
  };

  const provider = resolveWorkspaceAssistantProvider();
  const response = await provider.generateAssistantResponse(request);

  const knowledgeReferences = resolveKnowledgeArticlesForAssistant({
    capability: input.requestedAction.capability,
    currentSection: input.currentSection,
    userPrompt: input.userPrompt,
  });

  const civicMediaReferences = resolveCivicMediaForAssistant(input.userPrompt);

  const referenceSuffix =
    knowledgeReferences.length > 0
      ? " Refer to the Knowledge Center articles below for authoritative explanations."
      : civicMediaReferences.length > 0
        ? " Refer to the Civic Media Center resources below for verification guidance."
        : "";

  const guarded = applyWorkspaceAssistantSafetyGuard({
    ...response,
    knowledgeReferences:
      knowledgeReferences.length > 0 ? knowledgeReferences : response.knowledgeReferences,
    civicMediaReferences:
      civicMediaReferences.length > 0 ? civicMediaReferences : response.civicMediaReferences,
    assistantMessage:
      referenceSuffix.length > 0
        ? `${response.assistantMessage}${referenceSuffix}`
        : response.assistantMessage,
  });

  return guarded;
}

export { assertAllowedWorkspaceAssistantCapability, PRIVATE_CONTEXT_KEYS };
