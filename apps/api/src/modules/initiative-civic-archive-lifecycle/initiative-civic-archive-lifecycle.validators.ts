import type {
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeLifecycleProfile,
} from "@hu/types";

import type { InitiativeCivicArchiveLifecycleDraftUpdate } from "./initiative-civic-archive-lifecycle-draft.store.js";

function assertOptionalString(value: unknown, fieldName: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`${fieldName} must be a string.`);
  }
}

/**
 * Save allows only Author-editable final fields (+ optional regenerate handled
 * by Generate endpoint). Assembled section bodies are not Author-writable.
 */
export function validateSaveInitiativeCivicArchiveLifecycleDraftInput(
  body: unknown,
): InitiativeCivicArchiveLifecycleDraftUpdate {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;

  if (
    record.sections !== undefined ||
    record.timeline !== undefined ||
    record.completeness !== undefined ||
    record.participationStatistics !== undefined ||
    record.publicImpactReportId !== undefined
  ) {
    throw new Error(
      "Save supports only finalArchiveTitle, finalSummary, lessonsLearned, and knowledgeContribution.",
    );
  }

  assertOptionalString(record.finalArchiveTitle, "finalArchiveTitle");
  assertOptionalString(record.finalSummary, "finalSummary");
  assertOptionalString(record.lessonsLearned, "lessonsLearned");
  assertOptionalString(record.knowledgeContribution, "knowledgeContribution");

  return {
    finalArchiveTitle: record.finalArchiveTitle as string | undefined,
    finalSummary: record.finalSummary as string | undefined,
    lessonsLearned: record.lessonsLearned as string | undefined,
    knowledgeContribution: record.knowledgeContribution as string | undefined,
  };
}

export function validateInitiativeCivicArchiveLifecycleDraftForPublication(
  draft: InitiativeCivicArchiveLifecycleDraft,
  _options?: { lifecycleProfile?: InitiativeLifecycleProfile | string | null },
): void {
  if (!draft.finalArchiveTitle.trim()) {
    throw new Error("Civic Archive finalArchiveTitle is required.");
  }

  if (!draft.finalSummary.trim()) {
    throw new Error("Civic Archive finalSummary is required.");
  }

  // Public Impact reference is SOURCE_OPTIONAL for all profiles (Step 03).

  if (draft.sections.length === 0) {
    throw new Error("Civic Archive must be generated before publishing.");
  }
}
