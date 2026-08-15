import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingLifecycleDraft,
} from "@hu/types";

import { resolveInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter } from "./persistence/resolve-initiative-implementation-tracking-lifecycle-draft-persistence.js";
import { snapshotFromInitiativeImplementationTrackingLifecycleDrafts } from "./persistence/initiative-implementation-tracking-lifecycle-draft-persistence.types.js";

export interface InitiativeImplementationTrackingLifecycleDraftUpdate {
  title?: string;
  summary?: string;
  packageId?: string | null;
  candidates?: InitiativeImplementationTrackingCandidate[];
}

const persistence = resolveInitiativeImplementationTrackingLifecycleDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativeImplementationTrackingLifecycleDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeImplementationTrackingLifecycleDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      structuredClone(draft),
    ]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativeImplementationTrackingLifecycleDraft>): void {
  persistence.save(snapshotFromInitiativeImplementationTrackingLifecycleDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(
  initiativeId: string,
): InitiativeImplementationTrackingLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativeImplementationTrackingLifecycleDraft(
  draft: InitiativeImplementationTrackingLifecycleDraft,
): InitiativeImplementationTrackingLifecycleDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativeImplementationTrackingLifecycleDraft(
  initiativeId: string,
  update: InitiativeImplementationTrackingLifecycleDraftUpdate,
): InitiativeImplementationTrackingLifecycleDraft | null {
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
  if (update.packageId !== undefined) {
    draft.packageId = update.packageId;
  }
  if (update.candidates !== undefined) {
    draft.candidates = update.candidates.map((candidate) => structuredClone(candidate));
  }

  draft.updatedAt = new Date().toISOString();
  drafts.set(initiativeId, draft);
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function deleteInitiativeImplementationTrackingLifecycleDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
