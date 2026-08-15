/**
 * TASK-098D — Initiative-grouped search pagination verification.
 * Run: npm run verify:grouped-search-pagination
 */

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const otherParticipant: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function seedGroupedSearchFixture(): Promise<{
  initiativeId: string;
  impactTitle: string;
  analysisTitle: string;
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
  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");

  function futureIsoDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  seedMember({
    id: otherParticipant.participantId,
    profile: {
      displayName: otherParticipant.displayName ?? "Analyst B",
      uniqueName: "grouped-search-analyst-b",
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

  const draft = createInitiativeDraft(steward, {
    title: "Grouped Search Pagination Initiative",
    description: "Verification initiative for grouped search pagination.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  const published = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(otherParticipant, {
    initiativeId: published.initiativeId,
    title: "Grouped Search Analysis Evidence",
    summary: "Analysis supporting grouped search pagination verification.",
    supportingEvidence: "Evidence",
    risks: "Risk",
    suggestedImprovements: "Improve",
    references: "Ref",
  });
  const analysis = await publishInitiativeCollaborativeAnalysis(
    otherParticipant,
    analysisDraft.analysisId,
  );

  const proposalDraft = await createInitiativeImprovementProposalDraft(otherParticipant, {
    analysisId: analysis.analysisId,
    targetSection: "Summary",
    currentIssue: "Issue",
    proposedChange: "Change",
    rationale: "Rationale",
    expectedImprovement: "Improvement",
    references: "References",
  });
  const submitted = submitInitiativeImprovementProposal(otherParticipant, proposalDraft.proposalId);
  const decided = decideInitiativeImprovementProposal(steward, submitted.proposalId, {
    decision: "accepted",
    decisionNote: "Accepted for grouped search verification.",
  });

  createInitiativeRevisionDraft(steward, published.initiativeId);
  saveInitiativeRevisionDraft(steward, published.initiativeId, {
    revisionSummary: "Grouped search revision",
    appliedProposalIds: [decided.proposalId],
    skippedProposalIds: [],
  });
  publishInitiativeRevision(steward, published.initiativeId);

  const sessionDraft = await createDecisionSessionDraft(steward, {
    initiativeId: published.initiativeId,
    title: "Grouped Search Decision Session",
    purpose: "Prepare grouped search verification decision",
    decisionQuestion: "Proceed with grouped search verification?",
    opensAt: futureIsoDate(1),
    closesAt: futureIsoDate(14),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  const decisionDraft = await createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId: published.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });
  const opened = openInitiativeCollectiveDecision(steward, decisionDraft.decisionId);
  await closeInitiativeCollectiveDecision(steward, opened.decisionId);

  const commitmentDraft = await createInitiativeImplementationCommitmentDraft(steward, {
    initiativeId: published.initiativeId,
    decisionId: opened.decisionId,
    commitmentTitle: "Grouped Search Commitment",
    commitmentSummary: "Commit to grouped searchable civic records.",
    commitmentScope: "Community implementation scope.",
  });
  const commitment = publishInitiativeImplementationCommitment(
    steward,
    commitmentDraft.commitmentId,
  );

  const trackingDraft = await createInitiativeImplementationTrackingDraft(steward, {
    commitmentId: commitment.commitmentId,
    summary: "Grouped search tracking record",
    currentStage: "Implementation",
  });
  const tracking = activateInitiativeImplementationTracking(steward, trackingDraft.trackingId);
  addImplementationTrackingUpdate(steward, tracking.trackingId, {
    title: "Grouped search update",
    summary: "Tracking update for grouped search verification.",
    evidence: "https://example.org/grouped-search-evidence",
  });
  completeInitiativeImplementationTracking(steward, tracking.trackingId);

  const impactDraft = await createInitiativePublicImpactDraft(steward, {
    trackingId: tracking.trackingId,
    title: "Grouped Search Verified Impact",
    summary: "Impact summary for grouped search pagination verification.",
    observedImpact: "Grouped search can discover this impact record.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Evidence summary",
  });
  addPublicImpactEvidence(steward, impactDraft.impactId, {
    title: "Grouped search evidence",
    description: "Evidence for grouped search verification.",
    referenceUrl: "https://example.org/grouped-search-evidence.pdf",
    referenceType: "document",
  });
  const impact = publishInitiativePublicImpact(steward, impactDraft.impactId);
  verifyInitiativePublicImpact(steward, impact.impactId);

  resetGlobalSearchIndexForTests();

  return {
    initiativeId: published.initiativeId,
    impactTitle: impact.title,
    analysisTitle: analysis.title,
  };
}

async function verifyGroupedPagination(): Promise<void> {
  console.log("1. Grouped pagination uses initiative lifecycle units");

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  const fixture = await seedGroupedSearchFixture();
  resetGlobalSearchIndexForTests();

  const flatPaged = await searchPublicCivicRecords({
    q: "Grouped Search",
    limit: 1,
    offset: 0,
    view: "flat",
  });
  const flatPagedNext = await searchPublicCivicRecords({
    q: "Grouped Search",
    limit: 1,
    offset: 1,
    view: "flat",
  });

  assert(flatPaged.results.length === 1, "Flat mode must paginate individual records");
  assert(flatPagedNext.results.length === 1, "Flat mode offset must return another record");
  assert(
    flatPaged.results[0]?.entityId !== flatPagedNext.results[0]?.entityId,
    "Flat pagination must split lifecycle records across pages",
  );

  const groupedPage = await searchPublicCivicRecords({
    q: "Grouped Search",
    limit: 1,
    offset: 0,
    view: "grouped",
  });

  assert(groupedPage.view === "grouped", "Grouped search must report grouped view");
  assert(groupedPage.totalDisplayResults >= 1, "Grouped search must count display units");
  assert(groupedPage.total === groupedPage.totalDisplayResults, "Total must match display units");
  assert(
    (groupedPage.displayResults?.length ?? 0) === 1,
    "Grouped limit 1 must return one top-level display unit",
  );

  const group = groupedPage.displayResults?.[0];

  assert(group?.kind === "initiative_group", "Grouped page must return an initiative group");
  assert(
    group.initiativeId === fixture.initiativeId,
    "Grouped result must reference the seeded initiative",
  );
  assert(group.stages.length >= 3, "Grouped initiative must hydrate multiple lifecycle stages");
  assert(
    group.totalChildRecordCount >=
      group.stages.reduce((sum, stage) => sum + stage.records.length, 0),
    "Group must know complete child record count",
  );

  const stageEntityTypes = new Set(
    group.stages.flatMap((stage) => stage.records.map((record) => record.entityType)),
  );

  assert(stageEntityTypes.has("analysis"), "Grouped lifecycle must include analysis stage");
  assert(stageEntityTypes.has("public_impact"), "Grouped lifecycle must include impact stage");

  const groupedAll = await searchPublicCivicRecords({
    q: "Grouped Search",
    limit: 20,
    offset: 0,
    view: "grouped",
  });

  const initiativeIds = new Set(
    groupedAll.displayResults
      ?.filter((entry) => entry.kind === "initiative_group")
      .map((entry) => entry.initiativeId) ?? [],
  );

  assert(
    initiativeIds.size === groupedAll.initiativeGroupCount,
    "Each initiative must appear once in grouped results",
  );
  assert(
    (groupedAll.displayResults?.length ?? 0) <= 20,
    "Grouped page must not exceed requested visible result limit",
  );
  assert(
    groupedAll.hasMore ===
      groupedAll.offset + (groupedAll.displayResults?.length ?? 0) < groupedAll.totalDisplayResults,
    "hasMore must reflect grouped pagination",
  );
}

async function verifyEntityTypeFilterSemantics(): Promise<void> {
  console.log("2. Entity type filters match lifecycle groups and mark stages");

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  const fixture = await seedGroupedSearchFixture();
  resetGlobalSearchIndexForTests();

  const analysisOnly = await searchPublicCivicRecords({
    entityTypes: ["analysis"],
    limit: 20,
    offset: 0,
    view: "grouped",
  });

  assert(analysisOnly.totalDisplayResults >= 1, "Analysis filter must return grouped results");
  const analysisGroup = analysisOnly.displayResults?.find(
    (entry) => entry.kind === "initiative_group" && entry.initiativeId === fixture.initiativeId,
  );

  assert(
    analysisGroup?.kind === "initiative_group",
    "Analysis filter must return initiative group",
  );
  assert(
    analysisGroup.stages.some((stage) => stage.stageId === "analysis" && stage.matched),
    "Analysis filter must mark the analysis stage as matched",
  );
  assert(
    analysisGroup.stages.length > 1,
    "Analysis filter must still show complete lifecycle context",
  );
}

async function verifyFlatCompatibility(): Promise<void> {
  console.log("3. Flat mode remains available for programmatic consumers");

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  await seedGroupedSearchFixture();
  resetGlobalSearchIndexForTests();

  const flat = await searchPublicCivicRecords({
    entityTypes: ["public_impact"],
    limit: 20,
    offset: 0,
    view: "flat",
  });

  assert(flat.view === "flat", "Flat mode must be explicit");
  assert(flat.results.length >= 1, "Flat mode must return entity records");
  assert(
    flat.results.every((result) => result.entityType === "public_impact"),
    "Flat mode must preserve entity-level filtering",
  );
  assert(flat.displayResults === undefined, "Flat mode must not return displayResults");
}

async function verifyDeterministicSorting(): Promise<void> {
  console.log("4. Grouped sorting is deterministic");

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  await seedGroupedSearchFixture();
  resetGlobalSearchIndexForTests();

  const first = await searchPublicCivicRecords({ limit: 20, offset: 0, view: "grouped" });
  const second = await searchPublicCivicRecords({ limit: 20, offset: 0, view: "grouped" });

  assert(
    JSON.stringify(first.displayResults) === JSON.stringify(second.displayResults),
    "Repeated grouped searches must return identical ordering",
  );
}

async function verifyNoDraftLeak(): Promise<void> {
  console.log("5. Draft initiatives remain excluded");

  const { createInitiativeDraft } = await import("../modules/initiatives/initiative.service.js");
  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  const draftOnly = createInitiativeDraft(steward, {
    title: "Grouped Search Draft Exclusion Initiative",
    description: "This draft must never appear in grouped search.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  resetGlobalSearchIndexForTests();

  const grouped = await searchPublicCivicRecords({
    q: "Grouped Search Draft Exclusion",
    limit: 20,
    offset: 0,
    view: "grouped",
  });

  assert(
    !grouped.displayResults?.some(
      (entry) => entry.kind === "initiative_group" && entry.initiativeId === draftOnly.initiativeId,
    ),
    "Draft initiatives must not appear in grouped search",
  );
}

async function verifyBoundedResponse(): Promise<void> {
  console.log("6. Grouped response remains bounded");

  const { resetGlobalSearchIndexForTests } =
    await import("../modules/global-search/global-search.index.js");
  const { searchPublicCivicRecords } =
    await import("../modules/global-search/global-search.service.js");

  resetGlobalSearchIndexForTests();
  await seedGroupedSearchFixture();
  resetGlobalSearchIndexForTests();

  const grouped = await searchPublicCivicRecords({ limit: 5, offset: 0, view: "grouped" });

  assert((grouped.displayResults?.length ?? 0) <= 5, "Grouped page must respect limit");
  assert(JSON.stringify(grouped).length < 500_000, "Grouped response must remain bounded");
}

async function main(): Promise<void> {
  await verifyGroupedPagination();
  await verifyEntityTypeFilterSemantics();
  await verifyFlatCompatibility();
  await verifyDeterministicSorting();
  await verifyNoDraftLeak();
  await verifyBoundedResponse();
  console.log("Grouped search pagination verification passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
