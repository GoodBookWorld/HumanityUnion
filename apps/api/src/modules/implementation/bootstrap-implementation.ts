import type { Achievement, Evidence, Implementation, Milestone } from "@hu/types";

import { bootstrapCommitmentId } from "../implementation-commitment/implementation-commitment.defaults.js";
import { bootstrapFrozenPolicyId } from "../implementation-commitment/frozen-policy.fixture.js";
import {
  bootstrapCollectiveDecisionId,
  bootstrapInitiativeId,
  bootstrapPetitionId,
} from "../petition/petition.defaults.js";
import {
  bootstrapImplementationId,
  bootstrapMilestoneCommunityOutreachId,
  bootstrapMilestoneGardenLaunchId,
  bootstrapMilestoneSitePrepId,
  bootstrapPhaseExecutionId,
  bootstrapPhasePlanningId,
  BOOTSTRAP_TIMESTAMP,
} from "./implementation.defaults.js";
import {
  createEmptyCollectiveProgress,
  createEmptyCompletion,
  createEmptyCompletionAssessment,
  createEmptyCompletionIndicator,
  createEmptyProgressIndicator,
  refreshDerivedState,
} from "./implementation.helpers.js";

export const bootstrapAchievementSitePrepId = "achievement-bootstrap-site-prep-001";

export const bootstrapEvidenceSitePrepId = "evidence-bootstrap-site-prep-001";

const bootstrapMemberId = "member-bootstrap-001";

const bootstrapAchievement: Achievement = {
  achievementId: bootstrapAchievementSitePrepId,
  implementationId: bootstrapImplementationId,
  milestoneId: bootstrapMilestoneSitePrepId,
  title: "Site preparation completed collectively",
  summary:
    "Participants prepared the garden site through shared clearing, soil assessment and layout marking.",
  recordedAt: BOOTSTRAP_TIMESTAMP,
  recordedByParticipantId: bootstrapMemberId,
  createdAt: BOOTSTRAP_TIMESTAMP,
  updatedAt: BOOTSTRAP_TIMESTAMP,
};

const bootstrapEvidence: Evidence = {
  evidenceId: bootstrapEvidenceSitePrepId,
  achievementId: bootstrapAchievementSitePrepId,
  implementationId: bootstrapImplementationId,
  evidenceKind: "Reference",
  label: "Community soil assessment reference",
  recordedAt: BOOTSTRAP_TIMESTAMP,
  createdAt: BOOTSTRAP_TIMESTAMP,
  reference: {
    referenceId: "soil-assessment-ref-001",
    referenceType: "CommunityRecord",
    displayLabel: "Shared soil assessment summary",
  },
  attachment: null,
  link: null,
};

const bootstrapMilestones: Milestone[] = [
  {
    milestoneId: bootstrapMilestoneSitePrepId,
    implementationId: bootstrapImplementationId,
    implementationPhaseId: bootstrapPhasePlanningId,
    title: "Site preparation",
    description: "Prepare and assess the community garden site for planting.",
    requirementType: "Required",
    status: "Open",
    sequenceOrder: 1,
    createdAt: BOOTSTRAP_TIMESTAMP,
    updatedAt: BOOTSTRAP_TIMESTAMP,
    satisfiedAt: null,
  },
  {
    milestoneId: bootstrapMilestoneCommunityOutreachId,
    implementationId: bootstrapImplementationId,
    implementationPhaseId: bootstrapPhaseExecutionId,
    title: "Community outreach",
    description: "Inform neighboring residents and invite participation.",
    requirementType: "Optional",
    status: "Open",
    sequenceOrder: 1,
    createdAt: BOOTSTRAP_TIMESTAMP,
    updatedAt: BOOTSTRAP_TIMESTAMP,
    satisfiedAt: null,
  },
  {
    milestoneId: bootstrapMilestoneGardenLaunchId,
    implementationId: bootstrapImplementationId,
    implementationPhaseId: bootstrapPhaseExecutionId,
    title: "Garden launch",
    description: "Open the community garden for shared cultivation.",
    requirementType: "Required",
    status: "Open",
    sequenceOrder: 2,
    createdAt: BOOTSTRAP_TIMESTAMP,
    updatedAt: BOOTSTRAP_TIMESTAMP,
    satisfiedAt: null,
  },
];

export const bootstrapImplementation: Implementation = {
  implementationId: bootstrapImplementationId,
  initiativeId: bootstrapInitiativeId,
  collectiveDecisionId: bootstrapCollectiveDecisionId,
  petitionId: bootstrapPetitionId,
  implementationCommitmentId: bootstrapCommitmentId,
  frozenPolicyId: bootstrapFrozenPolicyId,
  status: "InProgress",
  subjectTitle: "Community Garden Initiative",
  subjectSummary:
    "Establish a shared community garden to improve local food access and neighborhood cooperation.",
  createdAt: BOOTSTRAP_TIMESTAMP,
  updatedAt: BOOTSTRAP_TIMESTAMP,
  implementationPhases: [
    {
      implementationPhaseId: bootstrapPhasePlanningId,
      implementationId: bootstrapImplementationId,
      title: "Planning and preparation",
      summary: "Prepare the site and confirm collective readiness to begin cultivation.",
      sequenceOrder: 1,
      status: "Open",
      createdAt: BOOTSTRAP_TIMESTAMP,
      updatedAt: BOOTSTRAP_TIMESTAMP,
    },
    {
      implementationPhaseId: bootstrapPhaseExecutionId,
      implementationId: bootstrapImplementationId,
      title: "Execution and launch",
      summary: "Engage the community and open the garden for shared use.",
      sequenceOrder: 2,
      status: "Open",
      createdAt: BOOTSTRAP_TIMESTAMP,
      updatedAt: BOOTSTRAP_TIMESTAMP,
    },
  ],
  milestones: bootstrapMilestones,
  achievements: [bootstrapAchievement],
  evidence: [bootstrapEvidence],
  collectiveProgress: createEmptyCollectiveProgress(BOOTSTRAP_TIMESTAMP),
  completionAssessment: createEmptyCompletionAssessment(BOOTSTRAP_TIMESTAMP),
  completion: createEmptyCompletion(BOOTSTRAP_TIMESTAMP),
  progressIndicator: createEmptyProgressIndicator(BOOTSTRAP_TIMESTAMP),
  completionIndicator: createEmptyCompletionIndicator(BOOTSTRAP_TIMESTAMP),
  progressSnapshots: [],
};

refreshDerivedState(bootstrapImplementation);

export { bootstrapImplementationId };
