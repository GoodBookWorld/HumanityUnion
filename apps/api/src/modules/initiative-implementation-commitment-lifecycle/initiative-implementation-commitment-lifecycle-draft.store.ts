import type {
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentLifecycleDraft,
} from "@hu/types";

import { resolveInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter } from "./persistence/resolve-initiative-implementation-commitment-lifecycle-draft-persistence.js";
import { snapshotFromInitiativeImplementationCommitmentLifecycleDrafts } from "./persistence/initiative-implementation-commitment-lifecycle-draft-persistence.types.js";

export interface InitiativeImplementationCommitmentLifecycleDraftUpdate {
  title?: string;
  summary?: string;
  decisionId?: string | null;
  candidates?: InitiativeImplementationCommitmentCandidate[];
}

const persistence = resolveInitiativeImplementationCommitmentLifecycleDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativeImplementationCommitmentLifecycleDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeImplementationCommitmentLifecycleDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      structuredClone(draft),
    ]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativeImplementationCommitmentLifecycleDraft>): void {
  persistence.save(snapshotFromInitiativeImplementationCommitmentLifecycleDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(
  initiativeId: string,
): InitiativeImplementationCommitmentLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativeImplementationCommitmentLifecycleDraft(
  draft: InitiativeImplementationCommitmentLifecycleDraft,
): InitiativeImplementationCommitmentLifecycleDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativeImplementationCommitmentLifecycleDraft(
  initiativeId: string,
  update: InitiativeImplementationCommitmentLifecycleDraftUpdate,
): InitiativeImplementationCommitmentLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  if (!draft) {
    return null;
  }

  if (update.title !== undefined) {
    draft.title = update.title;
  }
  if (update.summary !== undefined) {
    draft.summary = update.summary;
  }
  if (update.decisionId !== undefined) {
    draft.decisionId = update.decisionId;
  }
  if (update.candidates !== undefined) {
    draft.candidates = update.candidates.map((candidate) => structuredClone(candidate));
  }

  draft.updatedAt = new Date().toISOString();
  drafts.set(initiativeId, draft);
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function deleteInitiativeImplementationCommitmentLifecycleDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
