import type {
  InitiativePublicImpactLifecycleDraft,
  InitiativePublicImpactParticipationStatistics,
  InitiativePublicImpactReportSection,
} from "@hu/types";

import { resolveInitiativePublicImpactLifecycleDraftPersistenceAdapter } from "./persistence/resolve-initiative-public-impact-lifecycle-draft-persistence.js";
import { snapshotFromInitiativePublicImpactLifecycleDrafts } from "./persistence/initiative-public-impact-lifecycle-draft-persistence.types.js";

export interface InitiativePublicImpactLifecycleDraftUpdate {
  title?: string;
  officialResponsePackageId?: string | null;
  trackingPackageId?: string | null;
  commitmentPackageId?: string | null;
  decisionId?: string | null;
  sections?: InitiativePublicImpactReportSection[];
  participationStatistics?: InitiativePublicImpactParticipationStatistics;
}

const persistence = resolveInitiativePublicImpactLifecycleDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativePublicImpactLifecycleDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativePublicImpactLifecycleDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      structuredClone(draft),
    ]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativePublicImpactLifecycleDraft>): void {
  persistence.save(snapshotFromInitiativePublicImpactLifecycleDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativePublicImpactLifecycleDraftByInitiativeId(
  initiativeId: string,
): InitiativePublicImpactLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativePublicImpactLifecycleDraft(
  draft: InitiativePublicImpactLifecycleDraft,
): InitiativePublicImpactLifecycleDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativePublicImpactLifecycleDraft(
  initiativeId: string,
  update: InitiativePublicImpactLifecycleDraftUpdate,
): InitiativePublicImpactLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  if (!draft) {
    return null;
  }

  if (update.title !== undefined) {
    draft.title = update.title;
  }
  if (update.officialResponsePackageId !== undefined) {
    draft.officialResponsePackageId = update.officialResponsePackageId;
  }
  if (update.trackingPackageId !== undefined) {
    draft.trackingPackageId = update.trackingPackageId;
  }
  if (update.commitmentPackageId !== undefined) {
    draft.commitmentPackageId = update.commitmentPackageId;
  }
  if (update.decisionId !== undefined) {
    draft.decisionId = update.decisionId;
  }
  if (update.sections !== undefined) {
    draft.sections = update.sections.map((section) => structuredClone(section));
  }
  if (update.participationStatistics !== undefined) {
    draft.participationStatistics = structuredClone(update.participationStatistics);
  }

  draft.updatedAt = new Date().toISOString();
  drafts.set(initiativeId, draft);
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function deleteInitiativePublicImpactLifecycleDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
