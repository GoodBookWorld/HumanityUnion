import type { InitiativeCollectiveDecisionLifecycleDraft, ParticipationScope } from "@hu/types";

import { resolveInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter } from "./persistence/resolve-initiative-collective-decision-lifecycle-draft-persistence.js";
import { snapshotFromInitiativeCollectiveDecisionLifecycleDrafts } from "./persistence/initiative-collective-decision-lifecycle-draft-persistence.types.js";

export interface InitiativeCollectiveDecisionLifecycleDraftUpdate {
  title?: string;
  decisionSummary?: string;
  approvedActions?: string[];
  rejectedAlternatives?: string[];
  responsibleRoles?: string[];
  implementationPriorities?: string[];
  implementationTimeline?: string;
  decisionRationale?: string;
  decisionRisks?: string[];
  successCriteria?: string[];
  requiredResources?: string[];
  supportingReferences?: string[];
  participationScope?: ParticipationScope;
  closesAt?: string;
  decisionSessionId?: string | null;
  decisionSessionVersion?: number | null;
  petitionId?: string | null;
  petitionVersion?: number | null;
  revisionId?: string | null;
  revisionVersion?: number | null;
  analysisId?: string | null;
  analysisVersion?: number | null;
  proposalIds?: string[];
}

const persistence = resolveInitiativeCollectiveDecisionLifecycleDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativeCollectiveDecisionLifecycleDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeCollectiveDecisionLifecycleDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      structuredClone(draft),
    ]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativeCollectiveDecisionLifecycleDraft>): void {
  persistence.save(snapshotFromInitiativeCollectiveDecisionLifecycleDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId(
  initiativeId: string,
): InitiativeCollectiveDecisionLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativeCollectiveDecisionLifecycleDraft(
  draft: InitiativeCollectiveDecisionLifecycleDraft,
): InitiativeCollectiveDecisionLifecycleDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativeCollectiveDecisionLifecycleDraft(
  initiativeId: string,
  update: InitiativeCollectiveDecisionLifecycleDraftUpdate,
): InitiativeCollectiveDecisionLifecycleDraft | null {
  const draft = drafts.get(initiativeId);

  if (!draft) {
    return null;
  }

  if (update.title !== undefined) {
    draft.title = update.title;
  }
  if (update.decisionSummary !== undefined) {
    draft.decisionSummary = update.decisionSummary;
  }
  if (update.approvedActions !== undefined) {
    draft.approvedActions = [...update.approvedActions];
  }
  if (update.rejectedAlternatives !== undefined) {
    draft.rejectedAlternatives = [...update.rejectedAlternatives];
  }
  if (update.responsibleRoles !== undefined) {
    draft.responsibleRoles = [...update.responsibleRoles];
  }
  if (update.implementationPriorities !== undefined) {
    draft.implementationPriorities = [...update.implementationPriorities];
  }
  if (update.implementationTimeline !== undefined) {
    draft.implementationTimeline = update.implementationTimeline;
  }
  if (update.decisionRationale !== undefined) {
    draft.decisionRationale = update.decisionRationale;
  }
  if (update.decisionRisks !== undefined) {
    draft.decisionRisks = [...update.decisionRisks];
  }
  if (update.successCriteria !== undefined) {
    draft.successCriteria = [...update.successCriteria];
  }
  if (update.requiredResources !== undefined) {
    draft.requiredResources = [...update.requiredResources];
  }
  if (update.supportingReferences !== undefined) {
    draft.supportingReferences = [...update.supportingReferences];
  }
  if (update.participationScope !== undefined) {
    draft.participationScope = update.participationScope;
  }
  if (update.closesAt !== undefined) {
    draft.closesAt = update.closesAt;
  }
  if (update.decisionSessionId !== undefined) {
    draft.decisionSessionId = update.decisionSessionId;
  }
  if (update.decisionSessionVersion !== undefined) {
    draft.decisionSessionVersion = update.decisionSessionVersion;
  }
  if (update.petitionId !== undefined) {
    draft.petitionId = update.petitionId;
  }
  if (update.petitionVersion !== undefined) {
    draft.petitionVersion = update.petitionVersion;
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

export function deleteInitiativeCollectiveDecisionLifecycleDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
