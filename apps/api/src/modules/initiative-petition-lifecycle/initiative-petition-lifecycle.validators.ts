import type { InitiativePetitionDraft } from "@hu/types";

export interface SaveInitiativePetitionDraftInput {
  title?: string;
  publicSummary?: string;
  requestStatement?: string;
  expectedOutcome?: string;
  supportingContext?: string;
  keyArguments?: string[];
}

function normalizeOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  return value;
}

export function validateSaveInitiativePetitionDraftInput(body: unknown): SaveInitiativePetitionDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const keyArguments = record.keyArguments;

  if (keyArguments !== undefined) {
    if (!Array.isArray(keyArguments) || keyArguments.some((entry) => typeof entry !== "string")) {
      throw new Error("keyArguments must be an array of strings.");
    }
  }

  return {
    title: normalizeOptionalString(record.title, "Title"),
    publicSummary: normalizeOptionalString(record.publicSummary, "Public Summary"),
    requestStatement: normalizeOptionalString(record.requestStatement, "Request Statement"),
    expectedOutcome: normalizeOptionalString(record.expectedOutcome, "Expected Outcome"),
    supportingContext: normalizeOptionalString(record.supportingContext, "Supporting Context"),
    keyArguments: keyArguments as string[] | undefined,
  };
}

/**
 * Initiative Lifecycle — Part F, Section 3/9. Mirrors
 * `validateInitiativeRevisionDraftForPublication`'s discipline: Publish is
 * blocked with a clear, actionable message rather than silently publishing
 * an incomplete Petition. `revisionId` must be present — Part F, Section 2:
 * "Petition must always reference the approved Revision."
 */
export function validateInitiativePetitionDraftForPublication(draft: InitiativePetitionDraft): void {
  if (!draft.title.trim()) {
    throw new Error("Petition title is required before publishing.");
  }

  if (!draft.publicSummary.trim()) {
    throw new Error("Petition public summary is required before publishing.");
  }

  if (!draft.requestStatement.trim()) {
    throw new Error("Petition request statement is required before publishing.");
  }

  if (!draft.expectedOutcome.trim()) {
    throw new Error("Petition expected outcome is required before publishing.");
  }

  if (!draft.revisionId || draft.revisionVersion === null) {
    throw new Error("Petition must reference a Published Revision before publishing.");
  }
}
