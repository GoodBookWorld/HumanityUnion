import type { CollectiveDecision, ParticipantDecision } from "@hu/types";

const IMMUTABLE_PATCH_FIELDS = new Set([
  "decisionId",
  "decisionSubjectType",
  "decisionSubjectId",
  "decisionMechanism",
  "status",
  "createdAt",
  "updatedAt",
  "participantDecisions",
  "decisionResult",
  "outcome",
  "statistics",
  "timeline",
]);

const PATCHABLE_FIELDS = new Set(["ballot"]);

export function validateDecisionId(decisionId: string): string | null {
  if (!decisionId.trim()) {
    return "Decision identifier is required.";
  }

  return null;
}

export function validatePatchBody(body: Record<string, unknown>): string | null {
  for (const key of Object.keys(body)) {
    if (IMMUTABLE_PATCH_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }

    if (!PATCHABLE_FIELDS.has(key)) {
      return `Field "${key}" cannot be modified.`;
    }
  }

  return null;
}

export function validateCreateDecision(decision: CollectiveDecision): string | null {
  if (!decision.decisionId?.trim()) {
    return "decisionId is required.";
  }

  if (!decision.decisionSubjectType) {
    return "decisionSubjectType is required.";
  }

  if (!decision.decisionSubjectId?.trim()) {
    return "decisionSubjectId is required.";
  }

  if (!decision.decisionMechanism) {
    return "decisionMechanism is required.";
  }

  if (!decision.ballot?.ballotId?.trim()) {
    return "ballot.ballotId is required.";
  }

  if (!decision.ballot.question?.trim()) {
    return "ballot.question is required.";
  }

  if (!Array.isArray(decision.ballot.options) || decision.ballot.options.length === 0) {
    return "ballot.options are required.";
  }

  return null;
}

export function validateParticipantDecisionBody(body: Record<string, unknown>): string | null {
  if (typeof body.participantDecisionId !== "string" || !body.participantDecisionId.trim()) {
    return "participantDecisionId is required.";
  }

  if (typeof body.participantId !== "string" || !body.participantId.trim()) {
    return "participantId is required.";
  }

  if (typeof body.ballotId !== "string" || !body.ballotId.trim()) {
    return "ballotId is required.";
  }

  if (!Array.isArray(body.selectedOptionIds) || body.selectedOptionIds.length === 0) {
    return "selectedOptionIds are required.";
  }

  if (typeof body.submittedAt !== "string" || !body.submittedAt.trim()) {
    return "submittedAt is required.";
  }

  if (body.status !== "submitted" && body.status !== "superseded") {
    return 'status must be "submitted" or "superseded".';
  }

  return null;
}

export function parseParticipantDecision(body: Record<string, unknown>): ParticipantDecision {
  return {
    participantDecisionId: body.participantDecisionId as string,
    participantId: body.participantId as string,
    ballotId: body.ballotId as string,
    selectedOptionIds: body.selectedOptionIds as string[],
    submittedAt: body.submittedAt as string,
    status: body.status as ParticipantDecision["status"],
  };
}

export function validateTimestampField(
  body: Record<string, unknown>,
  fieldName: string,
): string | null {
  const value = body[fieldName];

  if (typeof value !== "string" || !value.trim()) {
    return `${fieldName} is required.`;
  }

  return null;
}
