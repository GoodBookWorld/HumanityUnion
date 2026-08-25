/**
 * Initiative Lifecycle — Part I (Intelligent Implementation Commitments)
 * end-to-end verification.
 *
 * Continues from a published Collective Decision (Part H) through the
 * Implementation Commitment's Generate / Save / Publish flow, and asserts
 * that individual Commitments unlock Implementation Tracking afterward and
 * that voluntary Accept/Decline works as designed.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-implementation-commitments-e2e.ts
 */
import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";
import {
  activateVerificationDatabaseIsolationAsync,
  assertVerificationDatabaseIsolated,
} from "./verification-database-isolation.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const steward: RequestIdentity = {
  participantId: "verify-implementation-commitment-steward-1",
  displayName: "Steward Verify",
};

const allyOne = "verify-implementation-commitment-ally-1";
const allyTwo = "verify-implementation-commitment-ally-2";

async function main(): Promise<void> {
  const isolation = await activateVerificationDatabaseIsolationAsync("PART-I-IMPLEMENTATION-COMMITMENTS");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-i-implementation-commitments-verify-${runSuffix}`;

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
    const { publishInitiativeCollectiveDecisionStage, generateInitiativeCollectiveDecisionDraft } =
      await import("../modules/initiative-collective-decision-lifecycle/index.js");
    const {
      buildInitiativeImplementationCommitmentIntelligenceSnapshot,
      generateInitiativeImplementationCommitmentDraft,
      getInitiativeImplementationCommitmentWorkspaceContext,
      saveInitiativeImplementationCommitmentDraft,
      publishInitiativeImplementationCommitmentStage,
      acceptInitiativeImplementationCommitment,
      declineInitiativeImplementationCommitment,
      listMyProposedInitiativeImplementationCommitments,
      getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId,
      getPackageByInitiativeId,
    } = await import("../modules/initiative-implementation-commitment-lifecycle/index.js");
    const { assessInitiativeImplementationTrackingEligibility } = await import(
      "../modules/initiative-implementation-tracking/initiative-implementation-tracking-eligibility.js"
    );
    const { listCommitmentsByParticipant, getCommitmentById } = await import(
      "../modules/initiative-implementation-commitment/initiative-implementation-commitment.store.js"
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
      "1. Seed Initiative + Allies through a published Collective Decision (Part H)",
    );
    const draft = createInitiativeDraft(steward, {
      title: "Part I Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Implementation Commitments vertical slice.",
      communitySlug: initiativeCommunitySlug,
      activityArea: "Environment",
    });
    const initiative = publishInitiative(steward, draft.initiativeId);
    initiativeId = initiative.initiativeId;

    await upsertAlly({
      initiativeId,
      participantId: allyOne,
      status: "active",
      requestedByParticipantId: allyOne,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await upsertAlly({
      initiativeId,
      participantId: allyTwo,
      status: "active",
      requestedByParticipantId: allyTwo,
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
    await publishInitiativePetitionStage(steward, initiativeId);

    await getInitiativeDecisionSessionWorkspaceContext(steward, initiativeId);
    await generateInitiativeDecisionSessionDraft(steward, initiativeId);
    saveInitiativeDecisionSessionDraft(steward, initiativeId, {
      decisionQuestion: "Should the city fund the compost pilot this fiscal year?",
      options: ["Approve pilot funding", "Approve with district limits", "Decline for now"],
    });
    await publishInitiativeDecisionSessionStage(steward, initiativeId);

    await generateInitiativeCollectiveDecisionDraft(steward, initiativeId);
    const closedDecision = await publishInitiativeCollectiveDecisionStage(steward, initiativeId);
    assert(closedDecision.status === "closed", "Collective Decision fixture must be closed.");
    console.log("   OK — upstream Collective Decision is closed and ready for Implementation Commitments.");

    console.log("2. Implementation Commitment Sources — Intelligence Snapshot cites the Collective Decision");
    const snapshot = await buildInitiativeImplementationCommitmentIntelligenceSnapshot(initiativeId);
    assert(
      snapshot.isCollectiveDecisionAvailable === true,
      "Snapshot must see the closed Collective Decision.",
    );
    assert(
      snapshot.decisionReference?.decisionId === closedDecision.decisionId,
      "Snapshot Collective Decision reference must match the published decision.",
    );
    assert(
      snapshot.decisionReference?.approvedActions.includes("Approve pilot funding") === true,
      "Snapshot must carry the Collective Decision's Approved Actions.",
    );
    assert(snapshot.activeAllyCount === 2, "Snapshot must count both Active Allies.");
    console.log("   OK — Implementation Commitment sources are real, read-only upstream records.");

    console.log("3. Workspace auto-provisions a draft once; Generate is deterministic, one Candidate per Action");
    const workspace = await getInitiativeImplementationCommitmentWorkspaceContext(steward, initiativeId);
    assert(workspace.draft !== null, "Working draft must auto-provision.");
    assert(workspace.publishedPackageId === null, "No Package has published yet.");

    const generated = await generateInitiativeImplementationCommitmentDraft(steward, initiativeId);
    const regenerated = await generateInitiativeImplementationCommitmentDraft(steward, initiativeId);
    assert(
      JSON.stringify(generated.candidates.map((candidate) => candidate.approvedAction)) ===
        JSON.stringify(regenerated.candidates.map((candidate) => candidate.approvedAction)),
      "Generate must be deterministic for unchanged sources.",
    );
    assert(
      generated.candidates.length === (snapshot.decisionReference?.approvedActions.length ?? 0),
      "Candidate count must equal the number of Approved Actions.",
    );
    assert(
      generated.candidates.every((candidate) =>
        snapshot.decisionReference!.approvedActions.includes(candidate.approvedAction),
      ),
      "No Candidate may cite an Action beyond the Collective Decision's approvedActions list.",
    );
    assert(
      generated.decisionId === closedDecision.decisionId,
      "Generated draft must cite the closed Collective Decision.",
    );

    console.log("4. Save Draft persists Author edits, including a proposed Participant");
    const [firstCandidate, secondCandidate] = generated.candidates;
    assert(firstCandidate !== undefined, "Fixture Collective Decision must have at least one Approved Action.");

    const saved = saveInitiativeImplementationCommitmentDraft(steward, initiativeId, {
      candidates: generated.candidates.map((candidate, index) =>
        index === 0
          ? { ...candidate, proposedParticipantId: allyOne }
          : index === 1
            ? { ...candidate, proposedParticipantId: allyTwo }
            : candidate,
      ),
    });
    assert(
      saved.candidates[0]?.proposedParticipantId === allyOne,
      "Author edits (proposed Participant) must persist.",
    );
    assert(
      getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(initiativeId)?.candidates[0]
        ?.proposedParticipantId === allyOne,
      "Saved draft must reload with Author edits.",
    );

    console.log("5. Implementation Tracking is ineligible before Implementation Commitment publication");
    const trackingEligibilityBefore = assessInitiativeImplementationTrackingEligibility(
      "commitment-does-not-exist",
      allyOne,
    );
    assert(
      trackingEligibilityBefore.eligible === false,
      "Implementation Tracking must stay locked before an Implementation Commitment exists.",
    );

    console.log("6. Publish — Package created, Commitments published, draft deleted, Tracking unlocks");
    const publishedPackage = await publishInitiativeImplementationCommitmentStage(steward, initiativeId, {
      resolveProposedParticipantExists: async () => true,
    });
    assert(publishedPackage.status === "published", "Published Package must be status=published.");
    assert(
      publishedPackage.decisionId === closedDecision.decisionId,
      "Package must cite the Collective Decision it was generated from.",
    );
    assert(
      publishedPackage.commitmentIds.length === generated.candidates.length,
      "Package must create exactly one Commitment per Candidate.",
    );
    assert(
      getInitiativeImplementationCommitmentLifecycleDraftByInitiativeId(initiativeId) === null,
      "Working draft must be deleted after publish.",
    );
    assert(
      getPackageByInitiativeId(initiativeId)?.packageId === publishedPackage.packageId,
      "Package must be retrievable by initiativeId as the latest published Package.",
    );

    const firstCommitmentId = publishedPackage.commitmentIds[0]!;
    const firstCommitment = getCommitmentById(firstCommitmentId);
    assert(firstCommitment !== null, "Published Commitment must be loadable by commitmentId.");
    assert(firstCommitment!.status === "published", "Published Commitment must have status=published.");
    assert(firstCommitment!.participantId === allyOne, "Commitment participantId must be the proposed Ally.");
    assert(firstCommitment!.proposalStatus === "proposed", "Commitment must start proposalStatus=proposed.");
    assert(firstCommitment!.packageId === publishedPackage.packageId, "Commitment must cite its Package.");
    assert(firstCommitment!.approvedAction === firstCandidate.approvedAction, "Commitment must cite its Approved Action verbatim.");
    assert(firstCommitment!.actionIndex === 0, "First Commitment must carry actionIndex 0.");

    console.log("7. Traceability cites the Collective Decision and Approved Action, nothing invented");
    assert(
      firstCommitment!.traceability?.decisionId === closedDecision.decisionId,
      "Traceability must cite the Collective Decision.",
    );
    assert(
      firstCommitment!.traceability?.approvedAction === firstCandidate.approvedAction,
      "Traceability must cite the exact Approved Action text.",
    );
    assert(
      firstCommitment!.traceability?.decisionSessionId === snapshot.decisionReference?.decisionSessionId,
      "Traceability must carry the Decision Session id through from the Collective Decision.",
    );

    const trackingEligibilityAfter = assessInitiativeImplementationTrackingEligibility(
      firstCommitmentId,
      allyOne,
    );
    assert(
      trackingEligibilityAfter.eligible === false,
      "Implementation Tracking must stay locked for a proposed Participant until they Accept.",
    );

    console.log("8. Ally Accept — proposalStatus flips, appears in listCommitmentsByParticipant(ally)");
    const accepted = await acceptInitiativeImplementationCommitment({ participantId: allyOne }, firstCommitmentId);
    assert(accepted.proposalStatus === "accepted", "Accept must flip proposalStatus to accepted.");
    assert(accepted.acceptedAt !== null && accepted.acceptedAt !== undefined, "Accept must stamp acceptedAt.");
    const allyCommitments = listCommitmentsByParticipant(allyOne);
    assert(
      allyCommitments.some((commitment) => commitment.commitmentId === firstCommitmentId),
      "Accepted Commitment must be listed under the Ally's own commitments.",
    );

    const trackingEligibilityAfterAccept = assessInitiativeImplementationTrackingEligibility(
      firstCommitmentId,
      allyOne,
    );
    assert(
      trackingEligibilityAfterAccept.eligible === true,
      "Implementation Tracking must unlock after Accept.",
    );

    const proposedForAllyTwo = await listMyProposedInitiativeImplementationCommitments({
      participantId: allyTwo,
    });
    assert(
      proposedForAllyTwo.some((commitment) => commitment.initiativeId === initiativeId),
      "Ally two must see their still-proposed Commitment in the proposed inbox.",
    );

    console.log("9. Ally Decline path on the second Commitment");
    if (publishedPackage.commitmentIds.length > 1) {
      const secondCommitmentId = publishedPackage.commitmentIds[1]!;
      const declined = await declineInitiativeImplementationCommitment(
        { participantId: allyTwo },
        secondCommitmentId,
      );
      assert(declined.proposalStatus === "declined", "Decline must flip proposalStatus to declined.");
      assert(
        declined.declinedAt !== null && declined.declinedAt !== undefined,
        "Decline must stamp declinedAt.",
      );
      assert(secondCandidate !== undefined, "Second Candidate must exist to exercise Decline.");
    } else {
      console.log("   (fixture Collective Decision has only one Approved Action — Decline path skipped)");
    }

    console.log("10. Lifecycle Stage Projection — Author/Guest, Implementation Tracking next");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "commitment",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.metadata.publishedRecordId === publishedPackage.packageId,
      "Author projection must reference the published Package record.",
    );
    assert(
      authorProjection?.metadata.version === publishedPackage.commitmentIds.length,
      "Author projection version must equal the number of published Commitments.",
    );
    assert(
      authorProjection?.nextStage?.stageId === "tracking",
      "Author projection next stage must be Implementation Tracking.",
    );
    assert(
      getNextInitiativeLifecycleStageId("commitment") === "tracking",
      "Lifecycle graph next stage after Implementation Commitment must be Implementation Tracking.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "commitment",
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

    console.log("11. Lifecycle notification fan-out — Allies notified once, Author excluded");
    clearDomainEventHandlers();
    const notificationRuns: Array<{ userId: string; relatedUrl: string }> = [];
    const now = new Date().toISOString();
    const fakeAllyIds = [allyOne, allyTwo];
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
      stageId: "commitment",
      stageLabel: "Implementation Commitment",
      stageArtifactId: publishedPackage.packageId,
      stageVersion: publishedPackage.commitmentIds.length,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#implementation-commitments`,
    });
    assert(
      publishOutcome.outcome === "duplicate_ignored",
      "Section 11's real Publish already enqueued this transition; retrying must be ignored.",
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
      notificationRuns.every((run) => run.relatedUrl.includes("#implementation-commitments")),
      "Notification must deep-link to the Implementation Commitment stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: `user-${allyOne}`,
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#implementation-commitments")),
      "The Active Ally's Notifications feed must contain the Implementation Commitment notification.",
    );

    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "commitment",
      stageLabel: "Implementation Commitment",
      stageArtifactId: publishedPackage.packageId,
      stageVersion: publishedPackage.commitmentIds.length,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#implementation-commitments`,
    });
    assert(retryOutcome.outcome === "duplicate_ignored", "Retry must never double-enqueue.");

    console.log("   OK — Active Allies notified once; Author excluded; Implementation Tracking unlocked.");
    console.log("All Initiative Lifecycle — Part I Implementation Commitments checks passed.");
  } finally {
    try {
      await isolation.dispose();
    } catch (isolationCleanupError) {
      console.warn(`Verification database cleanup warning: ${String(isolationCleanupError)}`);
    }
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
