import type { InitiativePetitionDraft } from "@hu/types";

import { resolveInitiativePetitionDraftPersistenceAdapter } from "./persistence/resolve-initiative-petition-draft-persistence.js";
import { snapshotFromInitiativePetitionDrafts } from "./persistence/initiative-petition-draft-persistence.types.js";

export interface InitiativePetitionDraftUpdate {
  title?: string;
  publicSummary?: string;
  requestStatement?: string;
  expectedOutcome?: string;
  supportingContext?: string;
  keyArguments?: string[];
  revisionId?: string | null;
  revisionVersion?: number | null;
  analysisId?: string | null;
  analysisVersion?: number | null;
  proposalIds?: string[];
}

const persistence = resolveInitiativePetitionDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativePetitionDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativePetitionDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [initiativeId, structuredClone(draft)]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativePetitionDraft>): void {
  persistence.save(snapshotFromInitiativePetitionDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativePetitionDraftByInitiativeId(
  initiativeId: string,
): InitiativePetitionDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativePetitionDraft(
  draft: InitiativePetitionDraft,
): InitiativePetitionDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativePetitionDraft(
  initiativeId: string,
  update: InitiativePetitionDraftUpdate,
): InitiativePetitionDraft | null {
  const draft = drafts.get(initiativeId);

  if (!draft) {
    return null;
  }

  if (update.title !== undefined) {
    draft.title = update.title;
  }

  if (update.publicSummary !== undefined) {
    draft.publicSummary = update.publicSummary;
  }

  if (update.requestStatement !== undefined) {
    draft.requestStatement = update.requestStatement;
  }

  if (update.expectedOutcome !== undefined) {
    draft.expectedOutcome = update.expectedOutcome;
  }

  if (update.supportingContext !== undefined) {
    draft.supportingContext = update.supportingContext;
  }

  if (update.keyArguments !== undefined) {
    draft.keyArguments = [...update.keyArguments];
  }

  if (update.revisionId !== undefined) {
    draft.revisionId = update.revisionId;
  }

  if (update.revisionVersion !== undefined) {
    draft.revisionVersion = update.revisionVersion;
  }

  if (update.analysisId !== undefined) {
    draft.analysisId = update.analysisId;
  }

  if (update.analysisVersion !== undefined) {
    draft.analysisVersion = update.analysisVersion;
  }

  if (update.proposalIds !== undefined) {
    draft.proposalIds = [...update.proposalIds];
  }

  draft.updatedAt = new Date().toISOString();

  drafts.set(initiativeId, draft);
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function deleteInitiativePetitionDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
