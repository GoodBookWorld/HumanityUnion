import type { HumanityUnionAssistantConversationTurn } from "@hu/types";

import type { LifecycleAiConfig } from "./lifecycle-ai.config.js";
import type { LifecycleAiProviderPrompt } from "./lifecycle-ai-provider.js";

/**
 * Production Hardening Pack 01 — minimize context sent to the provider.
 * Never includes private messages, unrelated initiatives, or attachments.
 */

export function estimatePromptChars(prompt: LifecycleAiProviderPrompt): number {
  return prompt.systemPrompt.length + prompt.userPrompt.length;
}

/** Rough heuristic (~4 chars/token) for cost diagnostics only. */
export function estimatePromptTokens(prompt: LifecycleAiProviderPrompt): number {
  return Math.ceil(estimatePromptChars(prompt) / 4);
}

export function truncateText(value: string, maxChars: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function boundConversationHistory(
  history: readonly HumanityUnionAssistantConversationTurn[] | undefined,
  maxTurns: number,
  maxTurnChars: number,
): readonly HumanityUnionAssistantConversationTurn[] {
  if (!history || history.length === 0 || maxTurns <= 0) {
    return [];
  }

  return history.slice(-maxTurns).map((turn) => ({
    role: turn.role === "assistant" ? "assistant" : "participant",
    text: truncateText(typeof turn.text === "string" ? turn.text : "", maxTurnChars),
  }));
}

export function formatConversationHistoryBlock(
  history: readonly HumanityUnionAssistantConversationTurn[],
): string | null {
  if (history.length === 0) {
    return null;
  }

  const lines = history.map((turn) => {
    const label = turn.role === "assistant" ? "Assistant" : "Participant";
    return `${label}: ${turn.text}`;
  });

  return ["Recent conversation (temporary browser session only):", ...lines].join("\n");
}

export function enforcePromptBudget(
  prompt: LifecycleAiProviderPrompt,
  config: LifecycleAiConfig,
): LifecycleAiProviderPrompt {
  const maxChars = config.maxPromptChars;
  const total = estimatePromptChars(prompt);
  if (total <= maxChars) {
    return prompt;
  }

  // Prefer preserving system policy; truncate user context first.
  const systemBudget = Math.min(prompt.systemPrompt.length, Math.floor(maxChars * 0.55));
  const userBudget = Math.max(0, maxChars - systemBudget);
  return {
    systemPrompt: truncateText(prompt.systemPrompt, systemBudget),
    userPrompt: truncateText(prompt.userPrompt, userBudget),
  };
}

export function logPromptSizeInDevelopment(input: {
  readonly estimatedPromptChars: number;
  readonly estimatedPromptTokens: number;
  readonly surfaceId?: string;
  readonly stageId?: string | null;
}): void {
  if (process.env.NODE_ENV !== "development" && process.env.LIFECYCLE_AI_DIAGNOSTICS !== "true") {
    return;
  }

  // Never log prompt bodies or API keys.
  console.info(
    `[lifecycle-ai] prompt_estimate chars=${input.estimatedPromptChars} tokens≈${input.estimatedPromptTokens} surface=${input.surfaceId ?? "n/a"} stage=${input.stageId ?? "n/a"}`,
  );
}
