import type {
  CollectiveDecision,
  ImplementationCommitment,
  Initiative,
  Petition,
  PublicCollectiveDecisionReference,
  PublicCommunityCapacityProjection,
  PublicCommunityNeedProjection,
  PublicFrozenPolicySummary,
  PublicHumanityAssistantPanel,
  PublicImplementationCommitmentIdentity,
  PublicImplementationCommitmentProjection,
  PublicImplementationCommitmentShareReference,
  PublicImplementationReadinessProjection,
  PublicInitiativeContext,
  PublicPetitionReference,
  PublicRegistrationGatewayGuidance,
} from "@hu/types";

import { getDecision } from "../collective-decision/collective-decision.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getPetition } from "../petition/petition.store.js";
import { getFrozenPolicy } from "./frozen-policy.fixture.js";
import { buildPublicSkillCoverageSummary } from "./implementation-commitment.helpers.js";

const VIEWING_NOTE = "Viewing this page does not record a commitment declaration.";
const SHARING_NOTE =
  "Sharing increases visibility but does not record preparedness or assign work.";
const NOT_APPROVAL_STATEMENT =
  "Implementation Readiness is not approval of the Collective Decision and does not authorize bypass of governance.";
const DERIVED_VALUE_NOTE = "This value is derived from aggregate declarations and Frozen Policy.";

function getCollectionStatusSummary(status: ImplementationCommitment["status"]): string {
  switch (status) {
    case "Draft":
      return "Preparing commitment collection";
    case "Submitted":
      return "Submitted — awaiting activation";
    case "Active":
      return "Active — accepting declarations";
    case "Withdrawn":
      return "Commitment phase withdrawn";
    case "Completed":
      return "Commitment collection completed";
    case "Archived":
      return "Archived historical record";
    default:
      return status;
  }
}

function isPubliclyVisible(status: ImplementationCommitment["status"]): boolean {
  return status !== "Draft";
}

function buildCommitmentIdentity(
  commitment: ImplementationCommitment,
): PublicImplementationCommitmentIdentity {
  return {
    implementationCommitmentId: commitment.implementationCommitmentId,
    title: commitment.subjectTitle,
    lifecycleStatus: commitment.status,
    collectionStatusSummary: getCollectionStatusSummary(commitment.status),
  };
}

function buildInitiativeContext(
  commitment: ImplementationCommitment,
  initiative: Initiative | null,
): PublicInitiativeContext {
  return {
    initiativeId: commitment.initiativeId,
    title: initiative?.title ?? commitment.subjectTitle,
    summary: initiative?.description ?? commitment.subjectSummary,
  };
}

function buildApprovedResultSummary(decision: CollectiveDecision | null): string | null {
  if (!decision?.decisionResult?.winningOptionId) {
    return null;
  }

  const winningOption = decision.ballot.options.find(
    (option) => option.optionId === decision.decisionResult?.winningOptionId,
  );

  return winningOption?.label ?? null;
}

function buildCollectiveDecisionReference(
  commitment: ImplementationCommitment,
  decision: CollectiveDecision | null,
): PublicCollectiveDecisionReference {
  const decisionSummary = decision?.ballot.question ?? null;
  const approvedOutcomeSummary = decision?.outcome?.explanation ?? null;
  const approvedResultSummary = buildApprovedResultSummary(decision);

  return {
    collectiveDecisionId: commitment.collectiveDecisionId,
    decisionSummary,
    approvedOutcomeSummary,
    approvedResultSummary,
    contextAvailable: Boolean(decisionSummary || approvedOutcomeSummary || approvedResultSummary),
  };
}

function buildPetitionReference(
  commitment: ImplementationCommitment,
  petition: Petition | null,
): PublicPetitionReference {
  return {
    petitionId: commitment.petitionId,
    summaryStatement: petition?.subject.summary ?? commitment.subjectSummary,
    endorsementContextNote:
      "Public Petition endorsement expresses support. It is separate from declared implementation preparedness.",
    contextAvailable: petition !== null,
  };
}

function buildCommunityCapacity(
  commitment: ImplementationCommitment,
): PublicCommunityCapacityProjection {
  const { communityCapacity } = commitment;
  const policy = getFrozenPolicy(commitment.frozenPolicyId);

  return {
    totalContributions: communityCapacity.totalContributions,
    volunteers: communityCapacity.contributionsByType.Volunteer,
    professionalCapacity: communityCapacity.contributionsByType.Professional,
    resources: communityCapacity.contributionsByType.Resource,
    availabilitySummary: communityCapacity.aggregateAvailabilitySummary,
    skillCoverageSummary: policy
      ? buildPublicSkillCoverageSummary(commitment, policy)
      : "No skill coverage recorded.",
    derivedAt: communityCapacity.derivedAt,
    derivedValueNote: DERIVED_VALUE_NOTE,
  };
}

function buildFrozenPolicySummary(commitment: ImplementationCommitment): PublicFrozenPolicySummary {
  const policy = getFrozenPolicy(commitment.frozenPolicyId);
  const requiredThresholdLabels =
    policy?.thresholds
      .filter((threshold) => !threshold.optional)
      .map((threshold) => threshold.description) ?? [];
  const optionalThresholdLabels =
    policy?.thresholds
      .filter((threshold) => threshold.optional)
      .map((threshold) => threshold.description) ?? [];

  return {
    frozenPolicyId: commitment.frozenPolicyId,
    label: policy?.label ?? "Implementation Commitment Policy",
    summaryStatement:
      "Frozen Policy defines readiness thresholds for this commitment context. Internal policy mechanics are not exposed publicly.",
    requiredThresholdLabels,
    optionalThresholdLabels,
  };
}

