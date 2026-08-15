import type {
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseLifecycleDraft,
} from "@hu/types";

import { resolveInitiativeOfficialResponseLifecycleDraftPersistenceAdapter } from "./persistence/resolve-initiative-official-response-lifecycle-draft-persistence.js";
import { snapshotFromInitiativeOfficialResponseLifecycleDrafts } from "./persistence/initiative-official-response-lifecycle-draft-persistence.types.js";

export interface InitiativeOfficialResponseLifecycleDraftUpdate {
  title?: string;
  summary?: string;
  trackingPackageId?: string | null;
  candidates?: InitiativeOfficialResponseCandidate[];
}

const persistence = resolveInitiativeOfficialResponseLifecycleDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativeOfficialResponseLifecycleDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeOfficialResponseLifecycleDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      structuredClone(draft),
    ]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativeOfficialResponseLifecycleDraft>): void {
  persistence.save(snapshotFromInitiativeOfficialResponseLifecycleDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativeOfficialResponseLifecycleDraftByInitiativeId(
  initiativeId: string,
): InitiativeOfficialResponseLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativeOfficialResponseLifecycleDraft(
  draft: InitiativeOfficialResponseLifecycleDraft,
): InitiativeOfficialResponseLifecycleDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativeOfficialResponseLifecycleDraft(
  initiativeId: string,
  update: InitiativeOfficialResponseLifecycleDraftUpdate,
): InitiativeOfficialResponseLifecycleDraft | null {
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
  if (update.trackingPackageId !== undefined) {
    draft.trackingPackageId = update.trackingPackageId;
  }
  if (update.candidates !== undefined) {
    draft.candidates = update.candidates.map((candidate) => structuredClone(candidate));
  }

  draft.updatedAt = new Date().toISOString();
  drafts.set(initiativeId, draft);
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function deleteInitiativeOfficialResponseLifecycleDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
