import type {
  WorkspaceAssistantContextSnapshot,
  WorkspaceAssistantProhibitedAction,
  WorkspaceAssistantRequest,
  WorkspaceAssistantResponse,
} from "@hu/types";
import { WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS } from "@hu/types";

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
  "recordedByParticipantId",
  "createdByParticipantId",
  "verifiedByParticipantId",
  "senderParticipantId",
  "providerMetadata",
  "messageHeaders",
  "rawSource",
  "voteId",
  "transparencyCohort",
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
  { pattern: /\bpublish(?:ed|ing)?\s+initiative\b/i, action: "publish_initiative" },
  { pattern: /\bcast(?:ing)?\s+(?:a\s+)?vote\b/i, action: "vote" },
  { pattern: /\bchange(?:d|ing)?\s+(?:your\s+)?vote\b/i, action: "change_vote" },
  { pattern: /\bverify(?:ing)?\s+(?:the\s+)?response\b/i, action: "verify_response" },
  { pattern: /\bverify(?:ing)?\s+public impact\b/i, action: "verify_public_impact" },
  { pattern: /\bsend(?:ing)?\s+(?:the\s+)?cap\b/i, action: "send_cap" },
  { pattern: /\barchive(?:d|ing)?\s+record\b/i, action: "archive_record" },
  { pattern: /\bdecide(?:d|ing)?\s+proposal\b/i, action: "decide_proposal" },
  { pattern: /\bclose(?:d|ing)?\s+decision\b/i, action: "close_decision" },
  { pattern: /\bofficial claim of truth\b/i, action: "create_official_claim_of_truth" },
  { pattern: /\blegal interpretation\b/i, action: "perform_legal_interpretation" },
];

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);

  for (const key of PRIVATE_CONTEXT_KEYS) {
    if (serialized.includes(`"${key}"`)) {
      throw new Error(`${label} must not include private field: ${key}`);
    }
  }
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

export function applyWorkspaceAssistantSafetyGuard(
  response: WorkspaceAssistantResponse,
): WorkspaceAssistantResponse {
  const combinedText = [
    response.assistantMessage,
    response.suggestedDraft ?? "",
    ...(response.suggestedChecklist ?? []),
    ...response.followUpPrompts,
  ].join(" ");

  for (const { pattern, action } of COMMAND_LIKE_PATTERNS) {
    if (pattern.test(combinedText)) {
      throw new Error(`Assistant response blocked by safety guard: ${action}`);
    }
  }

  if (!response.safetyNotices.some((notice) => notice.code === "advisory_only")) {
    throw new Error("Assistant response must include advisory safety notice.");
  }

  if (!response.confidenceLevel) {
    throw new Error("Assistant response must include confidence level.");
  }

  return {
    ...response,
    suggestedDraft: undefined,
    suggestedChecklist: undefined,
    prohibitedActions: [...WORKSPACE_ASSISTANT_PROHIBITED_ACTIONS],
  };
}

export interface WorkspaceAssistantRespondInput {
  participantId: string;
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

export function generateWorkspaceAssistantResponse(
  input: WorkspaceAssistantRespondInput,
): WorkspaceAssistantResponse {
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
  }

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
    timestamp: input.timestamp,
  };

  const provider = resolveWorkspaceAssistantProvider();
  const response = provider.generateAssistantResponse(request);

  return applyWorkspaceAssistantSafetyGuard(response);
}

export { assertAllowedWorkspaceAssistantCapability, PRIVATE_CONTEXT_KEYS };
