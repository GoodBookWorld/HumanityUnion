import type { InitiativeRevisionDraft } from "@hu/types";

export interface SaveInitiativeRevisionDraftInput {
  title?: string;
  description?: string;
  communitySlug?: string;
  activityArea?: string;
  revisionSummary?: string;
  appliedProposalIds?: string[];
  skippedProposalIds?: string[];
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

function normalizeProposalIds(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value.map((entry, index) => normalizeText(entry, `${fieldName}[${index}]`));
}

export function validateSaveInitiativeRevisionDraftInput(
  body: unknown,
): SaveInitiativeRevisionDraftInput {
  if (!body || typeof body !== "object") {
    throw new Error("Request body is required.");
  }

  const record = body as Record<string, unknown>;
  const update: SaveInitiativeRevisionDraftInput = {};

  const title = normalizeOptionalText(record.title, "Title");
  if (title !== undefined) {
    update.title = title;
  }

  const description = normalizeOptionalText(record.description, "Description");
  if (description !== undefined) {
    update.description = description;
  }

  const communitySlug = normalizeOptionalText(record.communitySlug, "Community association");
  if (communitySlug !== undefined) {
    update.communitySlug = communitySlug;
  }

  const activityArea = normalizeOptionalText(record.activityArea, "Activity area");
  if (activityArea !== undefined) {
    update.activityArea = activityArea;
  }

  const revisionSummary = normalizeOptionalText(record.revisionSummary, "Revision summary");
  if (revisionSummary !== undefined) {
    update.revisionSummary = revisionSummary;
  }

  const appliedProposalIds = normalizeProposalIds(record.appliedProposalIds, "Applied proposals");
  if (appliedProposalIds !== undefined) {
    update.appliedProposalIds = appliedProposalIds;
  }

  const skippedProposalIds = normalizeProposalIds(record.skippedProposalIds, "Skipped proposals");
  if (skippedProposalIds !== undefined) {
    update.skippedProposalIds = skippedProposalIds;
  }

  if (Object.keys(update).length === 0) {
    throw new Error("At least one editable field is required.");
  }

  return update;
}

export function validateInitiativeRevisionDraftForPublication(
  draft: InitiativeRevisionDraft,
): void {
  normalizeText(draft.title, "Title");
  normalizeText(draft.description, "Description");
  normalizeText(draft.metadata.communitySlug, "Community association");
  normalizeText(draft.metadata.activityArea, "Activity area");
  normalizeText(draft.revisionSummary, "Revision summary");
}
