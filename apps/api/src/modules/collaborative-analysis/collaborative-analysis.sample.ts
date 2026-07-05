import type { CollaborativeAnalysis, Contribution, ProgressPolicy, Signal } from "@hu/types";

const BOOTSTRAP_TIMESTAMP = "2026-07-01T00:00:00.000Z";

const defaultProgressPolicy: ProgressPolicy = {
  minimumContributions: 5,
  requiredSignalTypes: ["StrongEvidence", "NeedsClarification"],
  minimumSignals: 3,
  minimumParticipantCount: 2,
  supportThreshold: 2,
  expertReviewRequired: true,
  regionalReviewRequired: true,
};

const bootstrapContributions: Contribution[] = [
  {
    contributionId: "ca-contribution-bootstrap-001",
    authorId: "member-bootstrap-001",
    contributionType: "Evidence",
    title: "Local food access study",
    content: "Regional data shows limited access to fresh produce within a two-kilometer radius.",
    metadata: {
      source: "Community Health Report 2025",
    },
    createdAt: BOOTSTRAP_TIMESTAMP,
  },
  {
    contributionId: "ca-contribution-bootstrap-002",
    authorId: "member-bootstrap-002",
    contributionType: "Question",
    title: "Land use permissions",
    content: "Has the steward confirmed municipal approval for shared garden use?",
    metadata: {},
    createdAt: BOOTSTRAP_TIMESTAMP,
  },
  {
    contributionId: "ca-contribution-bootstrap-003",
    authorId: "member-bootstrap-003",
    contributionType: "ExpertOpinion",
    title: "Urban agriculture feasibility",
    content: "A community garden is feasible if water access and soil testing are addressed early.",
    metadata: {
      expertise: "Urban Agriculture",
    },
    createdAt: BOOTSTRAP_TIMESTAMP,
  },
];

const bootstrapSignals: Signal[] = [
  {
    signalId: "ca-signal-bootstrap-001",
    memberId: "member-bootstrap-002",
    signalType: "StrongEvidence",
    targetType: "Contribution",
    targetId: "ca-contribution-bootstrap-001",
    createdAt: BOOTSTRAP_TIMESTAMP,
  },
  {
    signalId: "ca-signal-bootstrap-002",
    memberId: "member-bootstrap-001",
    signalType: "NeedsClarification",
    targetType: "Contribution",
    targetId: "ca-contribution-bootstrap-002",
    createdAt: BOOTSTRAP_TIMESTAMP,
  },
  {
    signalId: "ca-signal-bootstrap-003",
    memberId: "member-bootstrap-003",
    signalType: "RegionalImpact",
    targetType: "Initiative",
    targetId: "initiative-bootstrap-001",
    createdAt: BOOTSTRAP_TIMESTAMP,
  },
];

export const sampleCollaborativeAnalysis: CollaborativeAnalysis = {
  analysisId: "analysis-bootstrap-001",
  initiativeId: "initiative-bootstrap-001",
  status: "active",
  createdAt: BOOTSTRAP_TIMESTAMP,
  updatedAt: BOOTSTRAP_TIMESTAMP,
  contributions: bootstrapContributions,
  signals: bootstrapSignals,
  summaries: [],
  progressPolicy: defaultProgressPolicy,
  readiness: {
    readinessScore: 0,
    satisfiedRequirements: [],
    missingRequirements: [],
    blockingIssues: [],
  },
  metrics: {
    contributionCount: 0,
    signalCount: 0,
    participantCount: 0,
    evidenceCount: 0,
    expertContributionCount: 0,
    clarificationCount: 0,
  },
};
