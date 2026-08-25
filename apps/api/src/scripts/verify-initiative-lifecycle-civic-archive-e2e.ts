/**
 * Initiative Lifecycle — Part M (Intelligent Civic Archive)
 * end-to-end verification.
 *
 * Continues from a published Public Impact Report (Part L) through the
 * Civic Archive Generate / Save / Publish flow, asserts document projection,
 * PDF download, version immutability (v2 leaves v1 unchanged), confirms
 * TASK-037 `public-civic-archive` is left untouched, and confirms
 * Initiative.status / lifecyclePhase are unchanged on publish.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-civic-archive-e2e.ts
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
  participantId: "verify-civic-archive-steward-1",
  displayName: "Steward Verify",
};

const allyOne = "verify-civic-archive-ally-1";
const allyTwo = "verify-civic-archive-ally-2";

async function main(): Promise<void> {
  const isolation = await activateVerificationDatabaseIsolationAsync("PART-M-CIVIC-ARCHIVE");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-m-civic-archive-verify-${runSuffix}`;

  let initiativeId = "";
  const statusBeforePublish = { status: "", lifecyclePhase: "" };

  try {
    assertVerificationDatabaseIsolated();

    const { connectMongoClient } = await import("../infrastructure/mongodb/mongo-connection.js");
    const { ensureMongoIndexes } = await import("../infrastructure/mongodb/mongo-indexes.js");
    await connectMongoClient();
    await ensureMongoIndexes();

    const { createInitiativeDraft, publishInitiative } = await import(
      "../modules/initiatives/initiative.service.js"
    );
    const { getInitiativeById } = await import("../modules/initiatives/initiative.store.js");
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
    } = await import("../modules/initiative-official-response-lifecycle/index.js");
    const {
      generateInitiativePublicImpactDraft,
      publishInitiativePublicImpactStage,
      getReportByInitiativeId,
    } = await import("../modules/initiative-public-impact-lifecycle/index.js");
    const {
      buildInitiativeCivicArchiveIntelligenceSnapshot,
      generateInitiativeCivicArchiveDraft,
      getInitiativeCivicArchiveWorkspaceContext,
      saveInitiativeCivicArchiveDraft,
      publishInitiativeCivicArchiveStage,
      getInitiativeCivicArchiveLifecycleDraftByInitiativeId,
      getLatestArchiveVersionByInitiativeId,
      getArchiveVersionById,
      getPublishedArchiveDocument,
      downloadPublishedArchivePdf,
      extractSearchablePdfText,
    } = await import("../modules/initiative-civic-archive-lifecycle/index.js");
    const { listPublicCivicArchiveForInitiative } = await import(
      "../modules/public-civic-archive/public-civic-archive.projection.js"
    );
    const { insertAuthUser, findAuthUserByMemberId } = await import(
      "../modules/auth/auth-user.repository.js"
    );
    const { listMyReminders } = await import("../modules/reminders/reminder.service.js");
    const { buildInitiativeLifecycleStageProjection } = await import(
      "../modules/initiatives/initiative-lifecycle-stage-projection.service.js"
    );
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

    console.log("1. Seed Initiative through Part L Public Impact publish");
    const draft = createInitiativeDraft(steward, {
      title: "Part M Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Civic Archive vertical slice.",
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
      { resolveProposedParticipantExists: async () => true },
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
    await publishInitiativeImplementationTrackingStage(steward, initiativeId);

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
    await publishInitiativeOfficialResponseStage(steward, initiativeId);

    await generateInitiativePublicImpactDraft(steward, initiativeId);
    const publishedReport = await publishInitiativePublicImpactStage(steward, initiativeId);
    assert(
      getReportByInitiativeId(initiativeId)?.reportId === publishedReport.reportId,
      "Part L Public Impact Report must be published before Archive.",
    );
    console.log("   OK — Public Impact Report published.");

    console.log("2. Archive Intelligence Snapshot requires Public Impact and cites upstream packs");
    const snapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);
    assert(snapshot.isPublicImpactReportAvailable === true, "Snapshot must see Public Impact.");
    assert(
      snapshot.publicImpactReportReference?.recordId === publishedReport.reportId,
      "Snapshot must cite the Public Impact Report id.",
    );
    assert(
      snapshot.timeline.some((entry) => entry.stageId === "public_impact" && entry.status === "published"),
      "Timeline must include published Public Impact.",
    );

    console.log("3. Workspace / Generate / Save final fields only");
    const workspace = await getInitiativeCivicArchiveWorkspaceContext(steward, initiativeId);
    assert(workspace.draft !== null, "Working draft must auto-provision.");
    assert(workspace.publishedArchiveVersionId === null, "No Archive version published yet.");

    const generated = await generateInitiativeCivicArchiveDraft(steward, initiativeId);
    assert(generated.sections.length === 20, "Generated draft must include all twenty sections.");
    assert(
      generated.publicImpactReportId === publishedReport.reportId,
      "Generated draft must cite the Public Impact Report.",
    );

    const saved = saveInitiativeCivicArchiveDraft(steward, initiativeId, {
      finalArchiveTitle: `${generated.finalArchiveTitle} (Author edited)`,
      finalSummary: `${generated.finalSummary} Author clarification.`,
      lessonsLearned: "Author lessons learned from the lifecycle.",
      knowledgeContribution: "Author knowledge contribution for the archive.",
    });
    assert(saved.finalArchiveTitle.endsWith("(Author edited)"), "Author title edits must persist.");

    const initiativeBefore = getInitiativeById(initiativeId)!;
    statusBeforePublish.status = initiativeBefore.status;
    statusBeforePublish.lifecyclePhase = initiativeBefore.lifecyclePhase;

    console.log("4. Publish Archive v1 — document projection + PDF + draft deleted");
    const publishedV1 = await publishInitiativeCivicArchiveStage(steward, initiativeId);
    assert(publishedV1.archiveVersion === 1, "First publish must be archiveVersion=1.");
    assert(publishedV1.status === "published", "Published version must be status=published.");
    assert(
      getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiativeId) === null,
      "Working draft must be deleted after publish.",
    );

    const packed = await getPublishedArchiveDocument(initiativeId);
    assert(packed !== null, "Published document pack must load.");
    assert(packed!.document.documentKind === "initiative_lifecycle_archive", "Document kind must match.");
    assert(packed!.document.archiveVersion === 1, "Document must report version 1.");
    assert(
      packed!.document.publicUrlPath.includes("#civic-archive"),
      "Document must use the stable civic-archive public path.",
    );
    assert(packed!.document.timeline.length > 0, "Document timeline must be non-empty.");
    assert(packed!.document.traceability !== null, "Document must carry traceability.");
    assert(
      packed!.version.traceability.publicImpactReportId === publishedReport.reportId,
      "Traceability must cite Public Impact Report.",
    );

    const pdf = await downloadPublishedArchivePdf({ initiativeId });
    assert(pdf.buffer.length > 100, "PDF buffer must be non-empty.");
    assert(pdf.buffer.subarray(0, 4).toString("utf8") === "%PDF", "PDF magic bytes must be present.");
    const searchablePdf = extractSearchablePdfText(pdf.buffer);
    assert(
      searchablePdf.includes("ARCHIVE_PDF_MARKERS"),
      "PDF metadata/markers must include deterministic ARCHIVE_PDF_MARKERS.",
    );
    assert(
      searchablePdf.includes(`version=${pdf.document.archiveVersion ?? "draft"}`),
      "PDF markers must include archive version.",
    );
    assert(
      pdf.document.finalArchiveTitle.length > 0 &&
        searchablePdf.includes(pdf.document.finalArchiveTitle),
      "PDF must include the Archive title (metadata or decoded text).",
    );

    const initiativeAfterV1 = getInitiativeById(initiativeId)!;
    assert(
      initiativeAfterV1.status === statusBeforePublish.status,
      "Initiative.status must be unchanged on Archive publish.",
    );
    assert(
      initiativeAfterV1.lifecyclePhase === statusBeforePublish.lifecyclePhase,
      "Initiative.lifecyclePhase must be unchanged on Archive publish.",
    );

    console.log("5. TASK-037 domain unchanged — no new public-civic-archive records");
    const task037Records = listPublicCivicArchiveForInitiative(initiativeId);
    assert(
      task037Records.length === 0,
      "TASK-037 public-civic-archive must remain untouched by Part M publish.",
    );

    console.log("6. Publish Archive v2 after regenerate — v1 unchanged");
    await getInitiativeCivicArchiveWorkspaceContext(steward, initiativeId);
    const regenerated = await generateInitiativeCivicArchiveDraft(steward, initiativeId);
    saveInitiativeCivicArchiveDraft(steward, initiativeId, {
      finalArchiveTitle: `${regenerated.finalArchiveTitle} (v2)`,
      finalSummary: "Second archive version summary.",
      lessonsLearned: "Updated lessons for v2.",
      knowledgeContribution: "Updated knowledge for v2.",
    });
    const v1FrozenTitle = publishedV1.finalArchiveTitle;
    const v1FrozenId = publishedV1.archiveVersionId;

    const publishedV2 = await publishInitiativeCivicArchiveStage(steward, initiativeId);
    assert(publishedV2.archiveVersion === 2, "Second publish must be archiveVersion=2.");
    const stillV1 = getArchiveVersionById(v1FrozenId);
    assert(stillV1 !== null, "v1 must still exist.");
    assert(stillV1!.finalArchiveTitle === v1FrozenTitle, "v1 title must remain unchanged.");
    assert(stillV1!.archiveVersion === 1, "v1 archiveVersion must remain 1.");
    assert(
      getLatestArchiveVersionByInitiativeId(initiativeId)?.archiveVersionId ===
        publishedV2.archiveVersionId,
      "Latest version must be v2.",
    );

    console.log("7. Lifecycle Stage Projection — Author/Guest");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative: initiativeAfterV1,
      stageId: "archive",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.metadata.publishedRecordId === publishedV2.archiveVersionId,
      "Author projection must reference the latest Archive version id.",
    );
    assert(authorProjection?.metadata.version === 2, "Author projection version must be 2.");
    assert(
      authorProjection?.aiCapabilities.canGenerateDraft === true,
      "Author Archive workspace must expose canGenerateDraft.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative: initiativeAfterV1,
      stageId: "archive",
      viewerParticipantId: null,
    });
    assert(guestProjection?.presentationMode === "public", "Guests must resolve public mode.");
    assert(
      guestProjection?.aiCapabilities.canGenerateDraft === false,
      "Guests must never receive Generate Draft AI capability.",
    );

    console.log("8. Lifecycle notification fan-out — Allies notified once, Author excluded");
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
      stageId: "archive",
      stageLabel: "Civic Archive",
      stageArtifactId: publishedV1.archiveVersionId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#civic-archive`,
    });
    assert(
      retryOutcome.outcome === "duplicate_ignored",
      "Publish already enqueued v1 transition; retrying must be ignored.",
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
      notificationRuns.every((run) => run.relatedUrl.includes("#civic-archive")),
      "Notification must deep-link to the Civic Archive stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: `user-${allyOne}`,
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#civic-archive")),
      "The Active Ally's Notifications feed must contain the Civic Archive notification.",
    );

    console.log("9. After publish — no ongoing Archive keep-active reminders for Allies");
    const allyOneAuthUser = await findAuthUserByMemberId(allyOne);
    assert(allyOneAuthUser !== null, "Ally One's Auth User fixture must exist.");
    const allyOneReminders = await listMyReminders({
      userId: allyOneAuthUser!.userId,
      status: "all",
    });
    assert(
      !allyOneReminders.reminders.some((reminder) => reminder.title === "Archive ready"),
      "Allies must not receive Archive-ready reminders.",
    );

    console.log(
      "   OK — Archive v1/v2 published; PDF generated; TASK-037 untouched; status/phase unchanged; Allies notified once.",
    );
    console.log("All Initiative Lifecycle — Part M Civic Archive checks passed.");
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
