import type { InitiativeStructuredProposal, InitiativeStructuredProposalStatus } from "@hu/types";

export interface SaveInitiativeStructuredProposalInput {
  title?: string;
  summary?: string;
  description?: string;
  reason?: string;
  expectedImprovement?: string;
  supportingSources?: string;
  relatedDiscussionReferences?: string;
}

export interface CreateManualInitiativeStructuredProposalInput {
  title: string;
  summary: string;
  description: string;
  reason: string;
  expectedImprovement: string;
  supportingSources: string;
  relatedDiscussionReferences: string;
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }

  return value;
}

function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }

  return value;
}

export function validateSaveInitiativeStructuredProposalInput(body: unknown): SaveInitiativeStructuredProposalInput {
  const record = (body ?? {}) as Record<string, unknown>;

  return {
    title: optionalString(record, "title"),
    summary: optionalString(record, "summary"),
    description: optionalString(record, "description"),
    reason: optionalString(record, "reason"),
    expectedImprovement: optionalString(record, "expectedImprovement"),
    supportingSources: optionalString(record, "supportingSources"),
    relatedDiscussionReferences: optionalString(record, "relatedDiscussionReferences"),
  };
}

export function validateCreateManualInitiativeStructuredProposalInput(
  body: unknown,
): CreateManualInitiativeStructuredProposalInput {
  const record = (body ?? {}) as Record<string, unknown>;

  return {
    title: requireString(record, "title"),
    summary: requireString(record, "summary"),
    description: requireString(record, "description"),
    reason: requireString(record, "reason"),
    expectedImprovement: requireString(record, "expectedImprovement"),
    supportingSources: optionalString(record, "supportingSources") ?? "",
    relatedDiscussionReferences: optionalString(record, "relatedDiscussionReferences") ?? "",
  };
}

const CURATION_STATUSES: readonly InitiativeStructuredProposalStatus[] = [
  "included_in_revision",
  "keep_for_later",
  "not_applicable",
];
const PRE_PUBLICATION_STATUSES: readonly InitiativeStructuredProposalStatus[] = ["draft", "ready"];

export function validateProposalStatusInput(body: unknown): InitiativeStructuredProposalStatus {
  const record = (body ?? {}) as Record<string, unknown>;
  const status = record.status;

  const allValues: readonly InitiativeStructuredProposalStatus[] = [
    ...PRE_PUBLICATION_STATUSES,
    "published",
    ...CURATION_STATUSES,
  ];

  if (typeof status !== "string" || !allValues.includes(status as InitiativeStructuredProposalStatus)) {
    throw new Error(`status must be one of: ${allValues.join(", ")}.`);
  }

  return status as InitiativeStructuredProposalStatus;
}

/**
 * Part 6/7 — pre-publication, the Author freely toggles between `"draft"`
 * and `"ready"`, and may also apply Accept / Partial / Decline treatment
 * (`included_in_revision` / `keep_for_later` / `not_applicable`) so the
 * Improvement Proposals stage can feed an Initiative version commit before
 * the collection itself is published.
 *
 * Once a proposal is `"published"`, ONLY the three Author-decision curation
 * statuses may be applied — never back to `"draft"`/`"ready"` (that would
 * silently un-publish a proposal without going through a real republish),
 * and never directly to `"published"` by hand (only the collection-level
 * Publish / complete action sets that, in bulk, for every `"ready"` proposal).
 */
export function assertProposalStatusTransitionAllowed(
  proposal: InitiativeStructuredProposal,
  collectionStatus: "draft" | "published" | "archived",
  nextStatus: InitiativeStructuredProposalStatus,
): void {
  if (collectionStatus === "draft") {
    const allowedOnDraft: readonly InitiativeStructuredProposalStatus[] = [
      ...PRE_PUBLICATION_STATUSES,
      ...CURATION_STATUSES,
    ];

    if (!allowedOnDraft.includes(nextStatus)) {
      throw new Error(
        'Only "draft", "ready", "included_in_revision", "keep_for_later", or "not_applicable" may be set before this collection is published.',
      );
    }

    return;
  }

  if (collectionStatus === "published") {
    const isCurrentlyCuratable =
      proposal.status === "published" ||
      proposal.status === "ready" ||
      CURATION_STATUSES.includes(proposal.status);

    if (!isCurrentlyCuratable || !CURATION_STATUSES.includes(nextStatus)) {
      throw new Error(
        'Once published, a proposal\'s status may only change to "included_in_revision", "keep_for_later", or "not_applicable".',
      );
    }

    return;
  }

  throw new Error("This collection is archived and its proposals can no longer change status.");
}

export function validateInitiativeStructuredProposalForPublication(proposal: InitiativeStructuredProposal): void {
  const requiredFields: Array<[keyof InitiativeStructuredProposal, string]> = [
    ["title", "Title"],
    ["summary", "Summary"],
    ["description", "Description"],
    ["reason", "Reason"],
    ["expectedImprovement", "Expected Improvement"],
  ];

  for (const [field, label] of requiredFields) {
    const value = proposal[field];

    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${label} is required to publish "${proposal.title || proposal.proposalId}".`);
    }
  }
}
