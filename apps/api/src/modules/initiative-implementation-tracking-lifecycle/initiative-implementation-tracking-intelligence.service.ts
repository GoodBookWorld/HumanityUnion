import type {
  InitiativeImplementationCommitment,
  InitiativeImplementationTrackingCommitmentReference,
  InitiativeImplementationTrackingConsistencyCheck,
  InitiativeImplementationTrackingIntelligenceSnapshot,
  InitiativeImplementationTrackingPackageReference,
} from "@hu/types";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { getPackageByInitiativeId as getCommitmentPackageByInitiativeId } from "../initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js";

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

function buildConsistencyChecks(input: {
  packageReference: InitiativeImplementationTrackingPackageReference | null;
  acceptedCommitments: readonly InitiativeImplementationTrackingCommitmentReference[];
}): readonly InitiativeImplementationTrackingConsistencyCheck[] {
  const checks: InitiativeImplementationTrackingConsistencyCheck[] = [];

  checks.push(
    input.packageReference
      ? {
          checkId: "commitment-package-available",
          label: "Published Commitment Package",
          status: "ok",
          detail: `Implementation Commitments "${input.packageReference.title}" are available as the Tracking source.`,
        }
      : {
          checkId: "commitment-package-available",
          label: "Published Commitment Package",
          status: "warning",
          detail: "A published Implementation Commitment Package is required before Implementation Tracking can be generated.",
        },
  );

  checks.push(
    input.acceptedCommitments.length > 0
      ? {
          checkId: "accepted-commitments-available",
          label: "Accepted Commitments",
          status: "ok",
          detail: `${input.acceptedCommitments.length} Accepted Commitment(s) are available from the Commitment Package.`,
        }
      : {
          checkId: "accepted-commitments-available",
          label: "Accepted Commitments",
          status: "warning",
          detail: "No Commitment has been Accepted by its proposed Participant yet.",
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
        }
      : {
          checkId: "timelines-visible",
          label: "Timelines",
          status: "warning",
          detail: "No Accepted Commitment carries an expected completion date yet.",
        },
  );

  const withResources = input.acceptedCommitments.filter(
    (commitment) => commitment.requiredResources.length > 0,
  );
  checks.push(
    withResources.length > 0
      ? {
          checkId: "resources-visible",
          label: "Required Resources",
          status: "ok",
          detail: `${withResources.length} Accepted Commitment(s) carry Required Resources.`,
        }
      : {
          checkId: "resources-visible",
          label: "Required Resources",
          status: "warning",
          detail: "No Accepted Commitment carries Required Resources yet.",
        },
  );

  const withRisks = input.acceptedCommitments.filter(
    (commitment) => commitment.relatedRisks.length > 0,
  );
  checks.push(
    withRisks.length > 0
      ? {
          checkId: "risks-visible",
          label: "Related Risks",
          status: "ok",
          detail: `${withRisks.length} Accepted Commitment(s) carry Related Risks to watch during Tracking.`,
        }
      : {
          checkId: "risks-visible",
          label: "Related Risks",
          status: "warning",
          detail: "No Accepted Commitment carries Related Risks yet.",
        },
  );

  return checks;
}

/**
 * Initiative Lifecycle — Part J, Section 2/9. Read-only aggregation of the
 * published Implementation Commitment Package (Part I) and its Accepted
 * Commitments — Tracking's one mandatory source unit. Never mutates a
 * Commitment and never itself makes an AI decision.
 */
export async function buildInitiativeImplementationTrackingIntelligenceSnapshot(
  initiativeId: string,
): Promise<InitiativeImplementationTrackingIntelligenceSnapshot> {
  // Mirror Implementation Commitment Intelligence: degrade gracefully when
  // the Initiative is not yet readable from the store.
  const initiative = getInitiativeById(initiativeId);
  const commitmentPackage = getCommitmentPackageByInitiativeId(initiativeId);
  const commitments = listCommitmentsByInitiative(initiativeId);
  const acceptedCommitments = commitments
    .filter((commitment) => commitment.proposalStatus === "accepted")
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

  let activeAllyCount = 0;
  try {
    activeAllyCount = (await listActiveAlliesByInitiative(initiativeId)).length;
  } catch {
    activeAllyCount = 0;
  }

  const consistencyChecks = buildConsistencyChecks({ packageReference, acceptedCommitments });
  const isCommitmentPackageAvailable = commitmentPackage !== null && acceptedCommitments.length > 0;

  return {
    initiativeId,
    generatedAt: new Date().toISOString(),
    initiativeTitle: initiative?.title ?? "",
    initiativeDescription: initiative?.description ?? "",
    packageReference,
    acceptedCommitments,
    activeAllyCount,
    consistencyChecks,
    isCommitmentPackageAvailable,
    isEmpty: !initiative || !isCommitmentPackageAvailable,
  };
}
