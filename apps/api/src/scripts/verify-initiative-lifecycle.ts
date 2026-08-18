/**
 * Initiative Lifecycle golden-path verification (Phase 05A / Pack 01).
 *
 * Proves, against an isolated `hu_verify_*` Mongo database:
 *   1. STANDARD route with ZERO community participation (no comments,
 *      signatures, votes, allies, or community proposals) from Initiative
 *      creation through Civic Archive.
 *   2. PUBLIC_CHOICE route: Initiative → Discussion → Collective Decision →
 *      Archive (STANDARD-only stages stay NOT_APPLICABLE).
 *   3. Artifacts survive disconnect/reconnect + Mongo hydrate at selected
 *      checkpoints (analysis, revision, petition, collective decision).
 *
 * Isolation note: `activateVerificationDatabaseIsolationAsync` forces many
 * durable keys to `memory`. This golden path immediately overrides those
 * (and every `DURABLE_PERSISTENCE_ENV_KEYS` entry) back to `mongodb` so
 * lifecycle artifacts land in the isolated verification database.
 *
 * Run: pnpm --filter @hu/api verify:initiative-lifecycle
 *   or: tsx apps/api/src/scripts/verify-initiative-lifecycle.ts
 */
import type { InitiativeLifecycleProfile, InitiativeLifecycleStageId } from "@hu/types";
import { resolveInitiativeLifecycleState } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import { DURABLE_PERSISTENCE_ENV_KEYS } from "../config/production-persistence-contract.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  activateVerificationDatabaseIsolationAsync,
  assertVerificationDatabaseIsolated,
} from "./verification-database-isolation.js";

/**
 * Keys that verification isolation forces to memory. Duplicated here (not
 * exported from isolation) so this golden path can restore Mongo backing.
 */