function buildImplementationReadiness(
  commitment: ImplementationCommitment,
): PublicImplementationReadinessProjection {
  const { implementationReadiness } = commitment;

  return {
    readinessReached: implementationReadiness.readinessReached,
    explanation: implementationReadiness.explanation,
    satisfiedThresholdCount: implementationReadiness.satisfiedThresholds.length,
    unsatisfiedThresholdCount: implementationReadiness.unsatisfiedThresholds.length,
    notApprovalStatement: NOT_APPROVAL_STATEMENT,
    derivedAt: implementationReadiness.derivedAt,
    derivedValueNote: DERIVED_VALUE_NOTE,
  };
}

function buildCommunityNeeds(
  commitment: ImplementationCommitment,
): PublicCommunityNeedProjection[] {
  const policy = getFrozenPolicy(commitment.frozenPolicyId);

  if (!policy) {
    return [];
  }

  return commitment.implementationReadiness.unsatisfiedThresholds
    .map((thresholdId) =>
      policy.thresholds.find((threshold) => threshold.thresholdId === thresholdId),
    )
    .filter((threshold) => threshold && !threshold.optional)
    .map((threshold) => ({
      description: threshold!.description,
    }));
}

function buildShareReference(
  commitment: ImplementationCommitment,
): PublicImplementationCommitmentShareReference {
  const available = isPubliclyVisible(commitment.status) || commitment.status === "Draft";

  return {
    url: available
      ? `/implementation-commitments/public/${commitment.implementationCommitmentId}`
      : null,
    available,
    sharingNote: SHARING_NOTE,
  };
}

function buildRegistrationGateway(
  commitment: ImplementationCommitment,
): PublicRegistrationGatewayGuidance {
  const observationAvailable = true;
  const declarationAvailable = commitment.status === "Active";

  let entryIntent = "Observe this public readiness record.";
  let registrationGatewayMessage =
    "You may read and share this page without registration. Registration is required before a commitment declaration can be recorded.";

  if (declarationAvailable) {
    entryIntent =
      "Register to continue toward declaring preparedness in the Implementation Commitment Workspace when you choose to.";
    registrationGatewayMessage =
      "Registration is required before your declaration can be recorded. After registration, continue in the operational workspace if you choose to declare capacity.";
  } else if (commitment.status === "Draft" || commitment.status === "Submitted") {
    entryIntent = "Observe and share while commitment collection prepares or awaits activation.";
    registrationGatewayMessage =
      "You may observe and share without registration. Declaration becomes available after activation in the operational workspace.";
  } else if (
    commitment.status === "Completed" ||
    commitment.status === "Withdrawn" ||
    commitment.status === "Archived"
  ) {
    entryIntent = "Review the public commitment phase record.";
    registrationGatewayMessage =
      "This commitment phase is no longer accepting declarations. The public record remains available for observation and sharing.";
  }

  return {
    registrationRequired: true,
    declarationAvailable,
    observationAvailable,
    entryIntent,
    registrationGatewayMessage,
    viewingNote: VIEWING_NOTE,
    sharingNote: SHARING_NOTE,
    workspacePath: `/implementation-commitments/${commitment.implementationCommitmentId}`,
  };
}

function buildHumanityAssistantPanel(
  commitment: ImplementationCommitment,
  needs: PublicCommunityNeedProjection[],
  readiness: PublicImplementationReadinessProjection,
  policy: PublicFrozenPolicySummary,
): PublicHumanityAssistantPanel {
  const needsExplanation =
    needs.length > 0
      ? `Unmet public needs currently include: ${needs.map((need) => need.description).join("; ")}.`
      : commitment.status === "Active"
        ? "Required public needs are currently satisfied by aggregate declared capacity."
        : "Community Needs appear when collection is active and capacity gaps exist.";

  return {
    summary:
      "This informational panel explains public readiness context. It does not decide, persuade, or create commitments.",
    readinessExplanation: `${readiness.explanation} ${readiness.notApprovalStatement}`,
    policyExplanation: `${policy.summaryStatement} Required thresholds: ${policy.requiredThresholdLabels.join("; ") || "None listed"}.`,
    communityNeedsExplanation: needsExplanation,
    boundaryStatement:
      "The assistant never recommends participation, records declarations, or modifies commitments on your behalf.",
  };
}

export function toPublicImplementationCommitmentProjection(
  commitment: ImplementationCommitment,
): PublicImplementationCommitmentProjection | null {
  if (!commitment.implementationCommitmentId) {
    return null;
  }

  const decision = getDecision(commitment.collectiveDecisionId);
  const initiative = getInitiativeById(commitment.initiativeId);
  const petition = getPetition(commitment.petitionId);

  const communityCapacity = buildCommunityCapacity(commitment);
  const frozenPolicySummary = buildFrozenPolicySummary(commitment);
  const implementationReadiness = buildImplementationReadiness(commitment);
  const communityNeeds = buildCommunityNeeds(commitment);

  return {
    commitmentIdentity: buildCommitmentIdentity(commitment),
    initiativeContext: buildInitiativeContext(commitment, initiative),
    collectiveDecisionReference: buildCollectiveDecisionReference(commitment, decision),
    petitionReference: buildPetitionReference(commitment, petition),
    communityCapacity,
    frozenPolicySummary,
    implementationReadiness,
    communityNeeds,
    shareReference: buildShareReference(commitment),
    registrationGateway: buildRegistrationGateway(commitment),
    humanityAssistant: buildHumanityAssistantPanel(
      commitment,
      communityNeeds,
      implementationReadiness,
      frozenPolicySummary,
    ),
  };
}
