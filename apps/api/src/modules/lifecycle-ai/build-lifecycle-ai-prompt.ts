import type {
  HumanityUnionAssistantConversationTurn,
  InitiativeLifecycleAiAssistOperation,
  InitiativeLifecycleStageId,
} from "@hu/types";

import { CORE_ASSISTANT_POLICY_PROMPT } from "./assistant-core-policy.js";
import { formatConversationHistoryBlock } from "./assistant-context-optimizer.js";
import {
  ASSISTANT_SAFETY_POLICY_SUMMARY,
  ASSISTANT_SCOPE_BOUNDARY,
  HUMANITY_UNION_PRINCIPLES,
  retrievePlatformKnowledge,
} from "./platform-ai-knowledge.js";
import {
  resolveOperationInstruction,
  resolveStageInstructionSet,
} from "./lifecycle-ai-stage-instructions.js";
import type { LifecycleAiProviderPrompt, LifecycleAiProviderRequest } from "./lifecycle-ai-provider.js";
import { assertLifecycleAiPayloadIsPrivateFree } from "./lifecycle-ai-privacy.js";

/**
 * Prompt composition (Pack 02 + Pack 03 + Pack 05):
 * Core Policy → Scope → Principles → Retrieved Platform Knowledge → Stage/Feature specialization
 * → Operation → Authorized context (user) → Safety reminder → Format rules.
 *
 * Platform knowledge is bounded by retrieval — never the full corpus on every call.
 */
export function buildLifecycleAiPrompt(
  input: Omit<LifecycleAiProviderRequest, "prompt"> & {
    readonly conversationHistory?: readonly HumanityUnionAssistantConversationTurn[];
  },
): LifecycleAiProviderPrompt {
  const specialization =
    input.specializationInstructions?.trim() || resolveStageInstructionSet(input.stageId);
  const operationInstructions = resolveOperationInstruction(input.operation);
  const featureLabel = input.featureLabel?.trim() || input.stageLabel;
  const platformKnowledgePrompt =
    input.platformKnowledgePrompt?.trim() ||
    retrievePlatformKnowledge({
      instructions: input.instructions,
      surfaceId: input.surfaceId,
      stageId: input.stageId,
      operation: input.operation,
    }).promptBlock;

  const systemPrompt = [
    "You are the Humanity Union Assistant — one canonical Assistant for the whole platform.",
    "Expertise specializes by feature or Lifecycle stage, but platform-wide questions remain in scope via Platform Knowledge.",
    "You never publish, vote, send messages, edit stored drafts, or take civic actions.",
    "Return advisory suggestions the Participant must review before any Save → Preview → Publish.",
    "",
    CORE_ASSISTANT_POLICY_PROMPT,
    "",
    "Scope boundary:",
    ASSISTANT_SCOPE_BOUNDARY,
    "",
    "Humanity Union principles (decision constraints, not slogans):",
    HUMANITY_UNION_PRINCIPLES.map((principle) => `- ${principle}`).join("\n"),
    "",
    "Platform Knowledge:",
    platformKnowledgePrompt,
    "",
    `Current feature specialization (${featureLabel}):`,
    specialization,
    "",
    "Operation instruction:",
    operationInstructions,
    "",
    "Safety policy:",
    ASSISTANT_SAFETY_POLICY_SUMMARY,
    "",
    "Context minimization:",
    "Use only the context provided below. Do not invent Petition signatures, Tracking records,",
    "Official Responses, or Archive contents unless they appear in the provided context.",
    "Prefer retrieved Platform Knowledge and authorized context over generic AI assumptions about civic platforms.",
    "",
    "Output format rules:",
    'Return plain text. For multi-section draft generation, use sections marked as "Section: <id>" followed by the text.',
    "Known Collaborative Analysis section ids: title, summary, supportingEvidence, risks, openQuestions, suggestedImprovements, references.",
    "For explain/answer/summarize operations, return a single advisory section with Section: assistant.",
  ].join("\n");

  const responseLanguage = input.preferredResponseLanguage?.trim() || input.interfaceLanguage?.trim();
  const languageBlock = responseLanguage
    ? [
        "Language guidance:",
        `Respond in ${responseLanguage} when safely supported.`,
        input.interfaceLanguage ? `Interface language: ${input.interfaceLanguage}.` : null,
        input.sourceContentLanguage
          ? `Source content language: ${input.sourceContentLanguage}. Preserve semantic meaning across languages; do not invent untranslated facts.`
          : null,
        "Do not send private Direct Messages through translation. Prefer platform knowledge over generic bilingual guesses.",
      ]
        .filter((line): line is string => line !== null)
        .join("\n")
    : null;

  const userPrompt = [
    `Participant: ${input.participantDisplayName}`,
    input.surfaceId ? `Surface: ${input.surfaceId}` : null,
    `Feature: ${featureLabel}`,
    `Initiative: ${input.initiativeTitle}`,
    `Lifecycle Stage: ${input.stageLabel} (${input.stageId})`,
    `Presentation Mode: ${input.presentationMode}`,
    `Available sources: ${input.availableSourceLabels.join("; ") || "None listed"}`,
    `Operation: ${input.operation}`,
    input.targetSectionId ? `Target section: ${input.targetSectionId}` : null,
    languageBlock,
    "",
    "Authorized context (minimal, server-built):",
    input.sourceContextSummary || "No additional stage source summary for this request.",
    formatConversationHistoryBlock(input.conversationHistory ?? []),
    input.currentDraftExcerpt
      ? `\nDraft excerpt under review:\n${input.currentDraftExcerpt}`
      : null,
    input.instructions ? `\nParticipant question / instructions:\n${input.instructions}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const prompt = { systemPrompt, userPrompt };
  assertLifecycleAiPayloadIsPrivateFree(prompt, "Humanity Union Assistant prompt");
  return prompt;
}

export function parseSectionedSuggestions(
  content: string,
  operation: InitiativeLifecycleAiAssistOperation,
  stageId: InitiativeLifecycleStageId,
  provenanceNote: string,
): Array<{
  suggestionId: string;
  targetSectionId: string | null;
  suggestedText: string;
  provenanceNote: string;
}> {
  const sectionPattern = /^Section:\s*([a-zA-Z0-9_]+)\s*$/gm;
  const matches = [...content.matchAll(sectionPattern)];

  if (matches.length === 0) {
    return [
      {
        suggestionId: `${stageId}-${operation}-1`,
        targetSectionId: operation === "generate_draft" ? "summary" : null,
        suggestedText: content.trim(),
        provenanceNote,
      },
    ];
  }

  const suggestions: Array<{
    suggestionId: string;
    targetSectionId: string | null;
    suggestedText: string;
    provenanceNote: string;
  }> = [];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const sectionId = match[1] ?? "assistant";
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1]!.index ?? content.length) : content.length;
    const text = content.slice(start, end).trim();

    if (!text) {
      continue;
    }

    suggestions.push({
      suggestionId: `${stageId}-${operation}-${index + 1}`,
      targetSectionId: sectionId === "assistant" ? null : sectionId,
      suggestedText: text,
      provenanceNote,
    });
  }

  return suggestions.length > 0
    ? suggestions
    : [
        {
          suggestionId: `${stageId}-${operation}-1`,
          targetSectionId: null,
          suggestedText: content.trim(),
          provenanceNote,
        },
      ];
}
