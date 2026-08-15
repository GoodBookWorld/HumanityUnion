/**
 * Initiative Lifecycle — Part K (Intelligent Official Responses)
 * end-to-end verification.
 *
 * Continues from a published Implementation Tracking Package (Part J)
 * through the Official Responses Generate / Save / Publish flow, asserts
 * traceability back to the Tracking Records/Commitments/Approved Actions,
 * confirms the pre-existing CAP/delivery TASK-041 `OfficialResponse`
 * domain is left untouched, and confirms Public Impact unlocks next.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-official-responses-e2e.ts
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
  participantId: "verify-official-response-steward-1",
  displayName: "Steward Verify",
};

const allyOne = "verify-official-response-ally-1";
const allyTwo = "verify-official-response-ally-2";

async function main(): Promise<void> {
  const isolation = activateVerificationDatabaseIsolation("PART-K-OFFICIAL-RESPONSES");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-k-official-responses-verify-${runSuffix}`;

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
      buildInitiativeOfficialResponseIntelligenceSnapshot,
      generateInitiativeOfficialResponseDraft,
      getInitiativeOfficialResponseWorkspaceContext,
      saveInitiativeOfficialResponseDraft,
      publishInitiativeOfficialResponseStage,
      listPublishedPackageResponses,
      listPublishedInitiativeOfficialResponses,
      getInitiativeOfficialResponseLifecycleDraftByInitiativeId,
      getPackageByInitiativeId,
    } = await import("../modules/initiative-official-response-lifecycle/index.js");
    const { listPublicOfficialResponsesForInitiative } = await import(
      "../modules/official-response/official-response.projection.js"
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
      "1. Seed Initiative through a published Implementation Tracking Package (Part J), one Tracking Record completed",
    );
    const draft = createInitiativeDraft(steward, {
      title: "Part K Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Official Responses vertical slice.",
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
    const firstCommitmentId = publishedCommitmentPackage.commitmentIds[0]!;
    const secondCommitmentId = publishedCommitmentPackage.commitmentIds[1]!;
    const acceptedFirst = await acceptInitiativeImplementationCommitment(
      { participantId: allyOne },
      firstCommitmentId,
    );
    await acceptInitiativeImplementationCommitment({ participantId: allyTwo }, secondCommitmentId);

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

    await getInitiativeImplementationTrackingWorkspaceContext(steward, initiativeId);
    const generatedTrackingDraft = await generateInitiativeImplementationTrackingDraft(
      steward,
      initiativeId,
    );
    saveInitiativeImplementationTrackingDraft(steward, initiativeId, {
      candidates: generatedTrackingDraft.candidates,
    });
    const publishedTrackingPackage = await publishInitiativeImplementationTrackingStage(
      steward,
      initiativeId,
    );
    assert(
      publishedTrackingPackage.trackingIds.length === 2,
      "Published Tracking Package must have exactly 2 Tracking Records.",
    );

    const trackings = listTrackingsByInitiative(initiativeId);
    const firstTracking = trackings.find((tracking) => tracking.commitmentId === firstCommitmentId)!;
    await updateInitiativeImplementationTrackingProgress({ participantId: allyOne }, firstTracking.trackingId, {
      progress: 100,
      currentStatus: "Completed",
      evidenceReferences: ["https://example.com/proof.jpg"],
    });
    console.log(
      "   OK — Implementation Tracking Package published with 2 Tracking Records, first one Completed with Evidence.",
    );

    console.log("2. Official Response Sources — Intelligence Snapshot cites the Tracking Package");
    const snapshot = await buildInitiativeOfficialResponseIntelligenceSnapshot(initiativeId);
    assert(
      snapshot.isTrackingPackageAvailable === true,
      "Snapshot must see the published Tracking Package.",
    );
    assert(
      snapshot.trackingPackageReference?.packageId === publishedTrackingPackage.packageId,
      "Snapshot Tracking Package reference must match the published package.",
    );
    assert(snapshot.trackingRecords.length === 2, "Snapshot must cite exactly 2 Tracking Records.");
    assert(snapshot.completedCommitmentCount >= 1, "Snapshot must count at least 1 completed Tracking.");
    assert(snapshot.activeAllyCount === 2, "Snapshot must count both Active Allies.");
    console.log("   OK — Official Response sources are real, read-only upstream records.");

    console.log(
      "3. Workspace auto-provisions a draft once; Generate is deterministic, one Candidate per eligible Tracking Record",
    );
    const workspace = await getInitiativeOfficialResponseWorkspaceContext(steward, initiativeId);
    assert(workspace.draft !== null, "Working draft must auto-provision.");
    assert(workspace.publishedPackageId === null, "No Official Response Package has published yet.");

    const generated = await generateInitiativeOfficialResponseDraft(steward, initiativeId);
    const regenerated = await generateInitiativeOfficialResponseDraft(steward, initiativeId);
    assert(
      JSON.stringify(generated.candidates.map((candidate) => candidate.relatedTrackingIds)) ===
        JSON.stringify(regenerated.candidates.map((candidate) => candidate.relatedTrackingIds)),
      "Generate must be deterministic for unchanged sources.",
    );
    assert(generated.candidates.length === 2, "Candidate count must equal the number of eligible Tracking Records.");
    assert(
      generated.candidates.every((candidate) => candidate.institution === "" && candidate.organization === ""),
      "Generated Candidates must never invent an institution or organization name.",
    );
    assert(
      generated.trackingPackageId === publishedTrackingPackage.packageId,
      "Generated draft must cite the published Tracking Package.",
    );

    console.log("4. Save Draft persists Author edits with institution/organization filled in");
    const saved = saveInitiativeOfficialResponseDraft(steward, initiativeId, {
      candidates: generated.candidates.map((candidate, index) => ({
        ...candidate,
        institution: index === 0 ? "City Sustainability Office" : "",
        organization: index === 0 ? "" : "Regional Composting Alliance",
      })),
    });
    assert(
      saved.candidates[0]?.institution === "City Sustainability Office",
      "Author edits (institution) must persist.",
    );
    assert(
      getInitiativeOfficialResponseLifecycleDraftByInitiativeId(initiativeId)?.candidates[0]?.institution ===
        "City Sustainability Office",
      "Saved draft must reload with Author edits.",
    );

    console.log("5. Publish — Official Response Package created, Response Records published, draft deleted");
    const publishedResponsePackage = await publishInitiativeOfficialResponseStage(steward, initiativeId);
    assert(publishedResponsePackage.status === "published", "Published Response Package must be status=published.");
    assert(
      publishedResponsePackage.trackingPackageId === publishedTrackingPackage.packageId,
      "Response Package must cite the Tracking Package it was generated from.",
    );
    assert(
      publishedResponsePackage.responseIds.length === saved.candidates.length,
      "Response Package must create exactly one Response Record per Candidate.",
    );
    assert(
      getInitiativeOfficialResponseLifecycleDraftByInitiativeId(initiativeId) === null,
      "Working draft must be deleted after publish.",
    );
    assert(
      getPackageByInitiativeId(initiativeId)?.packageId === publishedResponsePackage.packageId,
      "Response Package must be retrievable by initiativeId as the latest published package.",
    );

    const responses = listPublishedPackageResponses(publishedResponsePackage.packageId);
    assert(responses.length === 2, "Exactly 2 Response Records must exist.");
    const firstResponse = responses.find((response) =>
      response.relatedCommitmentIds.includes(firstCommitmentId),
    );
    assert(firstResponse !== undefined, "First Response Record must cite the first Commitment.");
    assert(
      firstResponse!.institution === "City Sustainability Office",
      "First Response Record must carry the Author-entered institution.",
    );

    console.log("6. Traceability cites the Tracking/Commitment/Approved Action, nothing invented");
    assert(
      firstResponse!.traceability.trackingPackageId === publishedTrackingPackage.packageId,
      "Traceability must cite the Tracking Package id.",
    );
    assert(
      firstResponse!.traceability.relatedCommitmentIds.includes(firstCommitmentId),
      "Traceability must cite the Commitment id.",
    );
    assert(
      firstResponse!.traceability.relatedTrackingIds.includes(firstTracking.trackingId),
      "Traceability must cite the Tracking id.",
    );
    assert(
      Boolean(acceptedFirst.approvedAction) &&
        firstResponse!.traceability.relatedActions.includes(acceptedFirst.approvedAction!),
      "Traceability must cite the exact Approved Action text.",
    );
    assert(
      firstResponse!.traceability.decisionId === acceptedFirst.decisionId,
      "Traceability must carry the Collective Decision id through from the Commitment.",
    );

    console.log("7. Public Package is readable; CAP/delivery TASK-041 OfficialResponse domain is unchanged");
    const publicResponses = listPublishedInitiativeOfficialResponses(initiativeId);
    assert(publicResponses.length === 2, "Public list must return every published Response Record.");
    const capOfficialResponses = listPublicOfficialResponsesForInitiative(initiativeId);
    assert(
      capOfficialResponses.length === 0,
      "The pre-existing CAP OfficialResponse domain must remain completely untouched by Part K's publish.",
    );

    console.log("8. Lifecycle Stage Projection — Author/Guest, Public Impact next");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "official_response",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.metadata.publishedRecordId === publishedResponsePackage.packageId,
      "Author projection must reference the published Response Package record.",
    );
    assert(
      authorProjection?.metadata.version === publishedResponsePackage.responseIds.length,
      "Author projection version must equal the number of published Response Records.",
    );
    assert(
      authorProjection?.nextStage?.stageId === "public_impact",
      "Author projection next stage must be Public Impact.",
    );
    assert(
      getNextInitiativeLifecycleStageId("official_response") === "public_impact",
      "Lifecycle graph next stage after Official Responses must be Public Impact.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "official_response",
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

    console.log("9. Lifecycle notification fan-out — Allies notified once, Author excluded");
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
      stageId: "official_response",
      stageLabel: "Official Responses",
      stageArtifactId: publishedResponsePackage.packageId,
      stageVersion: publishedResponsePackage.responseIds.length,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#official-responses`,
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
      notificationRuns.every((run) => run.relatedUrl.includes("#official-responses")),
      "Notification must deep-link to the Official Responses stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: `user-${allyOne}`,
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#official-responses")),
      "The Active Ally's Notifications feed must contain the Official Responses notification.",
    );

    console.log("10. Reminder candidates created for Allies and responsible Participants on publish");
    const allyOneAuthUser = await findAuthUserByMemberId(allyOne);
    assert(allyOneAuthUser !== null, "Ally One's Auth User fixture must exist.");

    const allyOneReminders = await listMyReminders({
      userId: allyOneAuthUser!.userId,
      status: "all",
    });
    assert(
      allyOneReminders.reminders.some(
        (reminder) => reminder.relatedEntityId === publishedResponsePackage.packageId,
      ),
      "Ally One must have received an 'Official response published' Reminder candidate.",
    );

    console.log(
      "   OK — Active Allies notified once; Author excluded; Reminder candidates created; Public Impact unlocked.",
    );
    console.log("All Initiative Lifecycle — Part K Official Responses checks passed.");
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
