import type {
  Ballot,
  CollectiveDecision,
  DecisionOption,
  DecisionRules,
  EligibilityRules,
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
  opensAt: "",
  closesAt: "",
};

export const bootstrapCollectiveDecision: CollectiveDecision = {
  decisionId: "decision-bootstrap-001",
  decisionSubjectType: "Initiative",
  decisionSubjectId: "initiative-bootstrap-001",
  decisionMechanism: "CommunityPoll",
  status: "Draft",
  createdAt: BOOTSTRAP_TIMESTAMP,
  updatedAt: BOOTSTRAP_TIMESTAMP,
  ballot: bootstrapBallot,
  participantDecisions: [],
  decisionResult: null,
  outcome: null,
  statistics: {
    eligibleParticipantCount: 0,
    submittedDecisionCount: 0,
    participationRate: 0,
    completionRate: 0,
    abstentionCount: 0,
  },
  timeline: {
    createdAt: BOOTSTRAP_TIMESTAMP,
    scheduledAt: null,
    opensAt: null,
    closesAt: null,
    completedAt: null,
    archivedAt: null,
  },
};
