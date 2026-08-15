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
