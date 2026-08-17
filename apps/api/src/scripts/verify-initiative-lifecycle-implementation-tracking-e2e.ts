/**
 * Initiative Lifecycle — Part J (Intelligent Implementation Tracking)
 * end-to-end verification.
 *
 * Continues from a published Implementation Commitment Package (Part I)
 * through the Implementation Tracking's Generate / Save / Publish flow,
 * asserts traceability back to the Accepted Commitments, exercises the
 * responsible Participant's own continuous progress updates (and that the
 * Author can never perform them on the Participant's behalf), and
 * confirms Official Responses unlocks next.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-implementation-tracking-e2e.ts
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
  participantId: "verify-implementation-tracking-steward-1",
  displayName: "Steward Verify",
};

const allyOne = "verify-implementation-tracking-ally-1";
const allyTwo = "verify-implementation-tracking-ally-2";

async function main(): Promise<void> {
  const isolation = await activateVerificationDatabaseIsolationAsync("PART-J-IMPLEMENTATION-TRACKING");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-j-implementation-tracking-verify-${runSuffix}`;

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
      generateInitiativeImplementationCommitmentDraft,
      saveInitiativeImplementationCommitmentDraft,
      publishInitiativeImplementationCommitmentStage,
      acceptInitiativeImplementationCommitment,
    } = await import("../modules/initiative-implementation-commitment-lifecycle/index.js");
    const {
      buildInitiativeImplementationTrackingIntelligenceSnapshot,
      generateInitiativeImplementationTrackingDraft,
      getInitiativeImplementationTrackingWorkspaceContext,
      saveInitiativeImplementationTrackingDraft,
      publishInitiativeImplementationTrackingStage,
      updateInitiativeImplementationTrackingProgress,
      listMyActiveInitiativeImplementationTrackings,
      getInitiativeImplementationTrackingLifecycleDraftByInitiativeId,
      getPackageByInitiativeId,
    } = await import("../modules/initiative-implementation-tracking-lifecycle/index.js");
    const { getTrackingById, listTrackingsByInitiative } = await import(
      "../modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js"
    );
    const { insertAuthUser, findAuthUserByMemberId } = await import(
      "../modules/auth/auth-user.repository.js"
    );
    const { listMyReminders } = await import("../modules/reminders/reminder.service.js");
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
      "1. Seed Initiative + Allies through a published Implementation Commitment Package (Part I), both Accepted",
    );
    const draft = createInitiativeDraft(steward, {
      title: "Part J Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Implementation Tracking vertical slice.",
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
    await publishInitiativeCollectiveDecisionStage(steward, initiativeId);

    const generatedCommitmentDraft = await generateInitiativeImplementationCommitmentDraft(
      steward,
      initiativeId,
    );
    assert(
      generatedCommitmentDraft.candidates.length >= 2,
      "Fixture Collective Decision must produce at least 2 Commitment Candidates.",
    );
    saveInitiativeImplementationCommitmentDraft(steward, initiativeId, {
      candidates: generatedCommitmentDraft.candidates.map((candidate, index) =>
        index === 0
          ? { ...candidate, proposedParticipantId: allyOne }
          : index === 1
            ? { ...candidate, proposedParticipantId: allyTwo }
            : candidate,
      ),
    });
    const publishedCommitmentPackage = await publishInitiativeImplementationCommitmentStage(
      steward,
      initiativeId,
    );
    assert(
      publishedCommitmentPackage.commitmentIds.length >= 2,
      "Published Commitment Package must have at least 2 Commitments.",
    );

    const firstCommitmentId = publishedCommitmentPackage.commitmentIds[0]!;
    const secondCommitmentId = publishedCommitmentPackage.commitmentIds[1]!;
    const acceptedFirst = await acceptInitiativeImplementationCommitment(
      { participantId: allyOne },
      firstCommitmentId,
    );
    const acceptedSecond = await acceptInitiativeImplementationCommitment(
      { participantId: allyTwo },
      secondCommitmentId,
    );
    assert(acceptedFirst.proposalStatus === "accepted", "First Commitment must be Accepted.");
    assert(acceptedSecond.proposalStatus === "accepted", "Second Commitment must be Accepted.");
    console.log("   OK — Implementation Commitment Package published with 2 Accepted Commitments.");

    console.log("2. Implementation Tracking Sources — Intelligence Snapshot cites Accepted Commitments");
    const snapshot = await buildInitiativeImplementationTrackingIntelligenceSnapshot(initiativeId);
    assert(
      snapshot.isCommitmentPackageAvailable === true,
      "Snapshot must see the published Commitment Package with Accepted Commitments.",
    );
    assert(
      snapshot.packageReference?.packageId === publishedCommitmentPackage.packageId,
      "Snapshot Commitment Package reference must match the published package.",
    );
    assert(snapshot.acceptedCommitments.length === 2, "Snapshot must cite exactly 2 Accepted Commitments.");
    assert(
      snapshot.acceptedCommitments.every((commitment) => commitment.proposalStatus === "accepted"),
      "Snapshot must only cite Accepted Commitments, never proposed/declined ones.",
    );
    assert(snapshot.activeAllyCount === 2, "Snapshot must count both Active Allies.");
    console.log("   OK — Implementation Tracking sources are real, read-only upstream records.");

    await insertAuthUser(
      { email: `ally-one-${runSuffix}@example.com`, password: "Password1!", displayName: "Ally One" },
      allyOne,
    );
    await insertAuthUser(
      { email: `ally-two-${runSuffix}@example.com`, password: "Password1!", displayName: "Ally Two" },
      allyTwo,
    );
    await insertAuthUser(
      { email: `steward-${runSuffix}@example.com`, password: "Password1!", displayName: "Steward Verify" },
      steward.participantId,
    );

    console.log("3. Workspace auto-provisions a draft once; Generate is deterministic, one Candidate per Accepted Commitment");
    const workspace = await getInitiativeImplementationTrackingWorkspaceContext(steward, initiativeId);
    assert(workspace.draft !== null, "Working draft must auto-provision.");
    assert(workspace.publishedPackageId === null, "No Tracking Package has published yet.");

    const generated = await generateInitiativeImplementationTrackingDraft(steward, initiativeId);
    const regenerated = await generateInitiativeImplementationTrackingDraft(steward, initiativeId);
    assert(
      JSON.stringify(generated.candidates.map((candidate) => candidate.commitmentId)) ===
        JSON.stringify(regenerated.candidates.map((candidate) => candidate.commitmentId)),
      "Generate must be deterministic for unchanged sources.",
    );
    assert(
      generated.candidates.length === snapshot.acceptedCommitments.length,
      "Candidate count must equal the number of Accepted Commitments.",
    );
    assert(
      generated.candidates.every((candidate) =>
        snapshot.acceptedCommitments.some((commitment) => commitment.commitmentId === candidate.commitmentId),
      ),
      "No Candidate may cite a Commitment beyond the snapshot's own acceptedCommitments list.",
    );
    assert(
      generated.candidates.every((candidate) => candidate.currentStatus === "Preparation" && candidate.progress === 0),
      "Every generated Candidate must start Preparation at 0% progress.",
    );
    assert(
      generated.packageId === publishedCommitmentPackage.packageId,
      "Generated draft must cite the published Commitment Package.",
    );

    console.log("4. Save Draft persists Author edits");
    const saved = saveInitiativeImplementationTrackingDraft(steward, initiativeId, {
      candidates: generated.candidates.map((candidate) => ({ ...candidate, notes: "Kickoff scheduled." })),
    });
    assert(saved.candidates[0]?.notes === "Kickoff scheduled.", "Author edits (notes) must persist.");
    assert(
      getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(initiativeId)?.candidates[0]?.notes ===
        "Kickoff scheduled.",
      "Saved draft must reload with Author edits.",
    );

    console.log("5. Publish — Tracking Package created, Tracking Records active, draft deleted");
    const publishedTrackingPackage = await publishInitiativeImplementationTrackingStage(
      steward,
      initiativeId,
    );
    assert(
      publishedTrackingPackage.status === "published",
      "Published Tracking Package must be status=published.",
    );
    assert(
      publishedTrackingPackage.commitmentPackageId === publishedCommitmentPackage.packageId,
      "Tracking Package must cite the Commitment Package it was generated from.",
    );
    assert(
      publishedTrackingPackage.trackingIds.length === generated.candidates.length,
      "Tracking Package must create exactly one Tracking Record per Candidate.",
    );
    assert(
      getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(initiativeId) === null,
      "Working draft must be deleted after publish.",
    );
    assert(
      getPackageByInitiativeId(initiativeId)?.packageId === publishedTrackingPackage.packageId,
      "Tracking Package must be retrievable by initiativeId as the latest published package.",
    );

    const trackings = listTrackingsByInitiative(initiativeId);
    assert(trackings.length === 2, "Exactly 2 Tracking Records must exist.");
    assert(
      trackings.every((tracking) => tracking.status === "active"),
      "Every published Tracking Record must start status=active.",
    );

    const firstTracking = trackings.find((tracking) => tracking.commitmentId === firstCommitmentId);
    assert(firstTracking !== undefined, "First Tracking Record must cite the first Commitment.");
    assert(firstTracking!.participantId === allyOne, "First Tracking Record participantId must be Ally One.");
    assert(
      firstTracking!.packageId === publishedTrackingPackage.packageId,
      "Tracking Record must cite its Tracking Package.",
    );

    console.log("6. Traceability cites the Commitment id and Approved Action, nothing invented");
    assert(
      firstTracking!.traceability?.commitmentId === firstCommitmentId,
      "Traceability must cite the Commitment id.",
    );
    assert(
      firstTracking!.traceability?.commitmentPackageId === publishedCommitmentPackage.packageId,
      "Traceability must cite the Commitment Package id.",
    );
    assert(
      firstTracking!.traceability?.approvedAction === acceptedFirst.approvedAction,
      "Traceability must cite the exact Approved Action text.",
    );
    assert(
      firstTracking!.traceability?.decisionId === acceptedFirst.decisionId,
      "Traceability must carry the Collective Decision id through from the Commitment.",
    );

    console.log("7. Ally updates their own progress; the Author can never update an Ally's Tracking on their behalf");
    const updatedByAlly = await updateInitiativeImplementationTrackingProgress(
      { participantId: allyOne },
      firstTracking!.trackingId,
      { progress: 40, currentStatus: "In Progress", notes: "Site survey complete." },
    );
    assert(updatedByAlly.progress === 40, "Ally's own progress update must persist.");
    assert(updatedByAlly.currentStage === "In Progress", "Ally's own status update must persist.");

    let stewardUpdateRejected = false;
    try {
      await updateInitiativeImplementationTrackingProgress(steward, firstTracking!.trackingId, {
        progress: 90,
      });
    } catch {
      stewardUpdateRejected = true;
    }
    assert(
      stewardUpdateRejected,
      "The Author must never update an Ally's own Tracking progress on their behalf.",
    );
    assert(
      getTrackingById(firstTracking!.trackingId)?.progress === 40,
      "Rejected Author update must never mutate the Tracking Record.",
    );

    const myActiveForAllyOne = listMyActiveInitiativeImplementationTrackings({
      participantId: allyOne,
    });
    assert(
      myActiveForAllyOne.some((tracking) => tracking.trackingId === firstTracking!.trackingId),
      "Ally One's active Tracking inbox must include their own Tracking Record.",
    );

    console.log("8. Completing a Tracking Record requires at least one Evidence Reference");
    let missingEvidenceRejected = false;
    try {
      await updateInitiativeImplementationTrackingProgress(
        { participantId: allyOne },
        firstTracking!.trackingId,
        { progress: 100 },
      );
    } catch {
      missingEvidenceRejected = true;
    }
    assert(
      missingEvidenceRejected,
      "Marking a Tracking Record complete without Evidence References must be rejected.",
    );

    const completed = await updateInitiativeImplementationTrackingProgress(
      { participantId: allyOne },
      firstTracking!.trackingId,
      { progress: 100, evidenceReferences: ["https://example.com/proof.jpg"] },
    );
    assert(completed.status === "completed", "A 100% progress update with Evidence must complete the Tracking Record.");
    assert(completed.completedAt !== undefined, "Completing a Tracking Record must stamp completedAt.");

    console.log("9. Lifecycle Stage Projection — Author/Guest, Official Responses next");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "tracking",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.metadata.publishedRecordId === publishedTrackingPackage.packageId,
      "Author projection must reference the published Tracking Package record.",
    );
    assert(
      authorProjection?.metadata.version === publishedTrackingPackage.trackingIds.length,
      "Author projection version must equal the number of published Tracking Records.",
    );
    assert(
      authorProjection?.nextStage?.stageId === "official_response",
      "Author projection next stage must be Official Responses.",
    );
    assert(
      getNextInitiativeLifecycleStageId("tracking") === "official_response",
      "Lifecycle graph next stage after Implementation Tracking must be Official Responses.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "tracking",
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

    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "tracking",
      stageLabel: "Implementation Tracking",
      stageArtifactId: publishedTrackingPackage.packageId,
      stageVersion: publishedTrackingPackage.trackingIds.length,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#implementation-tracking`,
    });
    assert(
      retryOutcome.outcome === "duplicate_ignored",
      "Publish already enqueued this transition inside the service; retrying must be ignored.",
    );

    const outboxDocument = await getMongoCollection<{ envelope: string; eventName: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: retryOutcome.event.eventId });
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
      notificationRuns.every((run) => run.relatedUrl.includes("#implementation-tracking")),
      "Notification must deep-link to the Implementation Tracking stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: `user-${allyOne}`,
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#implementation-tracking")),
      "The Active Ally's Notifications feed must contain the Implementation Tracking notification.",
    );

    console.log("11. Reminder candidates created for Allies and responsible Participants on publish");
    const allyOneAuthUser = await findAuthUserByMemberId(allyOne);
    assert(allyOneAuthUser !== null, "Ally One's Auth User fixture must exist.");

    const allyOneReminders = await listMyReminders({
      userId: allyOneAuthUser!.userId,
      status: "all",
    });
    assert(
      allyOneReminders.reminders.some((reminder) => reminder.relatedEntityId === publishedTrackingPackage.packageId),
      "Ally One must have received a 'Tracking published' Reminder candidate.",
    );
    assert(
      allyOneReminders.reminders.some(
        (reminder) => reminder.relatedEntityId === `${publishedTrackingPackage.packageId}:progress-request`,
      ),
      "Ally One must have received a 'Progress update requested' Reminder candidate.",
    );

    console.log("   OK — Active Allies notified once; Author excluded; Reminder candidates created; Official Responses unlocked.");
    console.log("All Initiative Lifecycle — Part J Implementation Tracking checks passed.");
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
