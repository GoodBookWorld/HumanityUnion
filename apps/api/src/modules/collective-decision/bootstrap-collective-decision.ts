import type {
  Ballot,
  CollectiveDecision,
  DecisionOption,
  DecisionResult,
  DecisionRules,
  EligibilityRules,
  Outcome,
  ParticipantDecision,
} from "@hu/types";

const BOOTSTRAP_TIMESTAMP = "2026-07-02T00:00:00.000Z";

const approveOption: DecisionOption = {
  optionId: "option-bootstrap-approve",
  label: "Approve",
  description: "Proceed to the Petition stage.",
  value: "Approve",
  order: 1,
};

const rejectOption: DecisionOption = {
  optionId: "option-bootstrap-reject",
  label: "Reject",
  description: "Do not proceed to the Petition stage.",
  value: "Reject",
  order: 2,
};

const defaultDecisionRules: DecisionRules = {
  quorumRequired: 1,
  minimumParticipationRate: 1,
  approvalThreshold: 50,
  winningMethod: "simple_majority",
  tiePolicy: "reject",
  abstentionPolicy: "exclude",
};

const defaultEligibilityRules: EligibilityRules = {
  membershipRequired: true,
  verificationLevelRequired: null,
  regionRequired: null,
  organizationRequired: null,
  minimumAccountAge: null,
  customEligibilityPolicy: null,
};

const bootstrapBallot: Ballot = {
  ballotId: "ballot-bootstrap-001",
  question: "Should this Initiative proceed to the Petition stage?",
  options: [approveOption, rejectOption],
  decisionRules: defaultDecisionRules,
  eligibilityRules: defaultEligibilityRules,
  opensAt: BOOTSTRAP_TIMESTAMP,
  closesAt: BOOTSTRAP_TIMESTAMP,
};

const bootstrapParticipantDecision: ParticipantDecision = {
  participantDecisionId: "participant-decision-bootstrap-001",
  participantId: "member-bootstrap-001",
  ballotId: bootstrapBallot.ballotId,
  selectedOptionIds: [approveOption.optionId],
  submittedAt: BOOTSTRAP_TIMESTAMP,
  status: "submitted",
};

const bootstrapDecisionResult: DecisionResult = {
  resultId: "result-decision-bootstrap-001",
  calculatedAt: BOOTSTRAP_TIMESTAMP,
  optionResults: [
    {
      optionId: approveOption.optionId,
      count: 1,
      percentage: 100,
    },
    {
      optionId: rejectOption.optionId,
      count: 0,
      percentage: 0,
    },
  ],
  winningOptionId: approveOption.optionId,
  participationRate: 100,
  quorumSatisfied: true,
  thresholdSatisfied: true,
};

const bootstrapOutcome: Outcome = {
  outcomeId: "outcome-decision-bootstrap-001",
  outcomeType: "Approved",
  createdAt: BOOTSTRAP_TIMESTAMP,
  nextLifecycleStage: "Petition",
  explanation: "Initiative approved to proceed to the Petition stage.",
};

export const bootstrapCollectiveDecision: CollectiveDecision = {
  decisionId: "decision-bootstrap-001",
  decisionSubjectType: "Initiative",
  decisionSubjectId: "initiative-bootstrap-001",
  decisionMechanism: "CommunityPoll",
  status: "Completed",
  createdAt: BOOTSTRAP_TIMESTAMP,
  updatedAt: BOOTSTRAP_TIMESTAMP,
  ballot: bootstrapBallot,
  participantDecisions: [bootstrapParticipantDecision],
  decisionResult: bootstrapDecisionResult,
  outcome: bootstrapOutcome,
  statistics: {
    eligibleParticipantCount: 1,
    submittedDecisionCount: 1,
    participationRate: 100,
    completionRate: 100,
    abstentionCount: 0,
  },
  timeline: {
    createdAt: BOOTSTRAP_TIMESTAMP,
    scheduledAt: BOOTSTRAP_TIMESTAMP,
    opensAt: BOOTSTRAP_TIMESTAMP,
    closesAt: BOOTSTRAP_TIMESTAMP,
    completedAt: BOOTSTRAP_TIMESTAMP,
    archivedAt: null,
  },
};
