import type {
  InitiativeImplementationCommitment,
  InitiativeImplementationTrackingCommitmentReference,
  InitiativeImplementationTrackingConsistencyCheck,
  InitiativeImplementationTrackingIntelligenceSnapshot,
  InitiativeImplementationTrackingPackageReference,
} from "@hu/types";
import { hasAcceptedImplementationResponsibility } from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getPackageByInitiativeId as getCommitmentPackageByInitiativeId } from "../initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js";
import { listDecisionsByInitiative } from "../initiative-collective-decision/initiative-collective-decision.store.js";

function toCommitmentReference(
  commitment: InitiativeImplementationCommitment,
): InitiativeImplementationTrackingCommitmentReference {
  return {
    commitmentId: commitment.commitmentId,
    packageId: commitment.packageId ?? null,
    decisionId: commitment.decisionId,
    participantId: commitment.participantId,
    approvedAction: commitment.approvedAction ?? commitment.commitmentTitle,
    commitmentTitle: commitment.commitmentTitle,
    commitmentSummary: commitment.commitmentSummary,
    proposalStatus: commitment.proposalStatus ?? null,
    priority: commitment.priority ?? null,
    suggestedResponsibleRole: commitment.suggestedResponsibleRole ?? null,
    expectedCompletionDate: commitment.expectedCompletionDate ?? null,
    requiredResources: [...(commitment.requiredResources ?? [])],
    relatedRisks: [...(commitment.relatedRisks ?? [])],
    references: [...(commitment.references ?? [])],
    publishedAt: commitment.publishedAt ?? null,
  };
}

function resolveDecisionApprovedActions(initiativeId: string): string[] {
  const closed = listDecisionsByInitiative(initiativeId)
    .filter((decision) => decision.status === "closed")
    .sort((left, right) => (right.closedAt ?? right.updatedAt).localeCompare(left.closedAt ?? left.updatedAt));

  const latest = closed[0];
  if (!latest?.structuredContent?.approvedActions?.length) {
    return [];
  }

  return [...latest.structuredContent.approvedActions];
}

function buildConsistencyChecks(input: {
  packageReference: InitiativeImplementationTrackingPackageReference | null;
  acceptedCommitments: readonly InitiativeImplementationTrackingCommitmentReference[];
  decisionApprovedActions: readonly string[];
}): readonly InitiativeImplementationTrackingConsistencyCheck[] {
  const checks: InitiativeImplementationTrackingConsistencyCheck[] = [];

  checks.push(
    input.packageReference
      ? {
          checkId: "commitment-package-available",
          label: "Published Commitment Package",
          status: "ok",
          detail: `Implementation Commitments "${input.packageReference.title}" are available as Tracking source data.`,
          params: {},
          civic: { title: input.packageReference.title },
        }
      : {
          checkId: "commitment-package-available",
          label: "Published Commitment Package",
          status: "warning",
          detail:
            "No published Commitment Package yet — Tracking can still generate from Collective Decision / Initiative scope with Unassigned ownership.",
          params: {},
        },
  );

  checks.push(
    input.acceptedCommitments.length > 0
      ? {
          checkId: "accepted-commitments-available",
          label: "Accepted Commitments",
          status: "ok",
          detail: `${input.acceptedCommitments.length} Accepted Commitment(s) will populate assignees and context.`,
          params: { count: input.acceptedCommitments.length },
        }
      : {
          checkId: "accepted-commitments-available",
          label: "Accepted Commitments",
          status: "warning",
          detail:
            "No Accepted Commitments yet — plan milestones remain Unassigned / To be determined. Lifecycle does not block.",
          params: { count: 0 },
        },
  );

  checks.push(
    input.decisionApprovedActions.length > 0
      ? {
          checkId: "decision-actions-available",
          label: "Collective Decision Actions",
          status: "ok",
          detail: `${input.decisionApprovedActions.length} approved Decision action(s) available for automatic plan milestones.`,
          params: { count: input.decisionApprovedActions.length },
        }
      : {
          checkId: "decision-actions-available",
          label: "Collective Decision Actions",
          status: "warning",
          detail: "No closed Collective Decision approved actions found — Initiative scope will seed the plan.",
          params: { count: 0 },
        },
  );

  const withTimelines = input.acceptedCommitments.filter(
    (commitment) => commitment.expectedCompletionDate !== null,
  );
  checks.push(
    withTimelines.length > 0
      ? {
          checkId: "timelines-visible",
          label: "Timelines",
          status: "ok",
          detail: `${withTimelines.length} Accepted Commitment(s) carry an expected completion date.`,
          params: { count: withTimelines.length },
        }
      : {
          checkId: "timelines-visible",
          label: "Timelines",
          status: "warning",
          detail: "No expected completion dates from Accepted Commitments — Author sets target dates.",
          params: { count: 0 },
        },
  );

  return checks;
}

/**
 * Initiative Lifecycle — Part J, Section 2/9. Read-only aggregation for
 * Tracking plan generation. Accepted Commitments are preferred source data
 * but are NOT required — zero-commitment Author path remains open.
 */
export async function buildInitiativeImplementationTrackingIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeImplementationTrackingIntelligenceSnapshot> {
  const initiative = getInitiativeById(initiativeId);
  const commitmentPackage = getCommitmentPackageByInitiativeId(initiativeId);
  const commitments = listCommitmentsByInitiative(initiativeId);
  const acceptedCommitments = commitments
    .filter(
      (commitment) =>
        commitment.participantId != null &&
        hasAcceptedImplementationResponsibility(commitment, commitment.participantId),
    )
    .sort((left, right) => (left.actionIndex ?? 0) - (right.actionIndex ?? 0))
    .map((commitment) => toCommitmentReference(commitment));

  const packageReference: InitiativeImplementationTrackingPackageReference | null = commitmentPackage
    ? {
        packageId: commitmentPackage.packageId,
        decisionId: commitmentPackage.decisionId,
        title: commitmentPackage.title,
        summary: commitmentPackage.summary,
        publishedAt: commitmentPackage.publishedAt,
        commitmentIds: [...commitmentPackage.commitmentIds],
        acceptedCommitmentCount: acceptedCommitments.length,
      }
    : null;

  const decisionApprovedActions = resolveDecisionApprovedActions(initiativeId);

  let activeAllyCount = 0;
  try {
    activeAllyCount = (await listActiveAlliesByInitiative(initiativeId)).length;
  } catch {
    activeAllyCount = 0;
  }

  const consistencyChecks = buildConsistencyChecks({
    packageReference,
    acceptedCommitments,
    decisionApprovedActions,
  });
  const isCommitmentPackageAvailable = commitmentPackage !== null && acceptedCommitments.length > 0;

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    packageReference,
    acceptedCommitments,
    decisionApprovedActions,
    activeAllyCount,
    consistencyChecks,
    isCommitmentPackageAvailable,
    isEmpty: !initiative,
  };
}
