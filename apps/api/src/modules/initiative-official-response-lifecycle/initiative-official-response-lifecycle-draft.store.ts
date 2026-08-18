import type {
  InitiativeOfficialResponseCandidate,
  InitiativeOfficialResponseLifecycleDraft,
  InitiativeOfficialResponseNoResponseDetail,
  InitiativeOfficialResponseOutcomeKind,
} from "@hu/types";

import {
  emptyOfficialResponseNoResponseDetail,
  normalizeOfficialResponseOutcomeKind,
} from "./initiative-official-response-outcome.js";
import { resolveInitiativeOfficialResponseLifecycleDraftPersistenceAdapter } from "./persistence/resolve-initiative-official-response-lifecycle-draft-persistence.js";
import { snapshotFromInitiativeOfficialResponseLifecycleDrafts } from "./persistence/initiative-official-response-lifecycle-draft-persistence.types.js";

export interface InitiativeOfficialResponseLifecycleDraftUpdate {
  title?: string;
  summary?: string;
  trackingPackageId?: string | null;
  outcomeKind?: InitiativeOfficialResponseOutcomeKind;
  noResponseDetail?: InitiativeOfficialResponseNoResponseDetail;
  candidates?: InitiativeOfficialResponseCandidate[];
}

const persistence = resolveInitiativeOfficialResponseLifecycleDraftPersistenceAdapter();

function normalizeDraft(
  draft: InitiativeOfficialResponseLifecycleDraft,
): InitiativeOfficialResponseLifecycleDraft {
  return {
    ...draft,
    outcomeKind: normalizeOfficialResponseOutcomeKind(draft.outcomeKind, draft.candidates.length),
    noResponseDetail: draft.noResponseDetail
      ? {
          contactedOrganizations: [...draft.noResponseDetail.contactedOrganizations],
          contactedDates: [...draft.noResponseDetail.contactedDates],
          note: draft.noResponseDetail.note,
        }
      : emptyOfficialResponseNoResponseDetail(),
    candidates: draft.candidates.map((candidate) => structuredClone(candidate)),
  };
}

function loadDraftsMap(): Map<string, InitiativeOfficialResponseLifecycleDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeOfficialResponseLifecycleDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      normalizeDraft(structuredClone(draft)),
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

  return draft ? normalizeDraft(structuredClone(draft)) : null;
}

export function upsertInitiativeOfficialResponseLifecycleDraft(
  draft: InitiativeOfficialResponseLifecycleDraft,
): InitiativeOfficialResponseLifecycleDraft {
  const normalized = normalizeDraft(draft);
  drafts.set(normalized.initiativeId, structuredClone(normalized));
  persistDraftsMap(drafts);

  return structuredClone(normalized);
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
  if (update.outcomeKind !== undefined) {
    draft.outcomeKind = update.outcomeKind;
  }
  if (update.noResponseDetail !== undefined) {
    draft.noResponseDetail = {
      contactedOrganizations: [...update.noResponseDetail.contactedOrganizations],
      contactedDates: [...update.noResponseDetail.contactedDates],
      note: update.noResponseDetail.note,
    };
  }
  if (update.candidates !== undefined) {
    draft.candidates = update.candidates.map((candidate) => structuredClone(candidate));
  }

  draft.updatedAt = new Date().toISOString();
  const normalized = normalizeDraft(draft);
  drafts.set(initiativeId, normalized);
  persistDraftsMap(drafts);

  return structuredClone(normalized);
}

export function deleteInitiativeOfficialResponseLifecycleDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
