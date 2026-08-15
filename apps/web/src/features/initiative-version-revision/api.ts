import type {
  Initiative,
  InitiativeRevisionChangeSection,
  InitiativeRevisionDraft,
  InitiativeRevisionDraftContext,
  InitiativeRevisionReactionKind,
  InitiativeRevisionReactionSummary,
  InitiativeVersionRevision,
  PublicInitiativeVersionRevisionProjection,
  PublicInitiativeWithVersionHistory,
} from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface SaveInitiativeRevisionDraftInput {
  title?: string;
  description?: string;
  communitySlug?: string;
  activityArea?: string;
  revisionSummary?: string;
  appliedProposalIds?: string[];
  skippedProposalIds?: string[];
}

export interface AddAuthorOriginatedRevisionChangeInput {
  section: InitiativeRevisionChangeSection;
  sectionLabel?: string;
  before?: string;
  after: string;
  reason: string;
  explanation: string;
}

export interface SaveInitiativeRevisionChangeInput {
  before?: string;
  after?: string;
  explanation?: string;
  reason?: string;
}

export async function listInitiativeVersionRevisions(
  initiativeId: string,
): Promise<InitiativeVersionRevision[]> {
  return apiRequest<InitiativeVersionRevision[]>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}`,
  );
}

export async function getInitiativeRevisionWorkspace(
  initiativeId: string,
): Promise<InitiativeRevisionDraftContext> {
  return apiRequest<InitiativeRevisionDraftContext>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

export async function createInitiativeRevisionDraft(
  initiativeId: string,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "POST",
    },
  );
}

export async function saveInitiativeRevisionDraft(
  initiativeId: string,
  input: SaveInitiativeRevisionDraftInput,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}

export async function publishInitiativeRevision(initiativeId: string): Promise<{
  revision: InitiativeVersionRevision;
  initiative: Initiative;
}> {
  return apiRequest<{ revision: InitiativeVersionRevision; initiative: Initiative }>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/publish`,
    {
      method: "POST",
    },
  );
}

/**
 * Initiative Lifecycle — Part E, Section 3/6 (Intelligent Revision Builder
 * / "Generate"). Enriches the working draft's `changes` with deterministic
 * suggestions from eligible ("Included in Revision") Improvement
 * Proposals — never overwrites an existing change.
 */
export async function generateInitiativeRevisionChanges(
  initiativeId: string,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/changes/generate`,
    { method: "POST" },
  );
}

/** Part 8 — Author-originated change: an improvement not sourced from a Proposal, explicitly marked with a reason. */
export async function addAuthorOriginatedRevisionChange(
  initiativeId: string,
  input: AddAuthorOriginatedRevisionChangeInput,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/changes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

/** Part 4/7 — the Author edits a suggested or manual change's text/explanation. */
export async function saveInitiativeRevisionChange(
  initiativeId: string,
  changeId: string,
  input: SaveInitiativeRevisionChangeInput,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/changes/${encodeURIComponent(changeId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

/** Part 6 — discard a suggested or manual change before publish. */
export async function removeInitiativeRevisionChange(
  initiativeId: string,
  changeId: string,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/changes/${encodeURIComponent(changeId)}`,
    { method: "DELETE" },
  );
}

/** Part 6/7 — copy one reviewed change's `after` text into the draft's real title/description field. */
export async function applyInitiativeRevisionChange(
  initiativeId: string,
  changeId: string,
): Promise<InitiativeRevisionDraft> {
  return apiRequest<InitiativeRevisionDraft>(
    `/api/v1/initiative-revisions/initiative/${encodeURIComponent(initiativeId)}/changes/${encodeURIComponent(changeId)}/apply`,
    { method: "POST" },
  );
}

/**
 * Initiative Lifecycle — Part E, Section 9 (Community Reactions). `reaction`
 * of `"none"` clears the caller's existing reaction on this published
 * Revision version.
 */
export async function setInitiativeRevisionReaction(
  initiativeId: string,
  version: number,
  reaction: InitiativeRevisionReactionKind | "none",
): Promise<InitiativeRevisionReactionSummary> {
  const result = await apiRequest<{
    reactionSummary: InitiativeRevisionReactionSummary;
  }>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/revisions/${version}/reactions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reaction }),
    },
  );

  return result.reactionSummary;
}

export async function getPublicInitiativeVersionHistory(
  initiativeId: string,
): Promise<PublicInitiativeWithVersionHistory> {
  return apiRequest<PublicInitiativeWithVersionHistory>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/revisions`,
  );
}

export async function getPublicInitiativeVersionRevision(
  initiativeId: string,
  version: number,
): Promise<PublicInitiativeVersionRevisionProjection> {
  return apiRequest<PublicInitiativeVersionRevisionProjection>(
    `/api/v1/public/initiatives/${encodeURIComponent(initiativeId)}/revisions/${version}`,
  );
}
