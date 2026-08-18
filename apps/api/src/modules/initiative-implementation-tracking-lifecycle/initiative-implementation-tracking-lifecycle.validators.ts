import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingLifecycleDraft,
} from "@hu/types";

import type { InitiativeImplementationTrackingLifecycleDraftUpdate } from "./initiative-implementation-tracking-lifecycle-draft.store.js";

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

function assertNullableString(value: unknown, fieldName: string): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error(`${fieldName} must be a string or null.`);
  }
}

function assertStringArray(value: unknown, fieldName: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
}

function assertProgress(value: unknown, fieldName: string): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error(`${fieldName} must be a number between 0 and 100.`);
  }
}

function assertCandidate(value: unknown, index: number): InitiativeImplementationTrackingCandidate {
  if (!value || typeof value !== "object") {
    throw new Error(`candidates[${index}] must be an object.`);
  }

  const record = value as Record<string, unknown>;

  if (typeof record.candidateId !== "string" || !record.candidateId.trim()) {
    throw new Error(`candidates[${index}].candidateId is required.`);
  }

  // commitmentId may be empty for Author-originated / zero-commitment milestones.
  if (typeof record.commitmentId !== "string") {
    throw new Error(`candidates[${index}].commitmentId must be a string.`);
  }

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title
      : typeof record.approvedAction === "string"
        ? record.approvedAction
        : "";

  if (!title.trim()) {
    throw new Error(`candidates[${index}].title is required.`);
  }

  const description = typeof record.description === "string" ? record.description : "";
  const approvedAction =
    typeof record.approvedAction === "string" && record.approvedAction.trim()
      ? record.approvedAction
      : title;

  if (typeof record.responsibleParticipantId !== "string") {
    throw new Error(`candidates[${index}].responsibleParticipantId must be a string.`);
  }

  if (typeof record.currentStatus !== "string") {
    throw new Error(`candidates[${index}].currentStatus must be a string.`);
  }

  assertProgress(record.progress, `candidates[${index}].progress`);

  let plannedStartDate: string | null = null;
  if (record.plannedStartDate !== undefined) {
    assertNullableString(record.plannedStartDate, `candidates[${index}].plannedStartDate`);
    plannedStartDate = record.plannedStartDate as string | null;
  }

  assertNullableString(record.targetDate, `candidates[${index}].targetDate`);
  assertNullableString(record.startedDate, `candidates[${index}].startedDate`);
  assertNullableString(record.completedDate, `candidates[${index}].completedDate`);
  assertStringArray(record.dependencies, `candidates[${index}].dependencies`);
  assertStringArray(record.obstacles, `candidates[${index}].obstacles`);
  assertStringArray(record.evidenceReferences, `candidates[${index}].evidenceReferences`);

  if (typeof record.notes !== "string") {
    throw new Error(`candidates[${index}].notes must be a string.`);
  }

  return {
    candidateId: record.candidateId,
    commitmentId: record.commitmentId,
    title,
    description,
    approvedAction,
    responsibleParticipantId: record.responsibleParticipantId,
    currentStatus: record.currentStatus,
    progress: record.progress as number,
    plannedStartDate,
    targetDate: record.targetDate as string | null,
    startedDate: record.startedDate as string | null,
    completedDate: record.completedDate as string | null,
    dependencies: [...(record.dependencies as string[])],
    obstacles: [...(record.obstacles as string[])],
    evidenceReferences: [...(record.evidenceReferences as string[])],
    notes: record.notes,
  };
}

export function validateSaveInitiativeImplementationTrackingLifecycleDraftInput(
  body: unknown,
): InitiativeImplementationTrackingLifecycleDraftUpdate {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  assertOptionalString(record.title, "title");
  assertOptionalString(record.summary, "summary");
  assertOptionalNullableString(record.packageId, "packageId");

  if (record.candidates !== undefined && !Array.isArray(record.candidates)) {
    throw new Error("candidates must be an array.");
  }

  const candidates = Array.isArray(record.candidates)
    ? record.candidates.map((candidate, index) => assertCandidate(candidate, index))
    : undefined;

  return {
    title: record.title as string | undefined,
    summary: record.summary as string | undefined,
    packageId: record.packageId as string | null | undefined,
    candidates,
  };
}

export function validateInitiativeImplementationTrackingLifecycleDraftForPublication(
  draft: InitiativeImplementationTrackingLifecycleDraft,
): void {
  if (!draft.title.trim()) {
    throw new Error("Implementation Tracking title is required.");
  }

  if (draft.candidates.length === 0) {
    throw new Error("At least one Tracking milestone is required.");
  }

  for (const [index, candidate] of draft.candidates.entries()) {
    const title = (candidate.title || candidate.approvedAction || "").trim();
    if (!title) {
      throw new Error(`Milestone ${index + 1} requires a title.`);
    }
  }
}
