import type { WorkspaceAssistantAdvisoryContext, WorkspaceAssistantRequest } from "@hu/types";

export interface AiPromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

const PRIVATE_PROMPT_KEYS = [
  "participantId",
  "stewardId",
  "authorId",
  "memberId",
  "email",
  "passwordHash",
  "refreshTokenHash",
  "sessionId",
  "voteId",
  "transparencyCohort",
  "providerMetadata",
  "messageHeaders",
  "rawSource",
  "recordedByParticipantId",
  "createdByParticipantId",
  "verifiedByParticipantId",
  "senderParticipantId",
  "userId",
  "jwt",
  "token",
  "initiativeId",
] as const;

export function assertAiPromptPayloadIsPrivateFree(payload: unknown, label: string): void {
  const serialized = JSON.stringify(payload).toLowerCase();

  for (const key of PRIVATE_PROMPT_KEYS) {
    if (serialized.includes(`"${key.toLowerCase()}"`)) {
      throw new Error(`${label} must not include private field: ${key}`);
    }
  }
}

function formatAdvisoryContext(context: WorkspaceAssistantAdvisoryContext | undefined): string {
  if (!context) {
    return "No deterministic intelligence context was available.";
  }

  const lines = [
    `Constitutional summary: ${context.constitutionalSummary ?? "None"}`,
    `Civic stage: ${context.currentCivicStage ?? "Unknown"}`,
    `Next milestone: ${context.nextCivicMilestone ?? "None"}`,
    `Responsibilities: ${context.responsibilities.length > 0 ? context.responsibilities.join("; ") : "None"}`,
  ];

  if (context.initiativeDescription) {
    lines.push(`Initiative description: ${context.initiativeDescription}`);
  }

  if (context.topRecommendation) {
    lines.push(
      `Top recommendation: ${context.topRecommendation.title} — ${context.topRecommendation.description} (${context.topRecommendation.recommendedAction})`,
    );
  }

  for (const suggestion of context.secondaryRecommendations.slice(0, 3)) {
    lines.push(`Secondary recommendation: ${suggestion.title} — ${suggestion.description}`);
  }

  for (const blocked of context.blockedActions.slice(0, 3)) {
    lines.push(`Blocked action: ${blocked.title} — ${blocked.reason}`);
  }

  return lines.join("\n");
}

export function buildAiAssistantPrompt(request: WorkspaceAssistantRequest): AiPromptPayload {
  const { contextSnapshot, requestedAction, currentSection, advisoryContext, userPrompt } = request;

  const systemPrompt = [
    "You are the Humanity Union Workspace Assistant — an advisory explanation layer only.",
    "You help participants draft and clarify civic workspace content.",
    "You never publish, vote, verify, send, archive, decide proposals, or close decisions.",
    "You never claim institutional truth or provide legal conclusions.",
    "Respond in calm civic language. Be concise and practical.",
    "Provide advisory text the participant must review before use.",
    "Do not instruct the user to perform civic mutations directly.",
  ].join(" ");

  const userMessage = [
    `Requested advisory action: ${requestedAction.label} (${requestedAction.capability})`,
    `Workspace section: ${currentSection}`,
    `Initiative title: ${contextSnapshot.initiativeTitle}`,
    `Lifecycle phase: ${contextSnapshot.lifecyclePhase}`,
    `Visibility: ${contextSnapshot.visibilityLabel}`,
    `Context summary: ${contextSnapshot.contextSummary}`,
    "",
    "Deterministic platform intelligence (authoritative — do not override):",
    formatAdvisoryContext(advisoryContext),
    userPrompt ? `\nParticipant note: ${userPrompt}` : "",
    "",
    "Return:",
    "1) A short advisory explanation",
    "2) An optional draft the participant may copy after review",
    "3) Do not include commands to publish, vote, verify, send, or archive",
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    systemPrompt,
    userPrompt: userMessage,
  };

  assertAiPromptPayloadIsPrivateFree(payload, "AI prompt payload");

  return payload;
}

export { PRIVATE_PROMPT_KEYS };
