/**
 * Initiative Lifecycle — Part L (Intelligent Public Impact)
 * end-to-end verification.
 *
 * Continues from a published Official Response Package (Part K)
 * through the Public Impact Generate / Save / Publish flow, asserts
 * traceability, confirms the pre-existing TASK-033
 * `InitiativePublicImpact` domain is left untouched, and confirms
 * Civic Archive unlocks next.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-public-impact-e2e.ts
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
  participantId: "verify-public-impact-steward-1",
  displayName: "Steward Verify",
};

const allyOne = "verify-public-impact-ally-1";
const allyTwo = "verify-public-impact-ally-2";

async function main(): Promise<void> {
  const isolation = activateVerificationDatabaseIsolation("PART-L-PUBLIC-IMPACT");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-l-public-impact-verify-${runSuffix}`;

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
      generateInitiativeOfficialResponseDraft,
      saveInitiativeOfficialResponseDraft,
      publishInitiativeOfficialResponseStage,
      getPackageByInitiativeId: getOfficialResponsePackageByInitiativeId,
    } = await import("../modules/initiative-official-response-lifecycle/index.js");
    const {
      buildInitiativePublicImpactIntelligenceSnapshot,
      generateInitiativePublicImpactDraft,
      getInitiativePublicImpactWorkspaceContext,
      saveInitiativePublicImpactDraft,
      publishInitiativePublicImpactStage,
      getInitiativePublicImpactLifecycleDraftByInitiativeId,
      getReportByInitiativeId,
    } = await import("../modules/initiative-public-impact-lifecycle/index.js");
    const { listPublicInitiativePublicImpactsForInitiative } = await import(
      "../modules/initiative-public-impact/public-initiative-public-impact.projection.js"
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
      "1. Seed Initiative through a published Official Response Package (Part K), with outstanding Tracking remaining",
    );
    const draft = createInitiativeDraft(steward, {
      title: "Part L Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Public Impact vertical slice.",
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
    await acceptInitiativeImplementationCommitment({ participantId: allyOne }, firstCommitmentId);
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

    const trackings = listTrackingsByInitiative(initiativeId);
    const firstTracking = trackings.find((tracking) => tracking.commitmentId === firstCommitmentId)!;
    await updateInitiativeImplementationTrackingProgress(
      { participantId: allyOne },
      firstTracking.trackingId,
      {
        progress: 100,
        currentStatus: "Completed",
        evidenceReferences: ["https://example.com/proof.jpg"],
      },
    );

    const generatedOfficialResponse = await generateInitiativeOfficialResponseDraft(
      steward,
      initiativeId,
    );
    saveInitiativeOfficialResponseDraft(steward, initiativeId, {
      candidates: generatedOfficialResponse.candidates.map((candidate, index) => ({
        ...candidate,
        institution: index === 0 ? "City Sustainability Office" : "",
        organization: index === 0 ? "" : "Regional Composting Alliance",
      })),
    });
    const publishedResponsePackage = await publishInitiativeOfficialResponseStage(steward, initiativeId);
    assert(
      getOfficialResponsePackageByInitiativeId(initiativeId)?.packageId ===
        publishedResponsePackage.packageId,
      "Official Response Package must be published before Public Impact.",
    );
    console.log("   OK — Official Response Package published with outstanding Tracking remaining.");

    console.log("2. Public Impact Sources — Intelligence Snapshot cites Official Responses and upstream packs");
    const snapshot = await buildInitiativePublicImpactIntelligenceSnapshot(initiativeId);
    assert(
      snapshot.isOfficialResponsePackageAvailable === true,
      "Snapshot must see the published Official Response Package.",
    );
    assert(
      snapshot.officialResponsePackageReference?.packageId === publishedResponsePackage.packageId,
      "Snapshot Official Response Package reference must match the published package.",
    );
    assert(
      snapshot.trackingPackageReference?.packageId === publishedTrackingPackage.packageId,
      "Snapshot must cite the Tracking Package.",
    );
    assert(
      snapshot.commitmentPackageReference?.packageId === publishedCommitmentPackage.packageId,
      "Snapshot must cite the Commitment Package.",
    );
    assert(snapshot.trackingRecords.length === 2, "Snapshot must cite exactly 2 Tracking Records.");
    assert(
      snapshot.participationStatistics.activeAllyCount === 2,
      "Snapshot must count Active Allies.",
    );
    console.log("   OK — Public Impact sources are real, read-only upstream records.");

    console.log(
      "3. Workspace auto-provisions a draft once; Generate is deterministic and cites evidence on every non-empty section",
    );
    const workspace = await getInitiativePublicImpactWorkspaceContext(steward, initiativeId);
    assert(workspace.draft !== null, "Working draft must auto-provision.");
    assert(workspace.publishedReportId === null, "No Public Impact Report has published yet.");

    const generated = await generateInitiativePublicImpactDraft(steward, initiativeId);
    const regenerated = await generateInitiativePublicImpactDraft(steward, initiativeId);
    assert(
      JSON.stringify(generated.sections.map((section) => section.sectionId)) ===
        JSON.stringify(regenerated.sections.map((section) => section.sectionId)),
      "Generate must be deterministic for unchanged sources.",
    );
    assert(generated.sections.length === 11, "Generated draft must include all eleven sections.");
    assert(
      generated.sections
        .filter((section) => section.body.trim())
        .every((section) => section.evidenceReferences.length >= 1),
      "Every non-empty generated section must cite evidence.",
    );
    assert(
      generated.officialResponsePackageId === publishedResponsePackage.packageId,
      "Generated draft must cite the published Official Response Package.",
    );

    console.log("4. Save Draft persists Author edits");
    const saved = saveInitiativePublicImpactDraft(steward, initiativeId, {
      title: `${generated.title} (Author edited)`,
      sections: generated.sections.map((section) =>
        section.sectionId === "executive_summary"
          ? {
              ...section,
              body: `${section.body}\nAuthor clarification: evidence-backed summary only.`,
            }
          : section,
      ),
    });
    assert(saved.title.endsWith("(Author edited)"), "Author title edits must persist.");
    assert(
      getInitiativePublicImpactLifecycleDraftByInitiativeId(initiativeId)?.title.endsWith(
        "(Author edited)",
      ) === true,
      "Saved draft must reload with Author edits.",
    );

    console.log("5. Publish — Public Impact Report created, draft deleted");
    const publishedReport = await publishInitiativePublicImpactStage(steward, initiativeId);
    assert(publishedReport.status === "published", "Published Report must be status=published.");
    assert(
      publishedReport.officialResponsePackageId === publishedResponsePackage.packageId,
      "Report must cite the Official Response Package it was generated from.",
    );
    assert(
      getInitiativePublicImpactLifecycleDraftByInitiativeId(initiativeId) === null,
      "Working draft must be deleted after publish.",
    );
    assert(
      getReportByInitiativeId(initiativeId)?.reportId === publishedReport.reportId,
      "Report must be retrievable by initiativeId as the latest published report.",
    );

    console.log("6. Traceability cites Official Response / Tracking / Commitment / Decision, nothing invented");
    assert(
      publishedReport.traceability.officialResponsePackageId === publishedResponsePackage.packageId,
      "Traceability must cite the Official Response Package id.",
    );
    assert(
      publishedReport.traceability.trackingPackageId === publishedTrackingPackage.packageId,
      "Traceability must cite the Tracking Package id.",
    );
    assert(
      publishedReport.traceability.commitmentPackageId === publishedCommitmentPackage.packageId,
      "Traceability must cite the Commitment Package id.",
    );
    assert(
      publishedReport.traceability.relatedTrackingIds.includes(firstTracking.trackingId),
      "Traceability must cite the Tracking id.",
    );
    assert(
      publishedReport.traceability.relatedCommitmentIds.includes(firstCommitmentId),
      "Traceability must cite the Commitment id.",
    );
    assert(
      publishedReport.traceability.relatedOfficialResponseIds.length ===
        publishedResponsePackage.responseIds.length,
      "Traceability must cite every Official Response id from the Package.",
    );
    assert(
      publishedReport.traceability.evidenceReferences.length > 0,
      "Traceability must carry evidence references from the published sections.",
    );

    console.log("7. Public Report is readable; TASK-033 InitiativePublicImpact domain is unchanged");
    const task033Impacts = await listPublicInitiativePublicImpactsForInitiative(initiativeId);
    assert(
      task033Impacts.length === 0,
      "The pre-existing TASK-033 Public Impact domain must remain completely untouched by Part L's publish.",
    );

    console.log("8. Lifecycle Stage Projection — Author/Guest, Civic Archive next");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "public_impact",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.metadata.publishedRecordId === publishedReport.reportId,
      "Author projection must reference the published Public Impact Report record.",
    );
    assert(authorProjection?.metadata.version === 1, "Author projection version must be 1.");
    assert(
      authorProjection?.nextStage?.stageId === "archive",
      "Author projection next stage must be Civic Archive.",
    );
    assert(
      getNextInitiativeLifecycleStageId("public_impact") === "archive",
      "Lifecycle graph next stage after Public Impact must be archive.",
    );
    assert(
      authorProjection?.aiCapabilities.canGenerateDraft === false ||
        authorProjection?.metadata.hasUnpublishedChanges === false,
      "After publish, Author draft tools should reflect no unpublished draft.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "public_impact",
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
      stageId: "public_impact",
      stageLabel: "Public Impact",
      stageArtifactId: publishedReport.reportId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#public-impact`,
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
      notificationRuns.every((run) => run.relatedUrl.includes("#public-impact")),
      "Notification must deep-link to the Public Impact stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: `user-${allyOne}`,
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#public-impact")),
      "The Active Ally's Notifications feed must contain the Public Impact notification.",
    );

    console.log("10. Reminder candidates created for Allies/responsible and Archive preparation for Author");
    const allyOneAuthUser = await findAuthUserByMemberId(allyOne);
    assert(allyOneAuthUser !== null, "Ally One's Auth User fixture must exist.");

    const allyOneReminders = await listMyReminders({
      userId: allyOneAuthUser!.userId,
      status: "all",
    });
    assert(
      allyOneReminders.reminders.some(
        (reminder) =>
          reminder.relatedEntityId === publishedReport.reportId &&
          reminder.title === "Public Impact published",
      ),
      "Ally One must have received a 'Public Impact published' Reminder candidate.",
    );
    assert(
      allyOneReminders.reminders.some(
        (reminder) => reminder.title === "Outstanding implementation remains",
      ),
      "Ally One must have received an 'Outstanding implementation remains' Reminder candidate.",
    );

    const stewardAuthUser = await findAuthUserByMemberId(steward.participantId);
    assert(stewardAuthUser !== null, "Steward Auth User fixture must exist.");
    const stewardReminders = await listMyReminders({
      userId: stewardAuthUser!.userId,
      status: "all",
    });
    assert(
      stewardReminders.reminders.some((reminder) => reminder.title === "Archive preparation available"),
      "Author must have received an 'Archive preparation available' Reminder candidate.",
    );

    console.log(
      "   OK — Active Allies notified once; Author excluded from publish notifications; Reminder candidates created; Civic Archive unlocked.",
    );
    console.log("All Initiative Lifecycle — Part L Public Impact checks passed.");
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
