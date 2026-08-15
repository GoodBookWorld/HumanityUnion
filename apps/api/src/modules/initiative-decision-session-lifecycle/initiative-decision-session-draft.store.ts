import type { InitiativeDecisionSessionDraft } from "@hu/types";

import { resolveInitiativeDecisionSessionDraftPersistenceAdapter } from "./persistence/resolve-initiative-decision-session-draft-persistence.js";
import { snapshotFromInitiativeDecisionSessionDrafts } from "./persistence/initiative-decision-session-draft-persistence.types.js";

export interface InitiativeDecisionSessionDraftUpdate {
  title?: string;
  decisionQuestion?: string;
  decisionContext?: string;
  objectives?: string[];
  options?: string[];
  supportingArguments?: string[];
  risks?: string[];
  dependencies?: string[];
  requiredResources?: string[];
  suggestedTimeline?: string;
  suggestedParticipants?: string[];
  suggestedResponsibleRoles?: string[];
  unresolvedQuestions?: string[];
  purpose?: string;
  opensAt?: string;
  closesAt?: string;
  petitionId?: string | null;
  revisionId?: string | null;
  revisionVersion?: number | null;
  analysisId?: string | null;
  analysisVersion?: number | null;
  proposalIds?: string[];
}

const persistence = resolveInitiativeDecisionSessionDraftPersistenceAdapter();

function loadDraftsMap(): Map<string, InitiativeDecisionSessionDraft> {
  const snapshot = persistence.load();

  return new Map<string, InitiativeDecisionSessionDraft>(
    Object.entries(snapshot.drafts).map(([initiativeId, draft]) => [
      initiativeId,
      structuredClone(draft),
    ]),
  );
}

function persistDraftsMap(drafts: Map<string, InitiativeDecisionSessionDraft>): void {
  persistence.save(snapshotFromInitiativeDecisionSessionDrafts(drafts));
}

const drafts = loadDraftsMap();

export function getInitiativeDecisionSessionDraftByInitiativeId(
  initiativeId: string,
): InitiativeDecisionSessionDraft | null {
  const draft = drafts.get(initiativeId);

  return draft ? structuredClone(draft) : null;
}

export function upsertInitiativeDecisionSessionDraft(
  draft: InitiativeDecisionSessionDraft,
): InitiativeDecisionSessionDraft {
  drafts.set(draft.initiativeId, structuredClone(draft));
  persistDraftsMap(drafts);

  return structuredClone(draft);
}

export function updateInitiativeDecisionSessionDraft(
  initiativeId: string,
  update: InitiativeDecisionSessionDraftUpdate,
): InitiativeDecisionSessionDraft | null {
  const draft = drafts.get(initiativeId);

  if (!draft) {
    return null;
  }

  if (update.title !== undefined) {
    draft.title = update.title;
  }
  if (update.decisionQuestion !== undefined) {
    draft.decisionQuestion = update.decisionQuestion;
  }
  if (update.decisionContext !== undefined) {
    draft.decisionContext = update.decisionContext;
  }
  if (update.suggestedTimeline !== undefined) {
    draft.suggestedTimeline = update.suggestedTimeline;
  }
  if (update.purpose !== undefined) {
    draft.purpose = update.purpose;
  }
  if (update.opensAt !== undefined) {
    draft.opensAt = update.opensAt;
  }
  if (update.closesAt !== undefined) {
    draft.closesAt = update.closesAt;
  }
  if (update.objectives !== undefined) {
    draft.objectives = [...update.objectives];
  }
  if (update.options !== undefined) {
    draft.options = [...update.options];
  }
  if (update.supportingArguments !== undefined) {
    draft.supportingArguments = [...update.supportingArguments];
  }
  if (update.risks !== undefined) {
    draft.risks = [...update.risks];
  }
  if (update.dependencies !== undefined) {
    draft.dependencies = [...update.dependencies];
  }
  if (update.requiredResources !== undefined) {
    draft.requiredResources = [...update.requiredResources];
  }
  if (update.suggestedParticipants !== undefined) {
    draft.suggestedParticipants = [...update.suggestedParticipants];
  }
  if (update.suggestedResponsibleRoles !== undefined) {
    draft.suggestedResponsibleRoles = [...update.suggestedResponsibleRoles];
  }
  if (update.unresolvedQuestions !== undefined) {
    draft.unresolvedQuestions = [...update.unresolvedQuestions];
  }
  if (update.petitionId !== undefined) {
    draft.petitionId = update.petitionId;
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

export function deleteInitiativeDecisionSessionDraft(initiativeId: string): void {
  drafts.delete(initiativeId);
  persistDraftsMap(drafts);
}
