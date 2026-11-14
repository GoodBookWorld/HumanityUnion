import type { InitiativePetitionDraft, InitiativePetitionDraftContext, Petition } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export interface SaveInitiativePetitionDraftInput {
  title?: string;
  publicSummary?: string;
  requestStatement?: string;
  expectedOutcome?: string;
  supportingContext?: string;
  keyArguments?: string[];
}

/**
 * Initiative Lifecycle — Part F, Section 6 (Petition Workspace). Mirrors
 * `getInitiativeRevisionWorkspace` (Part E): one request returns the
 * Author's current draft AND the read-only Petition Intelligence Snapshot
 * (Sources) together.
 */
export async function getInitiativePetitionWorkspace(
  initiativeId: string,
): Promise<InitiativePetitionDraftContext> {
  return apiRequest<InitiativePetitionDraftContext>(
    `/api/v1/initiative-petitions/initiative/${encodeURIComponent(initiativeId)}/workspace`,
  );
}

/**
 * Section 3 (Petition Draft Builder) — "Generate": deterministically
 * (re)builds every suggested field (Title, Public Summary, Request
 * Statement, Expected Outcome, Supporting Context, Key Arguments) from the
 * current Intelligence Snapshot. Creates the working draft on first call.
 */
export async function generateInitiativePetitionDraft(
  initiativeId: string,
): Promise<InitiativePetitionDraft> {
  return apiRequest<InitiativePetitionDraft>(
    `/api/v1/initiative-petitions/initiative/${encodeURIComponent(initiativeId)}/draft/generate`,
    { method: "POST" },
  );
}

/** Section 6 — "Save Draft": the Author's own edits to the generated (or blank) draft fields. */
export async function saveInitiativePetitionDraft(
  initiativeId: string,
  input: SaveInitiativePetitionDraftInput,
): Promise<InitiativePetitionDraft> {
  return apiRequest<InitiativePetitionDraft>(
    `/api/v1/initiative-petitions/initiative/${encodeURIComponent(initiativeId)}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

/**
 * Section 6/9/10 — "Publish": promotes the draft to the canonical Public
 * Petition (attaching permanent Traceability), opens it for signing, and
 * unlocks Decision Session.
 */
export async function publishInitiativePetitionStage(initiativeId: string): Promise<Petition> {
  return apiRequest<Petition>(
    `/api/v1/initiative-petitions/initiative/${encodeURIComponent(initiativeId)}/publish`,
    { method: "POST" },
  );
}

/**
 * HU-LC-05C.3 / 05C.4B / 05C.4C / 05C.4C.7C.1 — one of an Initiative's
 * independent working drafts (steward-only). Mirrors the API record.
 */
export interface PetitionWorkingDraft {
  readonly draftId: string;
  readonly initiativeId: string;
  readonly authorId: string;
  readonly title: string;
  readonly publicSummary: string;
  readonly requestStatement: string;
  readonly expectedOutcome: string;
  readonly supportingContext: string;
  readonly keyArguments: readonly string[];
  readonly recipients: readonly string[];
  readonly derivedFromPetitionId: string | null;
  readonly revisionId: string | null;
  readonly revisionVersion: number | null;
  readonly analysisId: string | null;
  readonly analysisVersion: number | null;
  readonly proposalIds: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavePetitionWorkingDraftInput extends SaveInitiativePetitionDraftInput {
  recipients?: string[];
}

function workingDraftsPath(initiativeId: string): string {
  return `/api/v1/initiative-petitions/initiative/${encodeURIComponent(initiativeId)}/drafts`;
}

function workingDraftPath(initiativeId: string, draftId: string): string {
  return `${workingDraftsPath(initiativeId)}/${encodeURIComponent(draftId)}`;
}

/** 200 only for the Initiative's steward; 401 / 403 otherwise. */
export async function listPetitionWorkingDrafts(
  initiativeId: string,
): Promise<PetitionWorkingDraft[]> {
  return apiRequest<PetitionWorkingDraft[]>(workingDraftsPath(initiativeId));
}

/** An empty draft, or a copy of a published Petition of the same Initiative. */
export async function createPetitionWorkingDraft(
  initiativeId: string,
  derivedFromPetitionId: string | null = null,
): Promise<PetitionWorkingDraft> {
  return apiRequest<PetitionWorkingDraft>(workingDraftsPath(initiativeId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(derivedFromPetitionId ? { derivedFromPetitionId } : {}),
  });
}

export async function savePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  input: SavePetitionWorkingDraftInput,
): Promise<PetitionWorkingDraft> {
  return apiRequest<PetitionWorkingDraft>(workingDraftPath(initiativeId, draftId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Existing content is replaced only when `overwrite` is true (409 otherwise). */
export async function generatePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
  overwrite: boolean,
): Promise<PetitionWorkingDraft> {
  return apiRequest<PetitionWorkingDraft>(`${workingDraftPath(initiativeId, draftId)}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overwrite }),
  });
}

/** Publishes the draft as a new, separate Petition (`petition-<draftId>`). */
export async function publishPetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
): Promise<Petition> {
  return apiRequest<Petition>(`${workingDraftPath(initiativeId, draftId)}/publish`, {
    method: "POST",
  });
}

export async function deletePetitionWorkingDraft(
  initiativeId: string,
  draftId: string,
): Promise<void> {
  await apiRequest<null>(workingDraftPath(initiativeId, draftId), { method: "DELETE" });
}
