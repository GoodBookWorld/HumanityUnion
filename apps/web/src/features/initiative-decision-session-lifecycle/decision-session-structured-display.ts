/**
 * Decision Session public structured content — parse CT JSON without dual-render.
 * Canonical arrays must not paint over a usable localized structuredContent bag.
 */

import type { DecisionSessionStructuredContent } from "@hu/types";

const ARRAY_KEYS = [
  "objectives",
  "options",
  "supportingArguments",
  "risks",
  "dependencies",
  "requiredResources",
  "suggestedParticipants",
  "suggestedResponsibleRoles",
  "unresolvedQuestions",
] as const;

const STRING_KEYS = ["decisionContext", "suggestedTimeline"] as const;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Parse CT `structuredContent` JSON (or pass through an already-object shape).
 * Returns null when unusable — callers must fall back coherently to canonical.
 */
export function parseDecisionSessionStructuredContent(
  raw: string | DecisionSessionStructuredContent | null | undefined,
): DecisionSessionStructuredContent | null {
  if (raw == null) {
    return null;
  }

  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const result: DecisionSessionStructuredContent = {
    decisionContext:
      typeof record.decisionContext === "string" ? record.decisionContext : "",
    objectives: asStringArray(record.objectives),
    options: asStringArray(record.options),
    supportingArguments: asStringArray(record.supportingArguments),
    risks: asStringArray(record.risks),
    dependencies: asStringArray(record.dependencies),
    requiredResources: asStringArray(record.requiredResources),
    suggestedTimeline:
      typeof record.suggestedTimeline === "string" ? record.suggestedTimeline : "",
    suggestedParticipants: asStringArray(record.suggestedParticipants),
    suggestedResponsibleRoles: asStringArray(record.suggestedResponsibleRoles),
    unresolvedQuestions: asStringArray(record.unresolvedQuestions),
  };

  const hasProse =
    STRING_KEYS.some((key) => result[key].trim().length > 0) ||
    ARRAY_KEYS.some((key) => result[key].length > 0);

  return hasProse ? result : null;
}

/**
 * Whole-presentation selection: usable localized structured JSON wins;
 * otherwise coherent canonical structured content (never field-level mosaic).
 */
export function selectDecisionSessionStructuredForDisplay(input: {
  readonly localizationComplete: boolean;
  readonly localizedStructuredJson: string | null | undefined;
  readonly canonicalStructured: DecisionSessionStructuredContent | null | undefined;
}): DecisionSessionStructuredContent | null {
  if (input.localizationComplete) {
    const localized = parseDecisionSessionStructuredContent(
      input.localizedStructuredJson,
    );
    if (localized) {
      return localized;
    }
  }
  return input.canonicalStructured ?? null;
}
