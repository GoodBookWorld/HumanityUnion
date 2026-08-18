import type {
  InitiativeCollectiveDecisionLifecycleDraft,
  InitiativeLifecycleProfile,
  ParticipationScope,
} from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import type { InitiativeCollectiveDecisionLifecycleDraftUpdate } from "./initiative-collective-decision-lifecycle-draft.store.js";

const PARTICIPATION_SCOPES = new Set<ParticipationScope>(["world", "country", "region", "community"]);

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

export function validateSaveInitiativeCollectiveDecisionLifecycleDraftInput(
  body: unknown,
): InitiativeCollectiveDecisionLifecycleDraftUpdate {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  assertOptionalString(record.title, "title");
  assertOptionalString(record.decisionSummary, "decisionSummary");
  assertOptionalString(record.implementationTimeline, "implementationTimeline");
  assertOptionalString(record.decisionRationale, "decisionRationale");
  assertOptionalString(record.closesAt, "closesAt");
  assertOptionalStringArray(record.approvedActions, "approvedActions");
  assertOptionalStringArray(record.rejectedAlternatives, "rejectedAlternatives");
  assertOptionalStringArray(record.responsibleRoles, "responsibleRoles");
  assertOptionalStringArray(record.implementationPriorities, "implementationPriorities");
  assertOptionalStringArray(record.decisionRisks, "decisionRisks");
  assertOptionalStringArray(record.successCriteria, "successCriteria");
  assertOptionalStringArray(record.requiredResources, "requiredResources");
  assertOptionalStringArray(record.supportingReferences, "supportingReferences");

  if (
    record.participationScope !== undefined &&
    !PARTICIPATION_SCOPES.has(record.participationScope as ParticipationScope)
  ) {
    throw new Error("participationScope must be one of world, country, region, community.");
  }

  return {
    title: record.title as string | undefined,
    decisionSummary: record.decisionSummary as string | undefined,
    approvedActions: record.approvedActions as string[] | undefined,
    rejectedAlternatives: record.rejectedAlternatives as string[] | undefined,
    responsibleRoles: record.responsibleRoles as string[] | undefined,
    implementationPriorities: record.implementationPriorities as string[] | undefined,
    implementationTimeline: record.implementationTimeline as string | undefined,
    decisionRationale: record.decisionRationale as string | undefined,
    decisionRisks: record.decisionRisks as string[] | undefined,
    successCriteria: record.successCriteria as string[] | undefined,
    requiredResources: record.requiredResources as string[] | undefined,
    supportingReferences: record.supportingReferences as string[] | undefined,
    participationScope: record.participationScope as ParticipationScope | undefined,
    closesAt: record.closesAt as string | undefined,
  };
}

export function validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
  draft: InitiativeCollectiveDecisionLifecycleDraft,
  options?: { lifecycleProfile?: InitiativeLifecycleProfile | string | null },
): void {
  if (!draft.title.trim()) {
    throw new Error("Decision title is required.");
  }

  if (!draft.decisionSummary.trim()) {
    throw new Error("Decision summary is required.");
  }

  if (draft.approvedActions.length === 0) {
    throw new Error("At least one approved action is required.");
  }

  const profile = resolveInitiativeLifecycleProfile(options?.lifecycleProfile);
  if (!draft.decisionSessionId && profile !== "PUBLIC_CHOICE") {
    throw new Error("A Decision Session reference is required before publishing a Collective Decision.");
  }

  if (!PARTICIPATION_SCOPES.has(draft.participationScope)) {
    throw new Error("participationScope must be one of world, country, region, community.");
  }

  if (!draft.closesAt.trim()) {
    throw new Error("Closing date is required.");
  }

  const closesAtMillis = Date.parse(draft.closesAt);

  if (Number.isNaN(closesAtMillis)) {
    throw new Error("Closing date must be a valid date.");
  }

  if (closesAtMillis <= Date.now()) {
    throw new Error("Closing date must be in the future.");
  }
}
