import type {
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseLifecycleDraft,
  OfficialResponseType,
  OfficialResponseVerificationState,
} from "@hu/types";

import type { InitiativeOfficialResponseLifecycleDraftUpdate } from "./initiative-official-response-lifecycle-draft.store.js";

const RESPONSE_TYPES: readonly OfficialResponseType[] = [
  "official_letter",
  "email",
  "public_statement",
  "meeting_minutes",
  "policy_update",
  "decision_notice",
  "media_response",
  "other",
];

const VERIFICATION_STATES: readonly OfficialResponseVerificationState[] = [
  "pending",
  "verified",
  "unable_to_verify",
];

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

function assertString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
}

function assertResponseType(value: unknown, fieldName: string): asserts value is OfficialResponseType {
  if (typeof value !== "string" || !RESPONSE_TYPES.includes(value as OfficialResponseType)) {
    throw new Error(`${fieldName} must be one of: ${RESPONSE_TYPES.join(", ")}.`);
  }
}

function assertVerificationStatus(
  value: unknown,
  fieldName: string,
): asserts value is OfficialResponseVerificationState {
  if (typeof value !== "string" || !VERIFICATION_STATES.includes(value as OfficialResponseVerificationState)) {
    throw new Error(`${fieldName} must be one of: ${VERIFICATION_STATES.join(", ")}.`);
  }
}

function assertCandidate(value: unknown, index: number): InitiativeOfficialResponseCandidate {
  if (!value || typeof value !== "object") {
    throw new Error(`candidates[${index}] must be an object.`);
  }

  const record = value as Record<string, unknown>;

  if (typeof record.candidateId !== "string" || !record.candidateId.trim()) {
    throw new Error(`candidates[${index}].candidateId is required.`);
  }

  assertString(record.institution, `candidates[${index}].institution`);
  assertString(record.organization, `candidates[${index}].organization`);
  assertResponseType(record.responseType, `candidates[${index}].responseType`);
  assertString(record.subject, `candidates[${index}].subject`);
  assertString(record.receivedAt, `candidates[${index}].receivedAt`);
  assertString(record.summary, `candidates[${index}].summary`);
  assertString(record.referenceNumber, `candidates[${index}].referenceNumber`);
  assertStringArray(record.relatedActions, `candidates[${index}].relatedActions`);
  assertStringArray(record.relatedCommitmentIds, `candidates[${index}].relatedCommitmentIds`);
  assertStringArray(record.relatedTrackingIds, `candidates[${index}].relatedTrackingIds`);
  assertStringArray(record.documentIds, `candidates[${index}].documentIds`);
  assertStringArray(record.links, `candidates[${index}].links`);
  assertVerificationStatus(record.verificationStatus, `candidates[${index}].verificationStatus`);
  assertString(record.notes, `candidates[${index}].notes`);
  assertStringArray(record.references, `candidates[${index}].references`);

  return {
    candidateId: record.candidateId,
    institution: record.institution as string,
    organization: record.organization as string,
    responseType: record.responseType as OfficialResponseType,
    subject: record.subject as string,
    receivedAt: record.receivedAt as string,
    summary: record.summary as string,
    referenceNumber: record.referenceNumber as string,
    relatedActions: [...(record.relatedActions as string[])],
    relatedCommitmentIds: [...(record.relatedCommitmentIds as string[])],
    relatedTrackingIds: [...(record.relatedTrackingIds as string[])],
    documentIds: [...(record.documentIds as string[])],
    links: [...(record.links as string[])],
    verificationStatus: record.verificationStatus as OfficialResponseVerificationState,
    notes: record.notes as string,
    references: [...(record.references as string[])],
  };
}

export function validateSaveInitiativeOfficialResponseLifecycleDraftInput(
  body: unknown,
): InitiativeOfficialResponseLifecycleDraftUpdate {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  assertOptionalString(record.title, "title");
  assertOptionalString(record.summary, "summary");
  assertOptionalNullableString(record.trackingPackageId, "trackingPackageId");

  if (record.candidates !== undefined && !Array.isArray(record.candidates)) {
    throw new Error("candidates must be an array.");
  }

  const candidates = Array.isArray(record.candidates)
    ? record.candidates.map((candidate, index) => assertCandidate(candidate, index))
    : undefined;

  return {
    title: record.title as string | undefined,
    summary: record.summary as string | undefined,
    trackingPackageId: record.trackingPackageId as string | null | undefined,
    candidates,
  };
}

export function validateInitiativeOfficialResponseLifecycleDraftForPublication(
  draft: InitiativeOfficialResponseLifecycleDraft,
): void {
  if (!draft.title.trim()) {
    throw new Error("Official Responses title is required.");
  }

  if (!draft.trackingPackageId) {
    throw new Error(
      "A published Implementation Tracking Package is required before publishing Official Responses.",
    );
  }

  if (draft.candidates.length === 0) {
    throw new Error("At least one Response Candidate is required.");
  }

  for (const [index, candidate] of draft.candidates.entries()) {
    if (!candidate.institution.trim() && !candidate.organization.trim()) {
      throw new Error(
        `Candidate ${index + 1} is missing an institution or organization — fill this in before publishing.`,
      );
    }

    if (!candidate.subject.trim()) {
      throw new Error(`Candidate ${index + 1} is missing a subject.`);
    }

    if (!candidate.summary.trim()) {
      throw new Error(`Candidate ${index + 1} is missing a summary.`);
    }

    if (!candidate.receivedAt.trim()) {
      throw new Error(`Candidate ${index + 1} is missing a received date.`);
    }
  }
}
