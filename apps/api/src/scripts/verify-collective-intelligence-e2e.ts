/**
 * TASK-020 — Collective Intelligence end-to-end verification.
 * Run: npm run verify:collective-intelligence
 */

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const participantA: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const participantB: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const PRIVATE_FIELD_KEYS = ["authorId", "stewardId", "memberId", "email", "participantId"];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
    throw new Error(`Expected failure: ${message}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected failure:")) {
      throw error;
    }
  }
}

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `${label} leaked private field: ${key}`);
  }
}

async function main(): Promise<void> {
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const {
    createInitiativeCollaborativeAnalysisDraft,
    publishInitiativeCollaborativeAnalysis,
    archiveInitiativeCollaborativeAnalysis,
    saveInitiativeCollaborativeAnalysisDraft,
  } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const {
    createInitiativeImprovementProposalDraft,
    submitInitiativeImprovementProposal,
    decideInitiativeImprovementProposal,
    saveInitiativeImprovementProposalDraft,
  } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
  const { toPublicInitiativeProjection } =
    await import("../modules/initiatives/public-initiative.projection.js");
  const { getPublicInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js");
  const { getPublicInitiativeImprovementProposal } =
    await import("../modules/initiative-improvement-proposal/public-initiative-improvement-proposal.projection.js");
  const {
    getPublicInitiativeVersionHistory,
    getPublicInitiativeVersionRevision,
    computeInitiativeRevisionMetrics,
  } =
    await import("../modules/initiative-version-revision/public-initiative-version-revision.projection.js");
  const { listProjectedInitiativeCards } =
    await import("../modules/initiatives/initiative-projection.store.js");
  const { getProposalById } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.store.js");
  const { getAnalysisById } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js");

  console.log("1. Participant A — create and publish initiative");

  const draft = createInitiativeDraft(participantA, {
    title: "E2E Civic Garden Initiative",
    description: "Initial community garden proposal for end-to-end verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  const projected = publishInitiative(participantA, draft.initiativeId);
  assert(projected.lifecyclePhase === "projected", "Initiative should be projected after publish");

  const publicInitiative = toPublicInitiativeProjection(projected);
  assert(publicInitiative.currentVersion === 1, "Initial public version should be 1");
  assertNoPrivateFields(publicInitiative, "Public initiative");

  console.log("2. Participant B — collaborative analysis");

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(participantB, {
    initiativeId: projected.initiativeId,
    title: "E2E Garden Analysis",
    summary: "Structured analysis of the garden initiative.",
    supportingEvidence: "Community surveys support shared garden access.",
    risks: "Seasonal maintenance may require additional volunteers.",
    suggestedImprovements: "Add composting section.",
    references: "Local food security report 2025.",
  });

  assert(analysisDraft.initiativeVersion === 1, "Analysis should attach to version 1");

  const publishedAnalysis = publishInitiativeCollaborativeAnalysis(
    participantB,
    analysisDraft.analysisId,
  );
  assert(publishedAnalysis.status === "published", "Analysis should be published");

  const publicAnalysis = getPublicInitiativeCollaborativeAnalysis(publishedAnalysis.analysisId);
  assert(publicAnalysis !== null, "Public analysis should be available");
  if (!publicAnalysis) {
    throw new Error("Public analysis should be available");
  }
  assert(publicAnalysis.initiativeVersion === 1, "Public analysis should show version 1");
  assertNoPrivateFields(publicAnalysis, "Public analysis");

  console.log("3. Participant B — improvement proposal");

  const proposalDraft = createInitiativeImprovementProposalDraft(participantB, {
    analysisId: publishedAnalysis.analysisId,
    targetSection: "Description",
    currentIssue: "Composting is not mentioned.",
    proposedChange: "Add a dedicated composting area to the initiative description.",
    rationale: "Composting improves soil quality and reduces waste.",
    expectedImprovement: "Stronger environmental impact and volunteer engagement.",
    references: "Municipal composting guidelines.",
  });

  const submittedProposal = submitInitiativeImprovementProposal(
    participantB,
    proposalDraft.proposalId,
  );
  assert(submittedProposal.status === "submitted", "Proposal should be submitted");

  console.log("4. Participant A — steward decision");

  const decidedProposal = decideInitiativeImprovementProposal(
    participantA,
    submittedProposal.proposalId,
    {
      decision: "accepted",
      decisionNote: "Composting aligns with community goals. Will include in next revision.",
    },
  );
  assert(decidedProposal.status === "accepted", "Proposal should be accepted");

  assertThrows(
    () =>
      decideInitiativeImprovementProposal(participantB, submittedProposal.proposalId, {
        decision: "declined",
        decisionNote: "Non-steward should not decide.",
      }),
    "Non-steward cannot decide proposal",
  );

  console.log("5. Participant A — revision from accepted proposal");

  createInitiativeRevisionDraft(participantA, projected.initiativeId);

  saveInitiativeRevisionDraft(participantA, projected.initiativeId, {
    title: "E2E Civic Garden Initiative (Revised)",
    description:
      "Revised community garden proposal including a dedicated composting area for end-to-end verification.",
    revisionSummary: "Added composting area based on accepted improvement proposal.",
    appliedProposalIds: [decidedProposal.proposalId],
  });

  assertThrows(
    () => publishInitiativeRevision(participantB, projected.initiativeId),
    "Non-steward cannot publish revision",
  );

  const revisionResult = publishInitiativeRevision(participantA, projected.initiativeId);
  assert(revisionResult.revision.version === 2, "Revision version should be 2");
  assert(
    revisionResult.initiative.title.includes("Revised"),
    "Initiative content should reflect manual steward edits",
  );

  const implementedProposal = getProposalById(decidedProposal.proposalId);
  assert(implementedProposal?.implementedInVersion === 2, "Proposal should link to version 2");

  console.log("6. Public projection refresh");

  const updatedPublicInitiative = toPublicInitiativeProjection(revisionResult.initiative);
  assert(updatedPublicInitiative.currentVersion === 2, "Public current version should be 2");
  assert(
    updatedPublicInitiative.title.includes("Revised"),
    "Public projection should show latest content",
  );

  const communityCards = listProjectedInitiativeCards("nelson-community-garden");
  const matchingCards = communityCards.filter(
    (card) => card.initiativeId === projected.initiativeId,
  );
  assert(matchingCards.length === 1, "Community projection should have exactly one card");
  assert(
    matchingCards[0]?.title.includes("Revised") === true,
    "Community card should show latest projected version",
  );

  console.log("7. Version history");

  const versionHistory = getPublicInitiativeVersionHistory(projected.initiativeId);
  assert(versionHistory.currentVersion === 2, "Version history current should be 2");
  assert(versionHistory.revisions.length === 2, "Version history should contain 2 revisions");
  assert(
    versionHistory.revisions.some((revision) => revision.isCurrent && revision.version === 2),
    "Version 2 should be marked current",
  );

  const versionOne = getPublicInitiativeVersionRevision(projected.initiativeId, 1);
  const versionTwo = getPublicInitiativeVersionRevision(projected.initiativeId, 2);
  assert(versionOne !== null && versionTwo !== null, "Both versions should be readable");
  assertNoPrivateFields(versionOne, "Public revision v1");
  assertNoPrivateFields(versionTwo, "Public revision v2");

  console.log("8. Proposal traceability");

  const publicProposal = getPublicInitiativeImprovementProposal(decidedProposal.proposalId);
  assert(publicProposal !== null, "Public proposal should be available");
  if (!publicProposal) {
    throw new Error("Public proposal should be available");
  }
  assert(publicProposal.implementedInVersion === 2, "Proposal should show implemented version");
  assertNoPrivateFields(publicProposal, "Public proposal");

  console.log("9. Analysis traceability after revision");

  const postRevisionAnalysis = createInitiativeCollaborativeAnalysisDraft(participantB, {
    initiativeId: projected.initiativeId,
    title: "E2E Post-Revision Analysis",
    summary: "Analysis created after version 2 publication.",
    supportingEvidence: "Volunteer capacity has increased.",
    risks: "Winter planning remains open.",
    suggestedImprovements: "Add winter greenhouse plan.",
    references: "Seasonal planning guide.",
  });

  assert(
    postRevisionAnalysis.initiativeVersion === 2,
    "Future analysis should attach to newest published version",
  );

  const storedOriginalAnalysis = getAnalysisById(publishedAnalysis.analysisId);
  assert(
    storedOriginalAnalysis?.initiativeVersion === 1,
    "Original analysis should remain attached to version 1",
  );

  console.log("10. Metrics readiness");

  const metrics = computeInitiativeRevisionMetrics(projected.initiativeId);
  assert(metrics.revisionCount === 2, "revisionCount should be 2");
  assert(metrics.implementedProposalCount === 1, "implementedProposalCount should be 1");
  assert(metrics.acceptedProposalImplementationRate === 1, "implementation rate should be 1");
  assert(metrics.averageAcceptedPerRevision === 0.5, "averageAcceptedPerRevision should be 0.5");

  console.log("11. Ownership — wrong participant cannot edit protected records");

  assertThrows(
    () =>
      saveInitiativeCollaborativeAnalysisDraft(participantA, analysisDraft.analysisId, {
        title: "Unauthorized analysis edit",
      }),
    "Non-author cannot edit analysis",
  );

  assertThrows(
    () => archiveInitiativeCollaborativeAnalysis(participantA, publishedAnalysis.analysisId),
    "Non-author cannot archive analysis",
  );

  assertThrows(
    () =>
      saveInitiativeImprovementProposalDraft(participantA, proposalDraft.proposalId, {
        proposedChange: "Unauthorized proposal edit",
      }),
    "Non-author cannot edit proposal",
  );

  assertThrows(
    () =>
      saveInitiativeRevisionDraft(participantB, projected.initiativeId, {
        revisionSummary: "Unauthorized edit",
      }),
    "Non-steward cannot save revision draft",
  );

  console.log("All Collective Intelligence E2E checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`E2E verification FAILED: ${message}`);
  process.exit(1);
});
