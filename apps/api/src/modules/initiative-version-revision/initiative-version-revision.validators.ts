import type { InitiativeRevisionChange, InitiativeRevisionChangeSection, InitiativeRevisionDraft } from "@hu/types";

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

const REVISION_CHANGE_SECTIONS: readonly InitiativeRevisionChangeSection[] = ["title", "description", "custom"];

export interface AddAuthorOriginatedRevisionChangeInput {
  section: InitiativeRevisionChangeSection;
  sectionLabel?: string;
  before: string;
  after: string;
  authorOriginatedReason: string;
  explanation: string;
}

export function validateAddAuthorOriginatedRevisionChangeInput(
  body: unknown,
): AddAuthorOriginatedRevisionChangeInput {
  const record = (body ?? {}) as Record<string, unknown>;
  const section = record.section;

  if (typeof section !== "string" || !REVISION_CHANGE_SECTIONS.includes(section as InitiativeRevisionChangeSection)) {
    throw new Error(`section must be one of: ${REVISION_CHANGE_SECTIONS.join(", ")}.`);
  }

  return {
    section: section as InitiativeRevisionChangeSection,
    sectionLabel: normalizeOptionalText(record.sectionLabel, "Section label"),
    before: typeof record.before === "string" ? record.before : "",
    after: normalizeText(record.after, "After text"),
    authorOriginatedReason: normalizeText(record.reason, "Reason"),
    explanation: normalizeText(record.explanation, "Explanation"),
  };
}

export interface SaveInitiativeRevisionChangeInput {
  before?: string;
  after?: string;
  explanation?: string;
  authorOriginatedReason?: string;
}

export function validateSaveInitiativeRevisionChangeInput(body: unknown): SaveInitiativeRevisionChangeInput {
  const record = (body ?? {}) as Record<string, unknown>;

  return {
    before: typeof record.before === "string" ? record.before : undefined,
    after: normalizeOptionalText(record.after, "After text"),
    explanation: normalizeOptionalText(record.explanation, "Explanation"),
    authorOriginatedReason: normalizeOptionalText(record.reason, "Reason"),
  };
}

/**
 * Initiative Lifecycle — Part E, Section 5 (Canonical Traceability). "Every
 * Revision change must reference one or more Proposal IDs OR be explicitly
 * marked as an Author-originated change [with] a reason and explanation."
 * This validates every `InitiativeRevisionChange` the Author has actually
 * drafted (Section 5 is about each declared change's own traceability, not
 * a retroactive diff against the previously published Initiative text) —
 * an empty `changes` array (e.g. a Revision published entirely through the
 * pre-Part-E free-text draft fields) is not itself a traceability
 * violation, so this never blocks publication when nothing has been
 * declared as a structured change.
 */
export function validateInitiativeRevisionChangesForPublication(
  changes: readonly InitiativeRevisionChange[],
): void {
  for (const change of changes) {
    if (change.origin === "proposal") {
      if (change.proposalIds.length === 0) {
        throw new Error(
          `Change "${change.sectionLabel || change.section}" is marked as Proposal-based but references no Proposal ID.`,
        );
      }

      continue;
    }

    if (!change.authorOriginatedReason || !change.authorOriginatedReason.trim()) {
      throw new Error(
        `Author-originated change "${change.sectionLabel || change.section}" requires a reason.`,
      );
    }
  }
}
