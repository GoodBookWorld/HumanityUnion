import type {
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionRecommendationKind,
} from "@hu/types";

import type { InitiativeDecisionSessionDraftUpdate } from "./initiative-decision-session-draft.store.js";

const RECOMMENDATION_KINDS = new Set<InitiativeDecisionSessionRecommendationKind>([
  "option",
  "risk",
  "timeline",
  "role",
  "implementation_concern",
  "general",
]);

function assertOptionalStringArray(
  value: unknown,
  fieldName: string,
): asserts value is string[] | undefined {
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
}

function assertOptionalString(value: unknown, fieldName: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
}

export function validateSaveInitiativeDecisionSessionDraftInput(
  body: unknown,
): InitiativeDecisionSessionDraftUpdate {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  assertOptionalString(record.title, "title");
  assertOptionalString(record.decisionQuestion, "decisionQuestion");
  assertOptionalString(record.decisionContext, "decisionContext");
  assertOptionalString(record.suggestedTimeline, "suggestedTimeline");
  assertOptionalString(record.purpose, "purpose");
  assertOptionalString(record.opensAt, "opensAt");
  assertOptionalString(record.closesAt, "closesAt");
  assertOptionalStringArray(record.objectives, "objectives");
  assertOptionalStringArray(record.options, "options");
  assertOptionalStringArray(record.supportingArguments, "supportingArguments");
  assertOptionalStringArray(record.risks, "risks");
  assertOptionalStringArray(record.dependencies, "dependencies");
  assertOptionalStringArray(record.requiredResources, "requiredResources");
  assertOptionalStringArray(record.suggestedParticipants, "suggestedParticipants");
  assertOptionalStringArray(record.suggestedResponsibleRoles, "suggestedResponsibleRoles");
  assertOptionalStringArray(record.unresolvedQuestions, "unresolvedQuestions");

  return {
    title: record.title as string | undefined,
    decisionQuestion: record.decisionQuestion as string | undefined,
    decisionContext: record.decisionContext as string | undefined,
    objectives: record.objectives as string[] | undefined,
    options: record.options as string[] | undefined,
    supportingArguments: record.supportingArguments as string[] | undefined,
    risks: record.risks as string[] | undefined,
    dependencies: record.dependencies as string[] | undefined,
    requiredResources: record.requiredResources as string[] | undefined,
    suggestedTimeline: record.suggestedTimeline as string | undefined,
    suggestedParticipants: record.suggestedParticipants as string[] | undefined,
    suggestedResponsibleRoles: record.suggestedResponsibleRoles as string[] | undefined,
    unresolvedQuestions: record.unresolvedQuestions as string[] | undefined,
    purpose: record.purpose as string | undefined,
    opensAt: record.opensAt as string | undefined,
    closesAt: record.closesAt as string | undefined,
  };
}

export function validateInitiativeDecisionSessionDraftForPublication(
  draft: InitiativeDecisionSessionDraft,
): void {
  if (!draft.title.trim()) {
    throw new Error("Decision title is required.");
  }

  if (!draft.decisionQuestion.trim()) {
    throw new Error("Decision question is required.");
  }

  if (!draft.decisionContext.trim()) {
    throw new Error("Decision context is required.");
  }

  if (draft.options.length === 0) {
    throw new Error("At least one decision option is required.");
  }

  if (!draft.petitionId) {
    throw new Error("A Petition reference is required before publishing a Decision Session.");
  }

  if (Date.parse(draft.closesAt) <= Date.parse(draft.opensAt)) {
    throw new Error("Closing date must be after opening date.");
  }
}

export function validateSubmitDecisionSessionRecommendationInput(body: unknown): {
  kind: InitiativeDecisionSessionRecommendationKind;
  title: string;
  body: string;
} {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  if (typeof record.kind !== "string" || !RECOMMENDATION_KINDS.has(record.kind as InitiativeDecisionSessionRecommendationKind)) {
    throw new Error("kind must be a valid recommendation kind.");
  }

  if (typeof record.title !== "string" || !record.title.trim()) {
    throw new Error("title must be a non-empty string.");
  }

  if (typeof record.body !== "string" || !record.body.trim()) {
    throw new Error("body must be a non-empty string.");
  }

  return {
    kind: record.kind as InitiativeDecisionSessionRecommendationKind,
    title: record.title.trim(),
    body: record.body.trim(),
  };
}
