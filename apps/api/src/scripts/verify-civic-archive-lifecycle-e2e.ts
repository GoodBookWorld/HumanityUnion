/**
 * TASK-098E — Civic Archive lifecycle records verification.
 * Run: npm run verify:civic-archive-lifecycle
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const author: RequestIdentity = {
  participantId: "member-ca-author",
  displayName: "Archive Author",
};

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function seedArchiveFixture(): Promise<{ initiativeId: string }> {
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

  seedMember({
    id: author.participantId,
    profile: {
      displayName: author.displayName ?? "Archive Author",
      uniqueName: "archive-author",
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

  function futureIsoDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString();
  }

  const draft = createInitiativeDraft(steward, {
    title: "Lifecycle Archive Fixture Initiative",
    description: "Archive lifecycle verification initiative.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const published = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(author, {
    initiativeId: published.initiativeId,
    title: "Archive Analysis",
    summary: "Analysis for archive lifecycle verification.",
    supportingEvidence: "Evidence",
    risks: "Risk",
    suggestedImprovements: "Improve",
    references: "Ref",
  });
  publishInitiativeCollaborativeAnalysis(author, analysisDraft.analysisId);

  const proposalDraft = createInitiativeImprovementProposalDraft(author, {
    analysisId: analysisDraft.analysisId,
    targetSection: "Summary",
    currentIssue: "Issue",
    proposedChange: "Change",
    rationale: "Rationale",
    expectedImprovement: "Improvement",
    references: "References",
  });
  const submitted = submitInitiativeImprovementProposal(author, proposalDraft.proposalId);
  const decided = decideInitiativeImprovementProposal(steward, submitted.proposalId, {
    decision: "accepted",
    decisionNote: "Accepted for archive lifecycle verification.",
  });

  createInitiativeRevisionDraft(steward, published.initiativeId);
  saveInitiativeRevisionDraft(steward, published.initiativeId, {
    revisionSummary: "Archive lifecycle revision",
    appliedProposalIds: [decided.proposalId],
    skippedProposalIds: [],
  });
  publishInitiativeRevision(steward, published.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: published.initiativeId,
    title: "Archive Decision Session",
    purpose: "Decision for archive lifecycle verification",
    decisionQuestion: "Proceed?",
    opensAt: futureIsoDate(1),
    closesAt: futureIsoDate(14),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  const decisionDraft = createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId: published.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });
  const opened = openInitiativeCollectiveDecision(steward, decisionDraft.decisionId);
  await closeInitiativeCollectiveDecision(steward, opened.decisionId);

  const commitmentDraft = createInitiativeImplementationCommitmentDraft(steward, {
    initiativeId: published.initiativeId,
    decisionId: opened.decisionId,
    commitmentTitle: "Archive Commitment",
    commitmentSummary: "Commit to archive lifecycle verification.",
    commitmentScope: "Community scope.",
  });
  const commitment = publishInitiativeImplementationCommitment(
    steward,
    commitmentDraft.commitmentId,
  );

  const trackingDraft = createInitiativeImplementationTrackingDraft(steward, {
    commitmentId: commitment.commitmentId,
    summary: "Archive tracking",
    currentStage: "Implementation",
  });
  const tracking = activateInitiativeImplementationTracking(steward, trackingDraft.trackingId);
  addImplementationTrackingUpdate(steward, tracking.trackingId, {
    title: "Archive lifecycle update",
    summary: "Tracking update for archive lifecycle verification.",
    evidence: "https://example.org/archive-lifecycle-evidence",
  });
  completeInitiativeImplementationTracking(steward, tracking.trackingId);

  const impactDraft = createInitiativePublicImpactDraft(steward, {
    trackingId: tracking.trackingId,
    title: "Archive Verified Impact",
    summary: "Impact for archive lifecycle verification.",
    observedImpact: "Verified civic archive lifecycle outcome.",
    affectedCommunity: "Nelson Community Garden",
    evidenceSummary: "Evidence summary",
  });
  addPublicImpactEvidence(steward, impactDraft.impactId, {
    title: "Archive lifecycle evidence",
    description: "Evidence for archive lifecycle verification.",
    referenceUrl: "https://example.org/archive-lifecycle-evidence.pdf",
    referenceType: "document",
  });
  const impact = publishInitiativePublicImpact(steward, impactDraft.impactId);
  verifyInitiativePublicImpact(steward, impact.impactId);

  const archiveDraft = await createPublicCivicArchiveDraft(steward, {
    impactId: impact.impactId,
    title: "Lifecycle Archive Record",
    summary: "Documented civic archive lifecycle outcome.",
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
  publishPublicCivicArchive(steward, archiveDraft.archiveRecordId);

  return { initiativeId: published.initiativeId };
}

async function verifyLifecycleProjection(): Promise<void> {
  console.log("1. One initiative appears once with nested lifecycle");

  const { listCivicArchiveLifecycleRecords, getCivicArchiveLifecycleRecord } =
    await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

  const fixture = await seedArchiveFixture();
  const records = listCivicArchiveLifecycleRecords({ search: "Lifecycle Archive" });

  assert(records.length >= 1, "Archive index must return lifecycle records");
  assert(
    records.filter((record) => record.initiativeId === fixture.initiativeId).length === 1,
    "Each archived initiative must appear once",
  );

  const record = records.find((entry) => entry.initiativeId === fixture.initiativeId);
  assert(record !== undefined, "Fixture initiative must appear in archive index");
  assert(record.stages.length >= 3, "Lifecycle record must include nested stages");
  assert(
    record.stages.some((stage) => stage.stageId === "analysis"),
    "Lifecycle record must nest analysis stage",
  );
  assert(
    record.stages.some((stage) => stage.stageId === "archive"),
    "Lifecycle record must include archive stage",
  );
  assert(
    record.outcomeStatus === "completed",
    "Verified completed archive must label completed outcome",
  );

  const detail = getCivicArchiveLifecycleRecord(fixture.initiativeId);
  assert(
    detail?.initiativeId === fixture.initiativeId,
    "Detail lookup must resolve by initiativeId",
  );
  assert((detail?.stages.length ?? 0) >= 3, "Detail record must expose chronological lifecycle");
}

async function verifyCountsAndFilters(): Promise<void> {
  console.log("2. Filter counts use archived initiatives");

  const { listCivicArchiveLifecycleRecords, computeCivicArchiveLifecycleMetrics } =
    await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

  const records = listCivicArchiveLifecycleRecords({ search: "Lifecycle Archive" });
  const metrics = computeCivicArchiveLifecycleMetrics();

  assert(
    metrics.archivedInitiativeCount >= records.length,
    "Metrics must count archived initiatives",
  );
  assert(
    metrics.archivedInitiativeCount <= metrics.archiveRecordCount,
    "Initiative count must not exceed flat archive record count",
  );

  const completedOnly = listCivicArchiveLifecycleRecords({ outcomeStatus: "completed" });
  assert(
    completedOnly.every((record) => record.outcomeStatus === "completed"),
    "Outcome filter must restrict lifecycle records",
  );
}

async function verifyDraftExclusion(): Promise<void> {
  console.log("3. Draft and private records excluded from public lifecycle index");

  const { createInitiativeDraft } = await import("../modules/initiatives/initiative.service.js");
  const { listCivicArchiveLifecycleRecords } =
    await import("../modules/public-civic-archive/public-civic-archive-lifecycle.projection.js");

  const draftOnly = createInitiativeDraft(steward, {
    title: "Draft Archive Exclusion Initiative",
    description: "Must not appear in archive lifecycle index.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });

  const records = listCivicArchiveLifecycleRecords({ search: "Draft Archive Exclusion" });
  assert(
    !records.some((record) => record.initiativeId === draftOnly.initiativeId),
    "Draft initiatives must not appear in archive lifecycle index",
  );
}

function verifyUiAndLoading(): void {
  console.log("4. UI, loading route, and grid layout");

  const page = readRepoFile("apps/web/src/app/civic-archive/page.tsx");
  const loading = readRepoFile("apps/web/src/app/civic-archive/loading.tsx");
  const detail = readRepoFile("apps/web/src/app/civic-archive/[initiativeId]/page.tsx");
  const grid = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/CivicArchiveResultsGrid.tsx",
  );
  const css = readRepoFile(
    "apps/web/src/features/public-civic-archive/components/civic-archive-results.css",
  );
  const types = readRepoFile("packages/types/src/domain/civic-archive-lifecycle.ts");

  assert(page.includes("CivicArchiveResultsPanel"), "Archive page must render results panel.");
  assert(
    readRepoFile(
      "apps/web/src/features/public-civic-archive/components/CivicArchiveResultsPanel.tsx",
    ).includes("archivedInitiativeCount"),
    "Archive results panel must show initiative counts.",
  );
  assert(
    loading.includes("CivicArchiveResultsPanelSkeleton"),
    "Loading route must render results skeleton",
  );
  assert(
    detail.includes("CivicArchiveLifecycleTimeline"),
    "Detail page must render lifecycle timeline",
  );
  assert(grid.includes("PublicArchiveInitiativeCard"), "Grid must export archive card component.");
  assert(types.includes("CivicArchiveLifecycleRecord"), "Types must define lifecycle record");
  assert(css.includes("grid-template-columns: repeat(3"), "Desktop grid must remain 3 columns");
  assert(css.includes("repeat(2"), "Tablet grid must remain 2 columns");
  assert(css.includes("grid-template-columns: 1fr"), "Mobile grid must remain 1 column");
}

async function main(): Promise<void> {
  verifyUiAndLoading();
  await verifyLifecycleProjection();
  await verifyCountsAndFilters();
  await verifyDraftExclusion();
  console.log("Civic archive lifecycle verification passed.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
