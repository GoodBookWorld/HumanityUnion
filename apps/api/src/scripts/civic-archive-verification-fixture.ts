import type { PublicCivicArchiveVerificationMetadata } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

export const TASK107B_FIXTURE_TITLE = "TASK-107B Archive Runtime Search Fixture Record";
export const TASK107C_FIXTURE_TITLE_PREFIX = "TASK-107C Horizontal Results Fixture Record";

export async function markArchiveRecordVerificationFixture(
  archiveRecordId: string,
  metadata: PublicCivicArchiveVerificationMetadata,
): Promise<void> {
  const { updateArchiveRecord } =
    await import("../modules/public-civic-archive/public-civic-archive.store.js");

  updateArchiveRecord(archiveRecordId, {
    verification: metadata,
  });
}

export async function seedCivicArchiveVerificationFixture(input: {
  steward: RequestIdentity;
  author: RequestIdentity;
  verificationRunId: string;
  verificationTask: string;
  title?: string;
  markAsVerificationFixture?: boolean;
}): Promise<{
  initiativeId: string;
  archiveRecordId: string;
  title: string;
  country: string;
  region: string;
  community: string;
  activityArea: string;
}> {
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const {
    createInitiativeImprovementProposalDraft,
    submitInitiativeImprovementProposal,
    decideInitiativeImprovementProposal,
  } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
  const { createDecisionSessionDraft, publishDecisionSession, closeDecisionSession } =
    await import("../modules/decision-session/decision-session.service.js");
  const {
    createInitiativeCollectiveDecisionDraft,
    openInitiativeCollectiveDecision,
    closeInitiativeCollectiveDecision,
  } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const {
    createInitiativeImplementationCommitmentDraft,
    publishInitiativeImplementationCommitment,
  } =
    await import("../modules/initiative-implementation-commitment/initiative-implementation-commitment.service.js");
  const {
    createInitiativeImplementationTrackingDraft,
    activateInitiativeImplementationTracking,
    addImplementationTrackingUpdate,
    completeInitiativeImplementationTracking,
  } =
    await import("../modules/initiative-implementation-tracking/initiative-implementation-tracking.service.js");
  const {
    createInitiativePublicImpactDraft,
    addPublicImpactEvidence,
    publishInitiativePublicImpact,
    verifyInitiativePublicImpact,
  } = await import("../modules/initiative-public-impact/initiative-public-impact.service.js");
  const { createPublicCivicArchiveDraft, publishPublicCivicArchive } =
    await import("../modules/public-civic-archive/public-civic-archive.service.js");
  const { getArchiveRecordById } =
    await import("../modules/public-civic-archive/public-civic-archive.store.js");

  seedMember({
    id: input.author.participantId,
    profile: {
      displayName: input.author.displayName ?? "Archive Author",
      uniqueName: "archive-runtime-author",
      languages: ["en"],
      country: "Canada",
      region: "British Columbia",
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const futureIsoDate = (daysFromNow: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  };

  const title = input.title ?? TASK107B_FIXTURE_TITLE;
  const draft = createInitiativeDraft(input.steward, {
    title: "TASK-107B Archive Runtime Search Initiative",
    description: "Archive runtime search verification initiative.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const published = publishInitiative(input.steward, draft.initiativeId);

  const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(input.steward, {
    initiativeId: published.initiativeId,
    title: "Archive Runtime Analysis",
    summary: "Analysis for runtime search verification.",
    supportingEvidence: "Evidence",
    risks: "Risk",
    suggestedImprovements: "Improve",
    references: "Ref",
  });
  await publishInitiativeCollaborativeAnalysis(input.steward, analysisDraft.analysisId);

  const proposalDraft = await createInitiativeImprovementProposalDraft(input.steward, {
    analysisId: analysisDraft.analysisId,
    targetSection: "Description",
    currentIssue: "Issue",
    proposedChange: "Change",
    rationale: "Rationale",
    expectedImprovement: "Improvement",
    references: "References",
  });
  const submittedProposal = submitInitiativeImprovementProposal(
    input.steward,
    proposalDraft.proposalId,
  );
  decideInitiativeImprovementProposal(input.steward, submittedProposal.proposalId, {
    decision: "accepted",
    decisionNote: "Accepted",
  });

  createInitiativeRevisionDraft(input.steward, published.initiativeId);
  saveInitiativeRevisionDraft(input.steward, published.initiativeId, {
    title: "TASK-107B Archive Runtime Search Initiative (Revised)",
    description: "Revised archive runtime search fixture.",
    revisionSummary: "Revision summary",
    appliedProposalIds: [submittedProposal.proposalId],
  });
  publishInitiativeRevision(input.steward, published.initiativeId);

  const sessionDraft = await createDecisionSessionDraft(input.steward, {
    initiativeId: published.initiativeId,
    title: "Archive Runtime Session",
    purpose: "Decision for runtime search fixture.",
    decisionQuestion: "Proceed?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });
  publishDecisionSession(input.steward, sessionDraft.sessionId);
  closeDecisionSession(input.steward, sessionDraft.sessionId);

  const decisionDraft = await createInitiativeCollectiveDecisionDraft(input.steward, {
    initiativeId: published.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });
  openInitiativeCollectiveDecision(input.steward, decisionDraft.decisionId);
  await closeInitiativeCollectiveDecision(input.steward, decisionDraft.decisionId);

  const commitmentDraft = await createInitiativeImplementationCommitmentDraft(input.steward, {
    initiativeId: published.initiativeId,
    decisionId: decisionDraft.decisionId,
    commitmentTitle: "Archive Runtime Commitment",
    commitmentSummary: "Commit to fixture delivery.",
    commitmentScope: "Site preparation.",
  });
  const publishedCommitment = publishInitiativeImplementationCommitment(
    input.steward,
    commitmentDraft.commitmentId,
  );

  const trackingDraft = await createInitiativeImplementationTrackingDraft(input.steward, {
    commitmentId: publishedCommitment.commitmentId,
    currentStage: "Completed",
    summary: "Fixture implementation completed.",
  });
  activateInitiativeImplementationTracking(input.steward, trackingDraft.trackingId);
  addImplementationTrackingUpdate(input.steward, trackingDraft.trackingId, {
    title: "Completion update",
    summary: "Fixture completed.",
    evidence: "https://example.org/evidence/archive-runtime-fixture",
  });
  completeInitiativeImplementationTracking(input.steward, trackingDraft.trackingId);

  const impactDraft = await createInitiativePublicImpactDraft(input.steward, {
    trackingId: trackingDraft.trackingId,
    title: "Archive Runtime Impact",
    summary: "Observable change from the archive runtime search fixture.",
    observedImpact: "Two new community garden beds are actively maintained by residents.",
    evidenceSummary: "Verified civic documentation.",
    affectedCommunity: "Nelson Community Garden",
  });
  addPublicImpactEvidence(input.steward, impactDraft.impactId, {
    title: "Completion evidence",
    description: "Verified completion documentation for archive runtime fixture.",
    referenceUrl: "https://example.org/evidence/archive-runtime-impact",
    referenceType: "document",
  });
  const impact = publishInitiativePublicImpact(input.steward, impactDraft.impactId);
  verifyInitiativePublicImpact(input.steward, impact.impactId);

  const archiveDraft = await createPublicCivicArchiveDraft(input.steward, {
    impactId: impact.impactId,
    title,
    summary: "Documented civic archive runtime search fixture outcome.",
    lessonsLearned: {
      whatWorked: "Worked",
      whatDidNotWork: "Did not",
      recommendationsForFuture: "Recommend",
      transferableExperience: "Transfer",
    },
    knowledgeContribution: {
      socialBenefits: "Social",
      environmentalBenefits: "Environmental",
      economicBenefits: "Economic",
      governanceBenefits: "Governance",
      educationalBenefits: "Educational",
      additionalObservations: "Observations",
    },
  });
  const publishedArchive = publishPublicCivicArchive(input.steward, archiveDraft.archiveRecordId);

  if (input.markAsVerificationFixture !== false) {
    await markArchiveRecordVerificationFixture(publishedArchive.archiveRecordId, {
      isVerificationFixture: true,
      verificationRunId: input.verificationRunId,
      verificationTask: input.verificationTask,
    });
  }

  const stored = getArchiveRecordById(publishedArchive.archiveRecordId);

  if (!stored) {
    throw new Error("Verification archive fixture was not persisted.");
  }

  return {
    initiativeId: published.initiativeId,
    archiveRecordId: publishedArchive.archiveRecordId,
    title,
    country: stored.country,
    region: stored.region,
    community: stored.community,
    activityArea: stored.activityArea,
  };
}

export async function seedMultipleCivicArchiveVerificationFixtures(input: {
  steward: RequestIdentity;
  author: RequestIdentity;
  verificationRunId: string;
  verificationTask: string;
  titlePrefix: string;
  count: number;
  markAsVerificationFixture?: boolean;
}): Promise<
  Array<{
    initiativeId: string;
    archiveRecordId: string;
    title: string;
    country: string;
    region: string;
    community: string;
    activityArea: string;
  }>
> {
  const fixtures = [];

  for (let index = 0; index < input.count; index += 1) {
    fixtures.push(
      await seedCivicArchiveVerificationFixture({
        steward: input.steward,
        author: {
          participantId: `${input.author.participantId}-${index + 1}`,
          displayName: `${input.author.displayName ?? "Archive Author"} ${index + 1}`,
        },
        verificationRunId: input.verificationRunId,
        verificationTask: input.verificationTask,
        title: `${input.titlePrefix} ${index + 1}`,
        markAsVerificationFixture: input.markAsVerificationFixture,
      }),
    );
  }

  return fixtures;
}
