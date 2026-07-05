import type { InitiativeRevisionDraft, InitiativeVersionRevision } from "@hu/types";

import { resolveInitiativeVersionRevisionPersistenceAdapter } from "./persistence/resolve-initiative-version-revision-persistence.js";
import { snapshotFromRevisionStore } from "./persistence/initiative-version-revision-persistence.types.js";

export interface InitiativeRevisionDraftUpdate {
  title?: string;
  description?: string;
  metadata?: Partial<InitiativeRevisionDraft["metadata"]>;
  revisionSummary?: string;
  appliedProposalIds?: string[];
  skippedProposalIds?: string[];
}

const persistence = resolveInitiativeVersionRevisionPersistenceAdapter();

function loadStore(): {
  revisions: Map<string, InitiativeVersionRevision>;
  drafts: Map<string, InitiativeRevisionDraft>;
} {
  const snapshot = persistence.load();

  return {
    revisions: new Map<string, InitiativeVersionRevision>(
      Object.entries(snapshot.revisions).map(([revisionId, revision]) => [
        revisionId,
        structuredClone(revision),
      ]),
    ),
    drafts: new Map<string, InitiativeRevisionDraft>(
      Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
        initiativeId,
        structuredClone(draft),
      ]),
    ),
  };
}

function persistStore(
  revisions: Map<string, InitiativeVersionRevision>,
  drafts: Map<string, InitiativeRevisionDraft>,
): void {
  persistence.save(snapshotFromRevisionStore(revisions, drafts));
}

const store = loadStore();
const revisions = store.revisions;
const drafts = store.drafts;

export function getRevisionById(revisionId: string): InitiativeVersionRevision | null {
  const revision = revisions.get(revisionId);

  return revision ? structuredClone(revision) : null;
}

export function listRevisionsByInitiative(initiativeId: string): InitiativeVersionRevision[] {
  return Array.from(revisions.values(), (revision) => structuredClone(revision))
    .filter((revision) => revision.initiativeId === initiativeId)
    .sort((left, right) => right.version - left.version);
}

export function getLatestRevisionForInitiative(
  initiativeId: string,
): InitiativeVersionRevision | null {
  const initiativeRevisions = listRevisionsByInitiative(initiativeId);

  return initiativeRevisions[0] ?? null;
}

export function getCurrentPublishedVersion(initiativeId: string): number {
  const latest = getLatestRevisionForInitiative(initiativeId);

  return latest?.version ?? 0;
}

export function createRevision(revision: InitiativeVersionRevision): InitiativeVersionRevision {
  revisions.set(revision.revisionId, structuredClone(revision));
  persistStore(revisions, drafts);

  return structuredClone(revision);
}

export function getRevisionDraftByInitiativeId(
  initiativeId: string,
): InitiativeRevisionDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertRevisionDraft(draft: InitiativeRevisionDraft): InitiativeRevisionDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistStore(revisions, drafts);

  return structuredClone(draft);
}

export function updateRevisionDraft(
  initiativeId: string,
  update: InitiativeRevisionDraftUpdate,
): InitiativeRevisionDraft | null {
  const draft = drafts.get(initiativeId);

  if (!draft) {
    return null;
  }

  if (update.title !== undefined) {
    draft.title = update.title;
  }

  if (update.description !== undefined) {
    draft.description = update.description;
  }

  if (update.metadata !== undefined) {
    Object.assign(draft.metadata, update.metadata);
  }

  if (update.revisionSummary !== undefined) {
    draft.revisionSummary = update.revisionSummary;
  }

  if (update.appliedProposalIds !== undefined) {
    draft.appliedProposalIds = [...update.appliedProposalIds];
  }

  if (update.skippedProposalIds !== undefined) {
    draft.skippedProposalIds = [...update.skippedProposalIds];
  }

  draft.updatedAt = new Date().toISOString();

  persistStore(revisions, drafts);

  return structuredClone(draft);
}

export function deleteRevisionDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistStore(revisions, drafts);
}

export function getRevisionByInitiativeAndVersion(
  initiativeId: string,
  version: number,
): InitiativeVersionRevision | null {
  const revision = listRevisionsByInitiative(initiativeId).find(
    (entry) => entry.version === version,
  );

  return revision ?? null;
}
