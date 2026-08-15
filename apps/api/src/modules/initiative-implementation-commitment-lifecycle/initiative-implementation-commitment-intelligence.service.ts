import type {
  InitiativeCollectiveDecision,
  InitiativeImplementationCommitmentConsistencyCheck,
  InitiativeImplementationCommitmentDecisionReference,
  InitiativeImplementationCommitmentIntelligenceSnapshot,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";

/**
 * Initiative Lifecycle — Part I, Section 2/9. Among every Collective
 * Decision recorded for this Initiative, the one mandatory source is the
 * latest CLOSED Collective Decision — preferring one that still carries its
 * structured Decision Result content (Part H), since a legacy/direct
 * Collective Decision record predating Part H may be `closed` without ever
 * having structured content attached.
 */
function selectPublishedDecision(initiativeId: string): InitiativeCollectiveDecision | null {
  const closed = listDecisionsByInitiative(initiativeId).filter(
    (decision) => decision.status === "closed",
  );

  if (closed.length === 0) {
    return null;
  }

  const sorted = [...closed].sort((left, right) => {
    const leftHasContent = left.structuredContent ? 1 : 0;
    const rightHasContent = right.structuredContent ? 1 : 0;

    if (leftHasContent !== rightHasContent) {
      return rightHasContent - leftHasContent;
    }

    return right.sequenceNumber - left.sequenceNumber;
  });

  return sorted[0] ?? null;
}

function buildDecisionReference(
  decision: InitiativeCollectiveDecision,
): InitiativeImplementationCommitmentDecisionReference {
  const structured = decision.structuredContent;
  const traceability = decision.traceability;

  return {
    decisionId: decision.decisionId,
    question: decision.question,
    sequenceNumber: decision.sequenceNumber,
    closedAt: decision.closedAt ?? null,
    title: structured?.title ?? decision.question,
    decisionSummary: structured?.decisionSummary ?? "",
    approvedActions: structured?.approvedActions ?? [],
    rejectedAlternatives: structured?.rejectedAlternatives ?? [],
    responsibleRoles: structured?.responsibleRoles ?? [],
    implementationPriorities: structured?.implementationPriorities ?? [],
    implementationTimeline: structured?.implementationTimeline ?? "",
    decisionRisks: structured?.decisionRisks ?? [],
    successCriteria: structured?.successCriteria ?? [],
    requiredResources: structured?.requiredResources ?? [],
    supportingReferences: structured?.supportingReferences ?? [],
    decisionSessionId: traceability?.decisionSessionId ?? decision.decisionSessionId ?? null,
    decisionSessionVersion: traceability?.decisionSessionVersion ?? null,
    petitionId: traceability?.petitionId ?? null,
    petitionVersion: traceability?.petitionVersion ?? null,
    revisionId: traceability?.revisionId ?? null,
    revisionVersion: traceability?.revisionVersion ?? null,
    analysisId: traceability?.analysisId ?? null,
    analysisVersion: traceability?.analysisVersion ?? null,
    proposalIds: traceability?.proposalIds ?? [],
    participantSignatures: traceability?.participantSignatures ?? 0,
    memberSignatures: traceability?.memberSignatures ?? 0,
    visitorSignals: traceability?.visitorSignals ?? 0,
  };
}

function buildConsistencyChecks(
  decisionReference: InitiativeImplementationCommitmentDecisionReference | null,
): readonly InitiativeImplementationCommitmentConsistencyCheck[] {
  const checks: InitiativeImplementationCommitmentConsistencyCheck[] = [];

  checks.push(
    decisionReference
      ? {
          checkId: "collective-decision-available",
          label: "Published Collective Decision",
          status: "ok",
          detail: `Collective Decision "${decisionReference.title}" is available as the Implementation Commitment source.`,
        }
      : {
          checkId: "collective-decision-available",
          label: "Published Collective Decision",
          status: "warning",
          detail: "A published (closed) Collective Decision is required before Implementation Commitments can be generated.",
        },
  );

  checks.push(
    decisionReference && decisionReference.approvedActions.length > 0
      ? {
          checkId: "approved-actions-available",
          label: "Approved Actions",
          status: "ok",
          detail: `${decisionReference.approvedActions.length} Approved Action(s) are available from the Collective Decision.`,
        }
      : {
          checkId: "approved-actions-available",
          label: "Approved Actions",
          status: "warning",
          detail: "The Collective Decision has no Approved Actions recorded.",
        },
  );

  checks.push(
    decisionReference && decisionReference.responsibleRoles.length > 0
      ? {
          checkId: "roles-available",
          label: "Responsible Roles",
          status: "ok",
          detail: `${decisionReference.responsibleRoles.length} suggested role(s) carried over from the Collective Decision.`,
        }
      : {
          checkId: "roles-available",
          label: "Responsible Roles",
          status: "warning",
          detail: "The Collective Decision has no Responsible Roles recorded.",
        },
  );

  checks.push(
    decisionReference && decisionReference.implementationTimeline.trim().length > 0
      ? {
          checkId: "timeline-available",
          label: "Implementation Timeline",
          status: "ok",
          detail: "An Implementation Timeline is available from the Collective Decision.",
        }
      : {
          checkId: "timeline-available",
          label: "Implementation Timeline",
          status: "warning",
          detail: "The Collective Decision has no Implementation Timeline recorded.",
        },
  );

  checks.push(
    decisionReference && decisionReference.decisionRisks.length > 0
      ? {
          checkId: "risks-available",
          label: "Decision Risks",
          status: "ok",
          detail: `${decisionReference.decisionRisks.length} risk(s) carried over from the Collective Decision.`,
        }
      : {
          checkId: "risks-available",
          label: "Decision Risks",
          status: "warning",
          detail: "The Collective Decision has no Decision Risks recorded.",
        },
  );

  checks.push(
    decisionReference && decisionReference.successCriteria.length > 0
      ? {
          checkId: "success-criteria-available",
          label: "Success Criteria",
          status: "ok",
          detail: `${decisionReference.successCriteria.length} Success Criterion(s) carried over from the Collective Decision.`,
        }
      : {
          checkId: "success-criteria-available",
          label: "Success Criteria",
          status: "warning",
          detail: "The Collective Decision has no Success Criteria recorded.",
        },
  );

  return checks;
}

/**
 * Initiative Lifecycle — Part I, Section 2/3. Deterministic, read-only
 * aggregation of the published (closed) Collective Decision — the stage's
 * one mandatory source — plus the Initiative's Active Ally count. Never
 * mutates the Collective Decision and never itself makes an AI decision.
 */
export async function buildInitiativeImplementationCommitmentIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeImplementationCommitmentIntelligenceSnapshot> {
  // Mirror Collective Decision Intelligence: degrade gracefully when the
  // Initiative is not yet readable from the store.
  const initiative = getInitiativeById(initiativeId);
  const decision = selectPublishedDecision(initiativeId);
  const decisionReference = decision ? buildDecisionReference(decision) : null;

  let activeAllyCount = 0;
  try {
    activeAllyCount = (await listActiveAlliesByInitiative(initiativeId)).length;
  } catch {
    activeAllyCount = 0;
  }

  const consistencyChecks = buildConsistencyChecks(decisionReference);

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    decisionReference,
    activeAllyCount,
    consistencyChecks,
    isCollectiveDecisionAvailable: decisionReference !== null,
    isEmpty: !initiative || !decisionReference,
  };
}
