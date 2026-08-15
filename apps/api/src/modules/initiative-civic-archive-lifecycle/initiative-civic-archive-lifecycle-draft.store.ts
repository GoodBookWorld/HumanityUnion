import type {
  InitiativeCivicArchiveCompleteness,
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeCivicArchiveParticipationStatistics,
  InitiativeCivicArchiveSection,
  InitiativeCivicArchiveTimelineEntry,
} from "@hu/types";

import { resolveInitiativeCivicArchiveLifecycleDraftPersistenceAdapter } from "./persistence/resolve-initiative-civic-archive-lifecycle-draft-persistence.js";
import { snapshotFromInitiativeCivicArchiveLifecycleDrafts } from "./persistence/initiative-civic-archive-lifecycle-draft-persistence.types.js";

export interface InitiativeCivicArchiveLifecycleDraftUpdate {
  finalArchiveTitle?: string;
  finalSummary?: string;
  lessonsLearned?: string;
  knowledgeContribution?: string;
  publicImpactReportId?: string | null;
  sections?: InitiativeCivicArchiveSection[];
  timeline?: InitiativeCivicArchiveTimelineEntry[];
  completeness?: InitiativeCivicArchiveCompleteness;
  participationStatistics?: InitiativeCivicArchiveParticipationStatistics;
}

const persistence = resolveInitiativeCivicArchiveLifecycleDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativeCivicArchiveLifecycleDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeCivicArchiveLifecycleDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      structuredClone(draft),
    ]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativeCivicArchiveLifecycleDraft>): void {
  persistence.save(snapshotFromInitiativeCivicArchiveLifecycleDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativeCivicArchiveLifecycleDraftByInitiativeId(
  initiativeId: string,
): InitiativeCivicArchiveLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativeCivicArchiveLifecycleDraft(
  draft: InitiativeCivicArchiveLifecycleDraft,
): InitiativeCivicArchiveLifecycleDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativeCivicArchiveLifecycleDraft(
  initiativeId: string,
  update: InitiativeCivicArchiveLifecycleDraftUpdate,
): InitiativeCivicArchiveLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  if (!draft) {
    return null;
  }

  if (update.finalArchiveTitle !== undefined) {
    draft.finalArchiveTitle = update.finalArchiveTitle;
  }
  if (update.finalSummary !== undefined) {
    draft.finalSummary = update.finalSummary;
  }
  if (update.lessonsLearned !== undefined) {
    draft.lessonsLearned = update.lessonsLearned;
  }
  if (update.knowledgeContribution !== undefined) {
    draft.knowledgeContribution = update.knowledgeContribution;
  }
  if (update.publicImpactReportId !== undefined) {
    draft.publicImpactReportId = update.publicImpactReportId;
  }
  if (update.sections !== undefined) {
    draft.sections = update.sections.map((section) => structuredClone(section));
  }
  if (update.timeline !== undefined) {
    draft.timeline = update.timeline.map((entry) => structuredClone(entry));
  }
  if (update.completeness !== undefined) {
    draft.completeness = structuredClone(update.completeness);
  }
  if (update.participationStatistics !== undefined) {
    draft.participationStatistics = structuredClone(update.participationStatistics);
  }

  draft.updatedAt = new Date().toISOString();
  drafts.set(initiativeId, draft);
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function deleteInitiativeCivicArchiveLifecycleDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
