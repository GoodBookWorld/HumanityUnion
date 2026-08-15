import type {
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentLifecycleDraft,
} from "@hu/types";

import type { InitiativeImplementationCommitmentLifecycleDraftUpdate } from "./initiative-implementation-commitment-lifecycle-draft.store.js";

function assertOptionalString(value: unknown, fieldName: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
}

function assertOptionalNullableString(
  value: unknown,
  fieldName: string,
): asserts value is string | null | undefined {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null.`);
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
}

function assertCandidate(value: unknown, index: number): InitiativeImplementationCommitmentCandidate {
  if (!value || typeof value !== "object") {
    throw new Error(`candidates[${index}] must be an object.`);
  }

  const record = value as Record<string, unknown>;

  if (typeof record.candidateId !== "string" || !record.candidateId.trim()) {
    throw new Error(`candidates[${index}].candidateId is required.`);
  }

  if (typeof record.approvedAction !== "string") {
    throw new Error(`candidates[${index}].approvedAction must be a string.`);
  }

  if (typeof record.description !== "string") {
    throw new Error(`candidates[${index}].description must be a string.`);
  }

  if (typeof record.suggestedResponsibleRole !== "string") {
    throw new Error(`candidates[${index}].suggestedResponsibleRole must be a string.`);
  }

  if (typeof record.suggestedTimeline !== "string") {
    throw new Error(`candidates[${index}].suggestedTimeline must be a string.`);
  }

  if (typeof record.priority !== "string") {
    throw new Error(`candidates[${index}].priority must be a string.`);
  }

  assertStringArray(record.requiredResources, `candidates[${index}].requiredResources`);
  assertStringArray(record.relatedRisks, `candidates[${index}].relatedRisks`);
  assertStringArray(record.references, `candidates[${index}].references`);
  assertOptionalNullableString(record.proposedParticipantId, `candidates[${index}].proposedParticipantId`);

  if (record.status !== "draft") {
    throw new Error(`candidates[${index}].status must be "draft".`);
  }

  return {
    candidateId: record.candidateId,
    approvedAction: record.approvedAction,
    description: record.description,
    suggestedResponsibleRole: record.suggestedResponsibleRole,
    suggestedTimeline: record.suggestedTimeline,
    priority: record.priority,
    requiredResources: [...(record.requiredResources as string[])],
    relatedRisks: [...(record.relatedRisks as string[])],
    references: [...(record.references as string[])],
    proposedParticipantId: (record.proposedParticipantId as string | null | undefined) ?? null,
    status: "draft",
  };
}

export function validateSaveInitiativeImplementationCommitmentLifecycleDraftInput(
  body: unknown,
): InitiativeImplementationCommitmentLifecycleDraftUpdate {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  assertOptionalString(record.title, "title");
  assertOptionalString(record.summary, "summary");

  if (record.candidates !== undefined && !Array.isArray(record.candidates)) {
    throw new Error("candidates must be an array.");
  }

  const candidates = Array.isArray(record.candidates)
    ? record.candidates.map((candidate, index) => assertCandidate(candidate, index))
    : undefined;

  return {
    title: record.title as string | undefined,
    summary: record.summary as string | undefined,
    candidates,
  };
}

export function validateInitiativeImplementationCommitmentLifecycleDraftForPublication(
  draft: InitiativeImplementationCommitmentLifecycleDraft,
): void {
  if (!draft.title.trim()) {
    throw new Error("Implementation Commitments title is required.");
  }

  if (!draft.decisionId) {
    throw new Error("A Collective Decision reference is required before publishing Implementation Commitments.");
  }

  if (draft.candidates.length === 0) {
    throw new Error("At least one Commitment Candidate is required.");
  }

  for (const [index, candidate] of draft.candidates.entries()) {
    if (!candidate.approvedAction.trim()) {
      throw new Error(`Candidate ${index + 1} is missing its Approved Action.`);
    }
  }
}
