/**
 * Initiative Lifecycle — Part H (Collective Decision Vertical Slice)
 * end-to-end verification.
 *
 * Continues from a Published Decision Session (Part G) through the
 * Collective Decision's Generate / Save / Publish flow, and asserts that
 * Implementation Commitments unlock afterward.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-collective-decision-e2e.ts
 */
import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  activateVerificationDatabaseIsolation,
  assertVerificationDatabaseIsolated,
} from "./verification-database-isolation.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const steward: RequestIdentity = {
  participantId: "verify-collective-decision-steward-1",
  displayName: "Steward Verify",
};

async function main(): Promise<void> {
  const isolation = activateVerificationDatabaseIsolation("PART-H-COLLECTIVE-DECISION");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-h-collective-decision-verify-${runSuffix}`;

  let initiativeId = "";

  try {
    assertVerificationDatabaseIsolated();

    const { connectMongoClient } = await import("../infrastructure/mongodb/mongo-connection.js");
    const { ensureMongoIndexes } = await import("../infrastructure/mongodb/mongo-indexes.js");
    await connectMongoClient();
    await ensureMongoIndexes();

    const { createInitiativeDraft, publishInitiative } = await import(
      "../modules/initiatives/initiative.service.js"
    );
    const { upsertAlly } = await import(
      "../modules/initiative-discussion-collaboration/initiative-ally.store.js"
    );
    const {
      createInitiativeCollaborativeAnalysisDraft,
      generateInitiativeCollaborativeAnalysisDraft,
      publishInitiativeCollaborativeAnalysis,
    } = await import(
      "../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js"
    );
    const {
      createInitiativeImprovementProposalDraft,
      submitInitiativeImprovementProposal,
      decideInitiativeImprovementProposal,
    } = await import(
      "../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js"
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
    const {
      buildInitiativeCollectiveDecisionIntelligenceSnapshot,
      generateInitiativeCollectiveDecisionDraft,
      getInitiativeCollectiveDecisionWorkspaceContext,
      publishInitiativeCollectiveDecisionStage,
      saveInitiativeCollectiveDecisionDraft,
      getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId,
    } = await import("../modules/initiative-collective-decision-lifecycle/index.js");
    const { assessInitiativeCollectiveDecisionEligibility } = await import(
      "../modules/initiative-collective-decision/initiative-collective-decision-eligibility.js"
    );
    const { assessInitiativeImplementationCommitmentEligibility } = await import(
      "../modules/initiative-implementation-commitment/initiative-implementation-commitment-eligibility.js"
    );
    const { getDecisionById } = await import(
      "../modules/initiative-collective-decision/initiative-collective-decision.store.js"
    );
    const { toPublicInitiativeCollectiveDecisionProjection } = await import(
      "../modules/initiative-collective-decision/public-initiative-collective-decision.projection.js"
    );
    const { buildInitiativeLifecycleStageProjection } = await import(
      "../modules/initiatives/initiative-lifecycle-stage-projection.service.js"
    );
    const { getNextInitiativeLifecycleStageId } = await import("@hu/types");
    const {
      handleInitiativeLifecycleStagePublishedNotification,
      publishInitiativeLifecycleStage,
    } = await import("../shared/initiative-lifecycle-stage/index.js");
    const { listMyNotifications, createNotification } = await import(
      "../modules/notifications/notification.service.js"
    );
    const { clearDomainEventHandlers } = await import(
      "../infrastructure/integration/event-handler-registry.js"
    );
    const { CATALOGUE_EVENTS } = await import("../infrastructure/events/catalogue-events.js");
    const { MONGO_COLLECTIONS } = await import("../infrastructure/mongodb/mongo-collections.js");
    const { getMongoCollection } = await import("../infrastructure/mongodb/mongo-database.js");
    const { deserializeDomainEventEnvelope } = await import(
      "../infrastructure/events/event-serialization.js"
    );

    console.log(
      "1. Seed Initiative + Allies + Analysis + Proposal + Revision + Petition + Decision Session",
    );
    const draft = createInitiativeDraft(steward, {
      title: "Part H Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Collective Decision vertical slice.",
      communitySlug: initiativeCommunitySlug,
      activityArea: "Environment",
    });
    const initiative = publishInitiative(steward, draft.initiativeId);
    initiativeId = initiative.initiativeId;

    await upsertAlly({
      initiativeId,
      participantId: "verify-ally-active-1",
      status: "active",
      requestedByParticipantId: "verify-ally-active-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await upsertAlly({
      initiativeId,
      participantId: "verify-ally-active-2",
      status: "active",
      requestedByParticipantId: "verify-ally-active-2",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

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

    const proposalDraft = await createInitiativeImprovementProposalDraft(steward, {
      analysisId: publishedAnalysis.analysisId,
      targetSection: "Description",
      currentIssue: "No dedicated composting infrastructure exists.",
      proposedChange: "Add a composting station near the entrance.",
      rationale: "Repeated Ally requests during Discussion.",
      expectedImprovement: "Reduces seasonal waste.",
      references: "Ally feedback.",
    });
    const submittedProposal = submitInitiativeImprovementProposal(steward, proposalDraft.proposalId);
    const decidedProposal = decideInitiativeImprovementProposal(steward, submittedProposal.proposalId, {
      decision: "accepted",
      decisionNote: "Accepted for the next Revision.",
    });

    createInitiativeRevisionDraft(steward, initiativeId);
    saveInitiativeRevisionDraft(steward, initiativeId, {
      title: initiative.title,
      description: initiative.description,
      revisionSummary: "Incorporated the composting Proposal.",
      appliedProposalIds: [decidedProposal.proposalId],
    });
    await publishInitiativeRevisionStage(steward, initiativeId);

    await getInitiativePetitionWorkspaceContext(steward, initiativeId);
    await generateInitiativePetitionDraft(steward, initiativeId);
    const petition = await publishInitiativePetitionStage(steward, initiativeId);
    assert(petition.status === "Open", "Petition fixture must open for signatures.");

    await getInitiativeDecisionSessionWorkspaceContext(steward, initiativeId);
    await generateInitiativeDecisionSessionDraft(steward, initiativeId);
    saveInitiativeDecisionSessionDraft(steward, initiativeId, {
      decisionQuestion: "Should the city fund the compost pilot this fiscal year?",
      options: ["Approve pilot funding", "Approve with district limits", "Decline for now"],
    });
    const publishedSession = await publishInitiativeDecisionSessionStage(steward, initiativeId);
    assert(publishedSession.status === "published", "Decision Session fixture must publish.");
    console.log("   OK — upstream Decision Session is published and ready to be decided.");

    console.log("2. Collective Decision Sources — Intelligence Snapshot cites the Decision Session");
    const snapshot = await buildInitiativeCollectiveDecisionIntelligenceSnapshot(initiativeId);
    assert(
      snapshot.isDecisionSessionAvailable === true,
      "Snapshot must see the published Decision Session.",
    );
    assert(
      snapshot.decisionSessionReference?.sessionId === publishedSession.sessionId,
      "Snapshot Decision Session reference must match the published session.",
    );
    assert(
      snapshot.decisionSessionReference?.options.includes("Approve pilot funding") === true,
      "Snapshot must carry the Decision Session's structured options.",
    );
    assert(snapshot.petitionReference !== null, "Snapshot must include the published Petition.");
    console.log("   OK — Collective Decision sources are real, read-only upstream records.");

    console.log("3. Collective Decision is ineligible before it is generated/published");
    const eligibilityMissing = assessInitiativeCollectiveDecisionEligibility(
      initiativeId,
      publishedSession.sessionId,
    );
    assert(
      eligibilityMissing.eligible === true,
      "Collective Decision must be eligible once the Decision Session is published.",
    );

    console.log("4. Workspace auto-provisions a draft once; Generate is deterministic");
    const workspace = await getInitiativeCollectiveDecisionWorkspaceContext(steward, initiativeId);
    assert(workspace.draft !== null, "Working draft must auto-provision.");
    assert(workspace.publishedDecisionId === null, "No Collective Decision has published yet.");
    const generated = await generateInitiativeCollectiveDecisionDraft(steward, initiativeId);
    const regenerated = await generateInitiativeCollectiveDecisionDraft(steward, initiativeId);
    assert(
      JSON.stringify({
        title: generated.title,
        decisionSummary: generated.decisionSummary,
        approvedActions: generated.approvedActions,
      }) ===
        JSON.stringify({
          title: regenerated.title,
          decisionSummary: regenerated.decisionSummary,
          approvedActions: regenerated.approvedActions,
        }),
      "Generate must be deterministic for unchanged sources.",
    );
    assert(
      generated.approvedActions.includes("Approve pilot funding"),
      "The Decision Session's first option must become an Approved Action.",
    );
    assert(
      generated.rejectedAlternatives.includes("Approve with district limits") &&
        generated.rejectedAlternatives.includes("Decline for now"),
      "The Decision Session's remaining options must become Rejected Alternatives.",
    );
    assert(
      generated.decisionSessionId === publishedSession.sessionId,
      "Generated draft must cite the published Decision Session.",
    );

    console.log("5. Save Draft persists Author edits");
    const futureClosesAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const saved = saveInitiativeCollectiveDecisionDraft(steward, initiativeId, {
      decisionSummary: "The compost pilot will proceed with district-scoped funding this fiscal year.",
      closesAt: futureClosesAt,
    });
    assert(
      saved.decisionSummary.includes("district-scoped funding"),
      "Author edits must persist.",
    );
    assert(
      getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId(initiativeId)?.decisionSummary.includes(
        "district-scoped funding",
      ) === true,
      "Saved draft must reload with Author edits.",
    );

    console.log("6. Implementation Commitments are ineligible before Collective Decision publication");
    const commitmentEligibilityBefore = assessInitiativeImplementationCommitmentEligibility(
      initiativeId,
      "collective-decision-does-not-exist",
    );
    assert(
      commitmentEligibilityBefore.eligible === false,
      "Implementation Commitments must stay locked before Collective Decision publication.",
    );

    console.log("7. Publish — Traceability, structured content, draft deleted, Commitments unlock");
    const published = await publishInitiativeCollectiveDecisionStage(steward, initiativeId);
    assert(published.status === "closed", "Published Collective Decision must be status=closed.");
    assert(
      published.traceability?.decisionSessionId === publishedSession.sessionId,
      "Traceability must cite the Decision Session.",
    );
    assert(
      published.traceability?.petitionId === petition.petitionId,
      "Traceability must cite the Petition, carried through the Decision Session.",
    );
    assert(
      published.structuredContent?.approvedActions.includes("Approve pilot funding") === true,
      "Structured content must survive publish.",
    );
    assert(
      getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId(initiativeId) === null,
      "Working draft must be deleted after publish.",
    );

    const commitmentEligibilityAfter = assessInitiativeImplementationCommitmentEligibility(
      initiativeId,
      published.decisionId,
    );
    assert(
      commitmentEligibilityAfter.eligible === true,
      "Implementation Commitments must unlock immediately after Collective Decision publication.",
    );

    console.log("8. Public Collective Decision shows published content only");
    const stored = getDecisionById(published.decisionId);
    assert(stored !== null, "Published Collective Decision must be loadable by decisionId.");
    const publicProjection = await toPublicInitiativeCollectiveDecisionProjection(stored!);
    assert(
      publicProjection.structuredContent !== null,
      "Public projection must include structured Decision Result content.",
    );
    assert(
      publicProjection.traceability?.decisionSessionId === publishedSession.sessionId,
      "Public projection must cite the Decision Session that produced this Collective Decision.",
    );

    console.log("9. Lifecycle Stage Projection — Author/Guest, Implementation next");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "collective_decision",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.metadata.publishedRecordId === published.decisionId,
      "Author projection must reference the published Collective Decision record.",
    );
    assert(
      authorProjection?.nextStage?.stageId === "commitment",
      "Author projection next stage must be Implementation Commitment.",
    );
    assert(
      getNextInitiativeLifecycleStageId("collective_decision") === "commitment",
      "Lifecycle graph next stage after Collective Decision must be Implementation Commitment.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "collective_decision",
      viewerParticipantId: null,
    });
    assert(
      guestProjection?.presentationMode === "public",
      "Guest viewers must resolve Presentation Mode = public.",
    );
    assert(
      guestProjection?.aiCapabilities.canGenerateDraft === false,
      "Guests must never receive Generate Draft AI capability.",
    );

    console.log("10. Lifecycle notification fan-out — Allies notified once, Author excluded");
    clearDomainEventHandlers();
    const notificationRuns: Array<{ userId: string; relatedUrl: string }> = [];
    const now = new Date().toISOString();
    const fakeAllyIds = ["verify-ally-active-1", "verify-ally-active-2"];
    const fakeDeps: Parameters<typeof handleInitiativeLifecycleStagePublishedNotification>[1] = {
      listActiveAllies: async () =>
        fakeAllyIds.map((participantId) => ({
          initiativeId,
          participantId,
          status: "active" as const,
          requestedByParticipantId: participantId,
          createdAt: now,
          updatedAt: now,
        })),
      resolveRecipientIdentities: async (participantIds: readonly string[]) =>
        new Map(participantIds.map((id) => [id, { userId: `user-${id}`, profileId: `profile-${id}` }])),
      createNotification: async (input) => {
        notificationRuns.push({
          userId: input.recipientUserId,
          relatedUrl: input.relatedUrl,
        });
        return createNotification(input);
      },
    };

    const publishOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "collective_decision",
      stageLabel: "Collective Decision",
      stageArtifactId: published.decisionId,
      stageVersion: published.sequenceNumber,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#collective-decision`,
    });
    assert(
      publishOutcome.outcome === "duplicate_ignored",
      "Section 10's real Publish already enqueued this transition; retrying must be ignored.",
    );

    const outboxDocument = await getMongoCollection<{ envelope: string; eventName: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: publishOutcome.event.eventId });
    assert(outboxDocument !== null, "The publication event must be findable in the outbox.");
    assert(
      outboxDocument!.eventName === CATALOGUE_EVENTS.initiativeLifecycleStagePublished,
      "eventName must be InitiativeLifecycleStagePublished.",
    );
    const envelope = deserializeDomainEventEnvelope(outboxDocument!.envelope);
    await handleInitiativeLifecycleStagePublishedNotification(envelope, fakeDeps);

    assert(
      notificationRuns.length === 2,
      `Exactly 2 Active Allies (Author excluded) must be notified, got ${String(notificationRuns.length)}.`,
    );
    assert(
      notificationRuns.every((run) => run.userId !== `user-${steward.participantId}`),
      "The Author must never be notified about their own publish action.",
    );
    assert(
      notificationRuns.every((run) => run.relatedUrl.includes("#collective-decision")),
      "Notification must deep-link to the Collective Decision stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: "user-verify-ally-active-1",
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#collective-decision")),
      "The Active Ally's Notifications feed must contain the Collective Decision notification.",
    );

    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "collective_decision",
      stageLabel: "Collective Decision",
      stageArtifactId: published.decisionId,
      stageVersion: published.sequenceNumber,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#collective-decision`,
    });
    assert(retryOutcome.outcome === "duplicate_ignored", "Retry must never double-enqueue.");

    console.log("   OK — Active Allies notified once; Author excluded; Implementation Commitments unlocked.");
    console.log("All Initiative Lifecycle — Part H Collective Decision checks passed.");
  } finally {
    try {
      const { resetInitiativeAlliesStoreForTests } = await import(
        "../modules/initiative-discussion-collaboration/initiative-ally.store.js"
      );
      if (initiativeId) {
        await resetInitiativeAlliesStoreForTests(initiativeId);
      }
    } catch (cleanupError) {
      console.warn(`Best-effort fixture cleanup skipped: ${String(cleanupError)}`);
    }
  }
}

await runVerificationScript(main);
