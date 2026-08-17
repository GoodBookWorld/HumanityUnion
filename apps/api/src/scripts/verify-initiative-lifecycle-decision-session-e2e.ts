/**
 * Initiative Lifecycle — Part G (Intelligent Decision Session Vertical Slice)
 * end-to-end verification.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-decision-session-e2e.ts
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
  participantId: "verify-decision-session-steward-1",
  displayName: "Steward Verify",
};

const allyIdentity: RequestIdentity = {
  participantId: "verify-ally-active-1",
  displayName: "Ally One",
};

async function main(): Promise<void> {
  const isolation = await activateVerificationDatabaseIsolationAsync("PART-G-DECISION");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-g-decision-verify-${runSuffix}`;

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
      buildInitiativeDecisionSessionIntelligenceSnapshot,
      generateInitiativeDecisionSessionDraft,
      getInitiativeDecisionSessionWorkspaceContext,
      publishInitiativeDecisionSessionStage,
      saveInitiativeDecisionSessionDraft,
      submitInitiativeDecisionSessionRecommendation,
    } = await import("../modules/initiative-decision-session-lifecycle/index.js");
    const { getInitiativeDecisionSessionDraftByInitiativeId } = await import(
      "../modules/initiative-decision-session-lifecycle/initiative-decision-session-draft.store.js"
    );
    const { assessInitiativeCollectiveDecisionEligibility } = await import(
      "../modules/initiative-collective-decision/initiative-collective-decision-eligibility.js"
    );
    const { toPublicDecisionSessionProjection } = await import(
      "../modules/decision-session/public-decision-session.projection.js"
    );
    const { getSessionById } = await import("../modules/decision-session/decision-session.store.js");
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

    console.log("1. Seed Initiative + Allies + Analysis + Proposal + Revision + Petition");
    const draft = createInitiativeDraft(steward, {
      title: "Part G Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Decision Session vertical slice.",
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

    console.log("2. Decision Sources — Intelligence Snapshot loads Petition + upstream sources");
    const snapshot = await buildInitiativeDecisionSessionIntelligenceSnapshot(initiativeId);
    assert(snapshot.isPetitionAvailable === true, "Snapshot must see the published Petition.");
    assert(
      snapshot.petitionReference?.petitionId === petition.petitionId,
      "Snapshot Petition reference must match the published Petition.",
    );
    assert(snapshot.revisionReference !== null, "Snapshot must include the published Revision.");
    assert(
      snapshot.analysisReference?.analysisId === publishedAnalysis.analysisId,
      "Snapshot must include the published Analysis.",
    );
    console.log("   OK — Decision Sources are real, read-only upstream records.");

    console.log("3. Active Ally recommendation remains advisory");
    const recommendation = await submitInitiativeDecisionSessionRecommendation(
      allyIdentity,
      initiativeId,
      {
        kind: "risk",
        title: "Winter access risk",
        body: "Snow may block the compost drop-off path.",
      },
    );
    assert(recommendation.kind === "risk", "Ally recommendation kind must be preserved.");
    const snapshotWithRec = await buildInitiativeDecisionSessionIntelligenceSnapshot(initiativeId);
    assert(
      snapshotWithRec.allyRecommendations.some(
        (entry) => entry.recommendationId === recommendation.recommendationId,
      ),
      "Ally recommendation must appear in the Intelligence Snapshot.",
    );

    console.log("4. Workspace auto-provisions a draft once; Generate is deterministic");
    const workspace = await getInitiativeDecisionSessionWorkspaceContext(steward, initiativeId);
    assert(workspace.draft !== null, "Working draft must auto-provision.");
    const generated = await generateInitiativeDecisionSessionDraft(steward, initiativeId);
    const regenerated = await generateInitiativeDecisionSessionDraft(steward, initiativeId);
    assert(
      JSON.stringify({
        title: generated.title,
        decisionQuestion: generated.decisionQuestion,
        options: generated.options,
      }) ===
        JSON.stringify({
          title: regenerated.title,
          decisionQuestion: regenerated.decisionQuestion,
          options: regenerated.options,
        }),
      "Generate must be deterministic for unchanged sources.",
    );
    assert(
      generated.options.includes("Winter access risk") === false,
      "Risk recommendations must not become Decision Options automatically.",
    );
    assert(
      generated.risks.some((risk) => risk.includes("Winter access risk")),
      "Risk recommendations must surface in Risks.",
    );

    console.log("5. Save Draft persists Author edits");
    const saved = saveInitiativeDecisionSessionDraft(steward, initiativeId, {
      decisionQuestion: "Should the city fund the compost pilot this fiscal year?",
      options: ["Approve pilot funding", "Approve with district limits", "Decline for now"],
    });
    assert(saved.decisionQuestion.includes("fiscal year"), "Author edits must persist.");
    assert(
      getInitiativeDecisionSessionDraftByInitiativeId(initiativeId)?.decisionQuestion.includes(
        "fiscal year",
      ) === true,
      "Saved draft must reload with Author edits.",
    );

    console.log("6. Collective Decision is ineligible before Decision Session publication");
    const eligibilityMissing = assessInitiativeCollectiveDecisionEligibility(
      initiativeId,
      "decision-session-does-not-exist",
    );
    assert(
      eligibilityMissing.eligible === false,
      "Collective Decision must stay locked before Decision Session publication.",
    );

    console.log("7. Publish — Traceability, structured content, draft deleted, Collective Decision unlocks");
    const published = await publishInitiativeDecisionSessionStage(steward, initiativeId);
    assert(published.status === "published", "Published session must be status=published.");
    assert(published.traceability?.petitionId === petition.petitionId, "Traceability must cite the Petition.");
    assert(
      published.structuredContent?.options.includes("Approve pilot funding") === true,
      "Structured content must survive publish.",
    );
    assert(
      getInitiativeDecisionSessionDraftByInitiativeId(initiativeId) === null,
      "Working draft must be deleted after publish.",
    );

    const eligibilityAfter = assessInitiativeCollectiveDecisionEligibility(
      initiativeId,
      published.sessionId,
    );
    assert(
      eligibilityAfter.eligible === true,
      "Collective Decision must unlock immediately after Decision Session publication.",
    );

    console.log("8. Public Decision Session shows published content only");
    const stored = getSessionById(published.sessionId);
    assert(stored !== null, "Published Decision Session must be loadable by sessionId.");
    const publicProjection = await toPublicDecisionSessionProjection(stored!);
    assert(
      publicProjection.decisionQuestion.includes("fiscal year"),
      "Public projection must show the published Decision Question.",
    );
    assert(
      publicProjection.structuredContent !== null,
      "Public projection must include structured Decision content.",
    );
    assert(
      publicProjection.traceability?.petitionId === petition.petitionId,
      "Public projection must cite the Petition that produced this Decision Session.",
    );

    console.log("9. Lifecycle Stage Projection — Author/Guest, Collective Decision next");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "decision_session",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.metadata.publishedRecordId === published.sessionId,
      "Author projection must reference the published Decision Session record.",
    );
    assert(
      authorProjection?.nextStage?.stageId === "collective_decision",
      "Author projection next stage must be Collective Decision.",
    );
    assert(
      getNextInitiativeLifecycleStageId("decision_session") === "collective_decision",
      "Lifecycle graph next stage after Decision Session must be Collective Decision.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "decision_session",
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
      stageId: "decision_session",
      stageLabel: "Decision Session",
      stageArtifactId: published.sessionId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#decision-session`,
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
      notificationRuns.every((run) => run.relatedUrl.includes("#decision-session")),
      "Notification must deep-link to the Decision Session stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: "user-verify-ally-active-1",
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#decision-session")),
      "The Active Ally's Notifications feed must contain the Decision Session notification.",
    );

    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "decision_session",
      stageLabel: "Decision Session",
      stageArtifactId: published.sessionId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#decision-session`,
    });
    assert(retryOutcome.outcome === "duplicate_ignored", "Retry must never double-enqueue.");

    console.log("   OK — Active Allies notified once; Author excluded; Collective Decision unlocked.");
    console.log("All Initiative Lifecycle — Part G Decision Session checks passed.");
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
