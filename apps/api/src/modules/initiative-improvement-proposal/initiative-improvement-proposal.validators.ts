import type {
  InitiativeImprovementProposal,
  InitiativeImprovementProposalDecision,
} from "@hu/types";

export interface CreateInitiativeImprovementProposalDraftInput {
  analysisId: string;
  targetSection: string;
  currentIssue: string;
  proposedChange: string;
  rationale: string;
  expectedImprovement: string;
  references: string;
}

export interface SaveInitiativeImprovementProposalDraftInput {
  targetSection?: string;
  currentIssue?: string;
  proposedChange?: string;
  rationale?: string;
  expectedImprovement?: string;
  references?: string;
}

export interface DecideInitiativeImprovementProposalInput {
  decision: InitiativeImprovementProposalDecision;
  decisionNote: string;
}

function normalizeText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeOptionalText(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeText(value, fieldName);
}

const VALID_DECISIONS = new Set<InitiativeImprovementProposalDecision>([
  "accepted",
  "partially_accepted",
  "declined",
]);

export function validateCreateInitiativeImprovementProposalDraftInput(
  body: unknown,
): CreateInitiativeImprovementProposalDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  return {
    analysisId: normalizeText(record.analysisId, "Analysis"),
    targetSection: normalizeText(record.targetSection, "Target section"),
    currentIssue: normalizeText(record.currentIssue, "Current issue"),
    proposedChange: normalizeText(record.proposedChange, "Proposed change"),
    rationale: normalizeText(record.rationale, "Rationale"),
    expectedImprovement: normalizeText(record.expectedImprovement, "Expected improvement"),
    references: normalizeText(record.references, "References"),
  };
}

export function validateSaveInitiativeImprovementProposalDraftInput(
  body: unknown,
): SaveInitiativeImprovementProposalDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const update: SaveInitiativeImprovementProposalDraftInput = {};

  const targetSection = normalizeOptionalText(record.targetSection, "Target section");
  if (targetSection !== undefined) {
    update.targetSection = targetSection;
  }

  const currentIssue = normalizeOptionalText(record.currentIssue, "Current issue");
  if (currentIssue !== undefined) {
    update.currentIssue = currentIssue;
  }

  const proposedChange = normalizeOptionalText(record.proposedChange, "Proposed change");
  if (proposedChange !== undefined) {
    update.proposedChange = proposedChange;
  }

  const rationale = normalizeOptionalText(record.rationale, "Rationale");
  if (rationale !== undefined) {
    update.rationale = rationale;
  }

  const expectedImprovement = normalizeOptionalText(
    record.expectedImprovement,
    "Expected improvement",
  );
  if (expectedImprovement !== undefined) {
    update.expectedImprovement = expectedImprovement;
  }

  const references = normalizeOptionalText(record.references, "References");
  if (references !== undefined) {
    update.references = references;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("At least one editable field is required.");
  }

  return update;
}

export function validateDecideInitiativeImprovementProposalInput(
  body: unknown,
): DecideInitiativeImprovementProposalInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const decision = normalizeText(record.decision, "Decision");

  if (!VALID_DECISIONS.has(decision as InitiativeImprovementProposalDecision)) {
    throw new Error("Decision must be accepted, partially_accepted, or declined.");
  }

  return {
    decision: decision as InitiativeImprovementProposalDecision,
    decisionNote: normalizeText(record.decisionNote, "Decision note"),
  };
}

export function validateInitiativeImprovementProposalForSubmission(
  proposal: InitiativeImprovementProposal,
): void {
  normalizeText(proposal.targetSection, "Target section");
  normalizeText(proposal.currentIssue, "Current issue");
  normalizeText(proposal.proposedChange, "Proposed change");
  normalizeText(proposal.rationale, "Rationale");
  normalizeText(proposal.expectedImprovement, "Expected improvement");
  normalizeText(proposal.references, "References");
}