const ISOLATION_MEMORY_PERSISTENCE_KEYS = [
  "INITIATIVE_PERSISTENCE",
  "INITIATIVE_ANALYSIS_PERSISTENCE",
  "INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE",
  "INITIATIVE_VERSION_REVISION_PERSISTENCE",
  "DECISION_SESSION_PERSISTENCE",
  "INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE",
  "INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE",
  "INITIATIVE_PUBLIC_IMPACT_PERSISTENCE",
  "PUBLIC_CIVIC_ARCHIVE_PERSISTENCE",
  "INITIATIVE_PETITION_DRAFT_PERSISTENCE",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function forceMongoDurablePersistence(): void {
  const uri = process.env.MONGODB_URI?.trim();
  assert(Boolean(uri), "MONGODB_URI is required for initiative-lifecycle golden-path Mongo proof.");

  for (const key of DURABLE_PERSISTENCE_ENV_KEYS) {
    process.env[key] = "mongodb";
  }
  for (const key of ISOLATION_MEMORY_PERSISTENCE_KEYS) {
    process.env[key] = "mongodb";
  }

  console.log(
    `   persistence override — ${String(DURABLE_PERSISTENCE_ENV_KEYS.length)} durable keys + isolation memory keys → mongodb`,
  );
}

async function flushLifecycleMongoWrites(): Promise<void> {
  const [
    { flushInitiativeMongoPersistence },
    { flushInitiativeCollaborativeAnalysisMongoPersistence },
    { flushInitiativeImprovementProposalMongoPersistence },
    { flushInitiativeVersionRevisionMongoPersistence },
    { flushDecisionSessionMongoPersistence },
    { flushInitiativeCollectiveDecisionMongoPersistence },
    { flushInitiativeDiscussionCompletionMongoPersistence },
    { flushInitiativePetitionDraftMongoPersistence },
    { flushInitiativeImplementationCommitmentMongoPersistence },
    { flushInitiativeImplementationCommitmentPackageMongoPersistence },
    { flushInitiativeImplementationTrackingMongoPersistence },
    { flushInitiativeImplementationTrackingPackageMongoPersistence },
    { flushInitiativeOfficialResponsePackageMongoPersistence },
    { flushInitiativePublicImpactReportMongoPersistence },
    { flushInitiativeCivicArchiveVersionMongoPersistence },
  ] = await Promise.all([
    import("../modules/initiatives/persistence/initiative-mongo.persistence.js"),
    import(
      "../modules/initiative-collaborative-analysis/persistence/initiative-collaborative-analysis-mongo.persistence.js"
    ),
    import(
      "../modules/initiative-improvement-proposal/persistence/initiative-improvement-proposal-mongo.persistence.js"
    ),
    import(
      "../modules/initiative-version-revision/persistence/initiative-version-revision-mongo.persistence.js"
    ),
    import("../modules/decision-session/persistence/decision-session-mongo.persistence.js"),
    import(
      "../modules/initiative-collective-decision/persistence/initiative-collective-decision-mongo.persistence.js"
    ),
    import(
      "../modules/initiative-discussion-lifecycle/persistence/initiative-discussion-completion-mongo.persistence.js"
    ),
    import(
      "../modules/initiative-petition-lifecycle/persistence/initiative-petition-draft-mongo.persistence.js"
    ),
    import(
      "../modules/initiative-implementation-commitment/persistence/initiative-implementation-commitment-mongo.persistence.js"
    ),
    import(
      "../modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js"
    ),
    import(
      "../modules/initiative-implementation-tracking/persistence/initiative-implementation-tracking-mongo.persistence.js"
    ),
    import(
      "../modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js"
    ),
    import(
      "../modules/initiative-official-response-lifecycle/initiative-official-response-package.store.js"
    ),
    import("../modules/initiative-public-impact-lifecycle/initiative-public-impact-report.store.js"),
    import("../modules/initiative-civic-archive-lifecycle/initiative-civic-archive-version.store.js"),
  ]);

  await Promise.all([
    flushInitiativeMongoPersistence(),
    flushInitiativeCollaborativeAnalysisMongoPersistence(),
    flushInitiativeImprovementProposalMongoPersistence(),
    flushInitiativeVersionRevisionMongoPersistence(),
    flushDecisionSessionMongoPersistence(),
    flushInitiativeCollectiveDecisionMongoPersistence(),
    flushInitiativeDiscussionCompletionMongoPersistence(),
    flushInitiativePetitionDraftMongoPersistence(),
    flushInitiativeImplementationCommitmentMongoPersistence(),
    flushInitiativeImplementationCommitmentPackageMongoPersistence(),
    flushInitiativeImplementationTrackingMongoPersistence(),
    flushInitiativeImplementationTrackingPackageMongoPersistence(),
    flushInitiativeOfficialResponsePackageMongoPersistence(),
    flushInitiativePublicImpactReportMongoPersistence(),
    flushInitiativeCivicArchiveVersionMongoPersistence(),
  ]);
}

async function reconnectAndHydrateFromMongo(): Promise<void> {
  const { disconnectMongoClient } = await import("../infrastructure/mongodb/mongo-connection.js");
  // Drain chained snapshot writes, then one event-loop turn for late saves
  // (notifications/outbox) that enqueue after the first flush wave settles.
  await flushLifecycleMongoWrites();
  await flushLifecycleMongoWrites();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await flushLifecycleMongoWrites();
  await disconnectMongoClient().catch(() => undefined);

  const { bootstrapMongoPersistence } = await import(
    "../infrastructure/mongodb/bootstrap-mongo-persistence.js"
  );
  await bootstrapMongoPersistence();
}

async function resolveLifecycleSnapshot(
  initiativeId: string,
  lifecycleProfile: InitiativeLifecycleProfile,
): Promise<{
  currentStageId: InitiativeLifecycleStageId;
  completedStageIds: readonly InitiativeLifecycleStageId[];
  notApplicableStageIds: readonly InitiativeLifecycleStageId[];
  stageCounts: Map<string, number>;
}> {
  const { getInitiativeById } = await import("../modules/initiatives/initiative.store.js");
  const { toPublicInitiativeProjection } = await import(
    "../modules/initiatives/public-initiative.projection.js"
  );
  const { buildStageRecords } = await import(
    "../modules/initiatives/public-initiative-experience.service.js"
  );

  const initiative = getInitiativeById(initiativeId);
  assert(initiative !== null, `Initiative ${initiativeId} must exist for lifecycle resolve.`);
  assert(
    initiative!.lifecycleProfile === lifecycleProfile ||
      (!initiative!.lifecycleProfile && lifecycleProfile === "STANDARD"),
    `Initiative lifecycleProfile must be ${lifecycleProfile}.`,
  );

  const publicInitiative = await toPublicInitiativeProjection(initiative!);
  const { records } = await buildStageRecords(initiative!, publicInitiative);
  const stageCounts = new Map<string, number>();
  for (const [stageId, items] of records.entries()) {
    stageCounts.set(stageId, items.length);
  }
  if ((stageCounts.get("initiative") ?? 0) === 0) {
    stageCounts.set("initiative", 1);
  }

  const state = resolveInitiativeLifecycleState({
    lifecycleProfile,
    publishedStageCounts: stageCounts,
  });

  return {
    currentStageId: state.currentStageId,
    completedStageIds: state.completedStageIds,
    notApplicableStageIds: state.notApplicableStageIds,
    stageCounts,
  };
}

async function assertCurrentStage(
  initiativeId: string,
  lifecycleProfile: InitiativeLifecycleProfile,
  expectedCurrent: InitiativeLifecycleStageId,
  label: string,
): Promise<void> {
  const snapshot = await resolveLifecycleSnapshot(initiativeId, lifecycleProfile);
  assert(
    snapshot.currentStageId === expectedCurrent,
    `${label}: expected currentStageId=${expectedCurrent}, got ${snapshot.currentStageId}`,
  );
  console.log(`   OK — ${label}: current=${snapshot.currentStageId}`);
}

async function provePersistenceCheckpoint(
  label: string,
  initiativeId: string,
  lifecycleProfile: InitiativeLifecycleProfile,
  expectedCurrent: InitiativeLifecycleStageId,
  extraProbe?: () => Promise<void> | void,
): Promise<void> {
  console.log(`   persistence checkpoint — ${label} (disconnect/reconnect + hydrate)`);
  await reconnectAndHydrateFromMongo();
  await assertCurrentStage(initiativeId, lifecycleProfile, expectedCurrent, `${label} after reconnect`);
  if (extraProbe) {
    await extraProbe();
  }
  console.log(`   OK — ${label} survived Mongo reconnect`);
}

async function runStandardZeroCommunityPath(
  steward: RequestIdentity,
  communitySlug: string,
): Promise<string> {
  console.log("\n=== STANDARD golden path (zero community participation) ===");

  const { createInitiativeDraft, publishInitiative } = await import(
    "../modules/initiatives/initiative.service.js"
  );
  const { getInitiativeById } = await import("../modules/initiatives/initiative.store.js");
  const { completeInitiativeDiscussionStage } = await import(
    "../modules/initiative-discussion-lifecycle/initiative-discussion-lifecycle.service.js"
  );
  const {
    createInitiativeCollaborativeAnalysisDraft,
    generateInitiativeCollaborativeAnalysisDraft,
    publishInitiativeCollaborativeAnalysis,
  } = await import(
    "../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js"
  );
  const {
    generateImprovementProposalsDraft,
    publishImprovementProposalsCollection,
  } = await import(
    "../modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.service.js"
  );
  const {
    createInitiativeRevisionDraft,
    saveInitiativeRevisionDraft,
    publishInitiativeRevisionStage,
  } = await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
  const {
    generateInitiativePetitionDraft,
    publishInitiativePetitionStage,
    getInitiativePetitionWorkspaceContext,
  } = await import(
    "../modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js"
  );
  const {
    generateInitiativeDecisionSessionDraft,
    getInitiativeDecisionSessionWorkspaceContext,
    publishInitiativeDecisionSessionStage,
    saveInitiativeDecisionSessionDraft,
  } = await import("../modules/initiative-decision-session-lifecycle/index.js");
  const { generateInitiativeCollectiveDecisionDraft, publishInitiativeCollectiveDecisionStage } =
    await import("../modules/initiative-collective-decision-lifecycle/index.js");
  const {
    generateInitiativeImplementationCommitmentDraft,
    saveInitiativeImplementationCommitmentDraft,
    publishInitiativeImplementationCommitmentStage,
    acceptInitiativeImplementationCommitment,
  } = await import("../modules/initiative-implementation-commitment-lifecycle/index.js");
  const {
    generateInitiativeImplementationTrackingDraft,
    getInitiativeImplementationTrackingWorkspaceContext,
    saveInitiativeImplementationTrackingDraft,
    publishInitiativeImplementationTrackingStage,
    updateInitiativeImplementationTrackingProgress,
  } = await import("../modules/initiative-implementation-tracking-lifecycle/index.js");
  const { listTrackingsByInitiative } = await import(
    "../modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js"
  );
  const {
    generateInitiativeOfficialResponseDraft,
    saveInitiativeOfficialResponseDraft,
    publishInitiativeOfficialResponseStage,
  } = await import("../modules/initiative-official-response-lifecycle/index.js");
  const { generateInitiativePublicImpactDraft, publishInitiativePublicImpactStage } = await import(
    "../modules/initiative-public-impact-lifecycle/index.js"
  );
  const {
    generateInitiativeCivicArchiveDraft,
    getInitiativeCivicArchiveWorkspaceContext,
    publishInitiativeCivicArchiveStage,
  } = await import("../modules/initiative-civic-archive-lifecycle/index.js");
  const { getPetitionByInitiativeId } = await import("../modules/petition/petition.store.js");
  const { getDecisionById } = await import(
    "../modules/initiative-collective-decision/initiative-collective-decision.store.js"
  );

  // No allies, comments, signatures, or votes — steward-only progression.
  console.log("1. Create + publish STANDARD Initiative");
  const draft = createInitiativeDraft(steward, {
    title: "Golden Path STANDARD Zero-Community Lifecycle",
    description:
      "Author-only progression fixture. No community comments, signatures, votes, or allies.",
    communitySlug,
    activityArea: "Environment",
    lifecycleProfile: "STANDARD",
  });
  const initiative = publishInitiative(steward, draft.initiativeId);
  const initiativeId = initiative.initiativeId;
  await assertCurrentStage(initiativeId, "STANDARD", "discussion", "after Initiative publish");

  console.log("2. Complete Discussion (Author marker only — no comments)");
  await completeInitiativeDiscussionStage(steward, initiativeId);
  await assertCurrentStage(initiativeId, "STANDARD", "analysis", "after Discussion complete");

  console.log("3. Collaborative Analysis (empty community sources)");
  await createInitiativeCollaborativeAnalysisDraft(steward, {
    initiativeId,
    title: "Placeholder title",
    summary: "Placeholder summary",
    supportingEvidence: "Placeholder evidence",
    risks: "Placeholder risks",
    suggestedImprovements: "Placeholder improvements",
    references: "Placeholder references",
  });
  const generatedAnalysis = await generateInitiativeCollaborativeAnalysisDraft(steward, initiativeId);
  const publishedAnalysis = await publishInitiativeCollaborativeAnalysis(
    steward,
    generatedAnalysis.analysisId,
  );
  assert(publishedAnalysis.status === "published", "Analysis must publish.");
  await assertCurrentStage(initiativeId, "STANDARD", "proposal", "after Analysis publish");
  await provePersistenceCheckpoint("after analysis", initiativeId, "STANDARD", "proposal", async () => {
    const { listPublishedAnalysesByInitiative } = await import(
      "../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js"
    );
    assert(
      listPublishedAnalysesByInitiative(initiativeId).some(
        (analysis) => analysis.analysisId === publishedAnalysis.analysisId,
      ),
      "Published Analysis must reload from Mongo after reconnect.",
    );
  });

  console.log(
    "4. Improvement Proposals — explicitly complete stage with ZERO proposals (no fabricated author proposal)",
  );
  const proposalCollection = await generateImprovementProposalsDraft(steward, initiativeId);
  assert(
    proposalCollection.proposals.length === 0,
    "Zero-community path must start with an empty Improvement Proposals collection.",
  );
  const publishedProposalCollection = await publishImprovementProposalsCollection(
    steward,
    proposalCollection.collectionId,
  );
  assert(
    publishedProposalCollection.status === "published",
    "Improvement Proposals stage must publish even with zero proposals.",
  );
  await assertCurrentStage(initiativeId, "STANDARD", "revision", "after zero-proposal stage complete");

  console.log("5. Revision (no applied proposals)");
  const liveInitiative = getInitiativeById(initiativeId)!;
  createInitiativeRevisionDraft(steward, initiativeId);
  saveInitiativeRevisionDraft(steward, initiativeId, {
    title: liveInitiative.title,
    description: liveInitiative.description,
    revisionSummary: "Author-only revision after explicitly completing Improvement Proposals with zero proposals.",
    appliedProposalIds: [],
  });
  await publishInitiativeRevisionStage(steward, initiativeId);
  await assertCurrentStage(initiativeId, "STANDARD", "petition", "after Revision publish");
  await provePersistenceCheckpoint("after revision", initiativeId, "STANDARD", "petition");

  console.log("6. Petition (publish Open with zero signatures)");
  await getInitiativePetitionWorkspaceContext(steward, initiativeId);
  await generateInitiativePetitionDraft(steward, initiativeId);
  const petition = await publishInitiativePetitionStage(steward, initiativeId);
  assert(petition.status === "Open", "Petition must open for signatures (zero signed is valid).");
  assert(
    (await getPetitionByInitiativeId(initiativeId))?.petitionId === petition.petitionId,
    "Published Petition must be loadable by Initiative.",
  );
  await assertCurrentStage(initiativeId, "STANDARD", "decision_session", "after Petition publish");
  await provePersistenceCheckpoint("after petition", initiativeId, "STANDARD", "decision_session", async () => {
    const reloaded = await getPetitionByInitiativeId(initiativeId);
    assert(reloaded?.petitionId === petition.petitionId, "Petition must survive Mongo reconnect.");
    assert(
      (reloaded?.signatures ?? []).filter((signature) => signature.status === "Active").length === 0,
      "Zero-community path must keep zero Active signatures.",
    );
  });

  console.log("7. Decision Session");
  await getInitiativeDecisionSessionWorkspaceContext(steward, initiativeId);
  await generateInitiativeDecisionSessionDraft(steward, initiativeId);
  saveInitiativeDecisionSessionDraft(steward, initiativeId, {
    decisionQuestion: "Should this author-only pilot proceed?",
    options: ["Approve", "Approve with limits", "Decline for now"],
  });
  const publishedSession = await publishInitiativeDecisionSessionStage(steward, initiativeId);
  assert(publishedSession.status === "published", "Decision Session must publish.");
  await assertCurrentStage(
    initiativeId,
    "STANDARD",
    "collective_decision",
    "after Decision Session publish",
  );

  console.log("8. Collective Decision (zero votes — publish closes with structured outcome)");
  await generateInitiativeCollectiveDecisionDraft(steward, initiativeId);
  const closedDecision = await publishInitiativeCollectiveDecisionStage(steward, initiativeId);
  assert(closedDecision.status === "closed", "Collective Decision must close on publish.");
  assert(
    getDecisionById(closedDecision.decisionId)?.status === "closed",
    "Closed Collective Decision must be store-readable.",
  );
  await assertCurrentStage(initiativeId, "STANDARD", "commitment", "after Collective Decision publish");
  await provePersistenceCheckpoint(
    "after collective decision",
    initiativeId,
    "STANDARD",
    "commitment",
    () => {
      assert(
        getDecisionById(closedDecision.decisionId)?.status === "closed",
        "Collective Decision must survive Mongo reconnect.",
      );
    },
  );

  console.log(
    "9. Implementation Commitments — propose to steward (self), accept (not community volunteers)",
  );
  const generatedCommitmentDraft = await generateInitiativeImplementationCommitmentDraft(
    steward,
    initiativeId,
  );
  saveInitiativeImplementationCommitmentDraft(steward, initiativeId, {
    candidates: generatedCommitmentDraft.candidates.map((candidate) => ({
      ...candidate,
      proposedParticipantId: steward.participantId,
    })),
  });
  const publishedCommitmentPackage = await publishInitiativeImplementationCommitmentStage(
    steward,
    initiativeId,
  );
  assert(
    publishedCommitmentPackage.commitmentIds.length > 0,
    "Commitment package must publish at least one commitment.",
  );
  for (const commitmentId of publishedCommitmentPackage.commitmentIds) {
    await acceptInitiativeImplementationCommitment(steward, commitmentId);
  }
  await assertCurrentStage(initiativeId, "STANDARD", "tracking", "after Commitment publish/accept");

  console.log("10. Implementation Tracking");
  await getInitiativeImplementationTrackingWorkspaceContext(steward, initiativeId);
  const generatedTrackingDraft = await generateInitiativeImplementationTrackingDraft(
    steward,
    initiativeId,
  );
  saveInitiativeImplementationTrackingDraft(steward, initiativeId, {
    candidates: generatedTrackingDraft.candidates,
  });
  await publishInitiativeImplementationTrackingStage(steward, initiativeId);
  const trackings = listTrackingsByInitiative(initiativeId);
  assert(trackings.length > 0, "Tracking records must exist after publish.");
  const firstTracking = trackings[0]!;
  await updateInitiativeImplementationTrackingProgress(steward, firstTracking.trackingId, {
    progress: 100,
    currentStatus: "Completed",
    evidenceReferences: ["https://example.com/author-only-proof"],
  });
  await assertCurrentStage(initiativeId, "STANDARD", "official_response", "after Tracking publish");

  console.log("11. Official Responses");
  const generatedOfficialResponse = await generateInitiativeOfficialResponseDraft(
    steward,
    initiativeId,
  );
  saveInitiativeOfficialResponseDraft(steward, initiativeId, {
    candidates: generatedOfficialResponse.candidates.map((candidate, index) => ({
      ...candidate,
      institution: index === 0 ? "Author Verification Office" : candidate.institution || "Partner Org",
      organization: index === 0 ? "" : candidate.organization || "Verification Alliance",
    })),
  });
  await publishInitiativeOfficialResponseStage(steward, initiativeId);
  await assertCurrentStage(initiativeId, "STANDARD", "public_impact", "after Official Response publish");

  console.log("12. Public Impact");
  await generateInitiativePublicImpactDraft(steward, initiativeId);
  await publishInitiativePublicImpactStage(steward, initiativeId);
  await assertCurrentStage(initiativeId, "STANDARD", "archive", "after Public Impact publish");

  console.log("13. Civic Archive");
  await getInitiativeCivicArchiveWorkspaceContext(steward, initiativeId);
  await generateInitiativeCivicArchiveDraft(steward, initiativeId);
  const archive = await publishInitiativeCivicArchiveStage(steward, initiativeId);
  assert(archive.archiveVersion === 1, "First Archive publish must be version 1.");
  await assertCurrentStage(initiativeId, "STANDARD", "archive", "after Archive publish");

  console.log("   PASS — STANDARD zero-community path reached Civic Archive.");
  return initiativeId;
}

async function runPublicChoicePath(
  steward: RequestIdentity,
  communitySlug: string,
): Promise<string> {
  console.log("\n=== PUBLIC_CHOICE golden path ===");
  console.log(
    "   Route: Initiative → Discussion → Collective Decision → Archive.",
    "No Decision Session substrate. No Public Impact substrate.",
  );

  const { createInitiativeDraft, publishInitiative } = await import(
    "../modules/initiatives/initiative.service.js"
  );
  const { completeInitiativeDiscussionStage } = await import(
    "../modules/initiative-discussion-lifecycle/initiative-discussion-lifecycle.service.js"
  );
  const { generateInitiativeCollectiveDecisionDraft, publishInitiativeCollectiveDecisionStage } =
    await import("../modules/initiative-collective-decision-lifecycle/index.js");
  const {
    generateInitiativeCivicArchiveDraft,
    getInitiativeCivicArchiveWorkspaceContext,
    publishInitiativeCivicArchiveStage,
  } = await import("../modules/initiative-civic-archive-lifecycle/index.js");
  const { getDecisionById } = await import(
    "../modules/initiative-collective-decision/initiative-collective-decision.store.js"
  );

  console.log("1. Create + publish PUBLIC_CHOICE Initiative");
  const draft = createInitiativeDraft(steward, {
    title: "Golden Path PUBLIC_CHOICE Lifecycle",
    description: "Public Choice route fixture — Discussion then Collective Decision then Archive.",
    communitySlug,
    activityArea: "Governance",
    lifecycleProfile: "PUBLIC_CHOICE",
  });
  const initiative = publishInitiative(steward, draft.initiativeId);
  const initiativeId = initiative.initiativeId;
  await assertCurrentStage(initiativeId, "PUBLIC_CHOICE", "discussion", "after Initiative publish");

  const afterPublish = await resolveLifecycleSnapshot(initiativeId, "PUBLIC_CHOICE");
  for (const stageId of [
    "analysis",
    "proposal",
    "revision",
    "petition",
    "decision_session",
    "commitment",
    "tracking",
    "official_response",
    "public_impact",
  ] as const) {
    assert(
      afterPublish.notApplicableStageIds.includes(stageId),
      `PUBLIC_CHOICE must mark ${stageId} NOT_APPLICABLE.`,
    );
  }
  console.log("   OK — STANDARD-only stages are NOT_APPLICABLE on PUBLIC_CHOICE.");

  console.log("2. Complete Discussion");
  await completeInitiativeDiscussionStage(steward, initiativeId);
  await assertCurrentStage(
    initiativeId,
    "PUBLIC_CHOICE",
    "collective_decision",
    "after Discussion complete",
  );

  console.log("3. Collective Decision (no Decision Session substrate; zero votes)");
  await generateInitiativeCollectiveDecisionDraft(steward, initiativeId);
  const closedDecision = await publishInitiativeCollectiveDecisionStage(steward, initiativeId);
  assert(closedDecision.status === "closed", "PUBLIC_CHOICE Collective Decision must close.");
  assert(
    closedDecision.decisionSessionId === null,
    "PUBLIC_CHOICE Collective Decision must not require a Decision Session id.",
  );
  assert(
    getDecisionById(closedDecision.decisionId)?.status === "closed",
    "PUBLIC_CHOICE Collective Decision must be store-readable.",
  );
  await assertCurrentStage(
    initiativeId,
    "PUBLIC_CHOICE",
    "archive",
    "after Collective Decision publish",
  );

  console.log("4. Civic Archive (no Public Impact substrate)");
  await getInitiativeCivicArchiveWorkspaceContext(steward, initiativeId);
  await generateInitiativeCivicArchiveDraft(steward, initiativeId);
  const archive = await publishInitiativeCivicArchiveStage(steward, initiativeId);
  assert(archive.archiveVersion === 1, "PUBLIC_CHOICE Archive publish must be version 1.");
  assert(
    archive.publicImpactReportId === null,
    "PUBLIC_CHOICE Archive must not require a Public Impact Report id.",
  );
  await assertCurrentStage(initiativeId, "PUBLIC_CHOICE", "archive", "after Archive publish");

  const finalSnap = await resolveLifecycleSnapshot(initiativeId, "PUBLIC_CHOICE");
  assert(
    finalSnap.notApplicableStageIds.includes("petition"),
    "Petition must remain NOT_APPLICABLE after PUBLIC_CHOICE Archive.",
  );
  assert(
    finalSnap.completedStageIds.includes("collective_decision"),
    "Collective Decision must be completed on PUBLIC_CHOICE.",
  );
  assert(
    finalSnap.completedStageIds.includes("archive") || finalSnap.currentStageId === "archive",
    "Archive must be current/completed on PUBLIC_CHOICE.",
  );

  console.log("   PASS — PUBLIC_CHOICE path reached Civic Archive.");
  return initiativeId;
}

async function main(): Promise<void> {
  let isolation: Awaited<ReturnType<typeof activateVerificationDatabaseIsolationAsync>> | null =
    null;
  let failed = false;

  try {
    isolation = await activateVerificationDatabaseIsolationAsync("GOLDEN-LIFECYCLE");
    assertVerificationDatabaseIsolated();
    forceMongoDurablePersistence();
    console.log(`Owned verification database: ${isolation.databaseName}`);

    const { connectMongoClient } = await import("../infrastructure/mongodb/mongo-connection.js");
    const { ensureMongoIndexes } = await import("../infrastructure/mongodb/mongo-indexes.js");
    await connectMongoClient();
    await ensureMongoIndexes();

    // Prefer full hydrate so Mongo adapters bind after the mongodb overrides.
    const { bootstrapMongoPersistence } = await import(
      "../infrastructure/mongodb/bootstrap-mongo-persistence.js"
    );
    await bootstrapMongoPersistence();

    const runSuffix = isolation.runId;
    const steward: RequestIdentity = {
      participantId: `verify-lifecycle-steward-${runSuffix}`,
      displayName: "Lifecycle Golden Steward",
    };

    await runStandardZeroCommunityPath(steward, `golden-standard-verify-${runSuffix}`);
    await runPublicChoicePath(steward, `golden-public-choice-verify-${runSuffix}`);

    console.log("\n========================================");
    console.log("PASS — verify:initiative-lifecycle");
    console.log("  STANDARD zero-community → Archive");
    console.log("  PUBLIC_CHOICE → Archive");
    console.log("  Mongo persistence checkpoints OK");
    console.log("========================================");
  } catch (error) {
    failed = true;
    console.error("\n========================================");
    console.error("FAIL — verify:initiative-lifecycle");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("========================================");
    throw error;
  } finally {
    if (isolation) {
      try {
        await isolation.dispose();
        if (!failed) {
          console.log("   OK — verification database disposed.");
        }
      } catch (cleanupError) {
        console.warn(`Verification database cleanup warning: ${String(cleanupError)}`);
      }
    }
  }
}

await runVerificationScript(main);
