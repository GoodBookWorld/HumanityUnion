/**
 * Initiative Lifecycle — Part B (Automated Collaborative Analysis Vertical
 * Slice) end-to-end verification.
 *
 * Covers, against a real (isolated, per-run) MongoDB database:
 *   1. Deterministic Draft Builder — pure function, no persistence.
 *   2. Source Snapshot Builder — automatic collection from real Discussion
 *      comments, reactions, proposal candidates, and Allies.
 *   3. Analysis service — draft creation, "Generate Draft", save, publish.
 *   4. Public Analysis Projection — draft hidden, published exposed, with
 *      `openQuestions` and `reactionSummary`.
 *   5. Lifecycle Stage Projection — Author / Active Ally / Guest modes,
 *      metadata transition to "published", next stage always reachable.
 *   6. Lifecycle notification fan-out — Active Allies notified, Author
 *      excluded, exact required title/body.
 *   7. Idempotent publication — a retried publish of the same transition
 *      never enqueues a second outbox event.
 *   8. Reaction model — one reaction per participant, immediate counts,
 *      changeable, "none" removes.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-collaborative-analysis-e2e.ts
 * (safe to run repeatedly: every run gets its own throwaway `hu_verify_*`
 * database via `activateVerificationDatabaseIsolationAsync`)
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const steward: RequestIdentity = {
  participantId: "verify-analysis-steward-1",
  displayName: "Steward Verify",
};

/** Section 1 — Deterministic Draft Builder (pure function, no persistence). */
async function verifyDraftBuilder(): Promise<void> {
  console.log("1. Deterministic Draft Builder — pure function");

  const { generateAnalysisDraft } = await import(
    "../modules/initiative-collaborative-analysis/initiative-analysis-draft-builder.js"
  );

  const emptySnapshot = {
    initiativeId: "draft-builder-empty",
    generatedAt: new Date().toISOString(),
    discussionStatistics: { commentCount: 0, helpfulCount: 0, notHelpfulCount: 0 },
    mostDiscussedTopics: [],
    openQuestions: [],
    repeatedArguments: [],
    repeatedConcerns: [],
    proposalCandidates: [],
    activeAlliesCount: 0,
    readyToCollaborateCount: 0,
    discussionUrl: "/initiatives/public/draft-builder-empty#discussion",
    isEmpty: true,
  } as const;

  const emptyDraft = await generateAnalysisDraft({
    initiativeTitle: "Empty Initiative",
    snapshot: emptySnapshot,
  });

  assert(emptyDraft.title === "Collaborative Analysis: Empty Initiative", "Title must embed the Initiative title.");
  assert(emptyDraft.summary.includes("No Discussion activity"), "Empty summary must state no activity yet.");
  assert(
    emptyDraft.supportingEvidence.includes("No discussion comments have received Helpful reactions"),
    "Empty supportingEvidence must use the honest fallback.",
  );
  assert(
    emptyDraft.risks.includes("No discussion comments have been identified as concerns"),
    "Empty risks must use the honest fallback.",
  );
  assert(
    emptyDraft.openQuestions.includes("No open questions identified"),
    "Empty openQuestions must use the honest fallback.",
  );
  assert(
    emptyDraft.suggestedImprovements.includes("No repeated discussion themes"),
    "Empty suggestedImprovements must use the honest fallback.",
  );
  assert(
    emptyDraft.references.includes("No proposal-marked discussion contributions"),
    "Empty references must use the honest fallback.",
  );

  const populatedSnapshot = {
    initiativeId: "draft-builder-populated",
    generatedAt: new Date().toISOString(),
    discussionStatistics: { commentCount: 5, helpfulCount: 3, notHelpfulCount: 1 },
    mostDiscussedTopics: [{ topic: "composting", mentionCount: 3 }],
    openQuestions: [
      {
        commentId: "comment-q1",
        excerpt: "Have we budgeted for winter maintenance?",
        authorDisplayName: "Ally One",
        discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
      },
    ],
    repeatedArguments: [
      {
        commentId: "comment-a1",
        excerpt: "This plan improves community access.",
        authorDisplayName: "Ally Two",
        discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
        helpfulCount: 3,
      },
    ],
    repeatedConcerns: [
      {
        commentId: "comment-c1",
        excerpt: "Maintenance funding may run short.",
        authorDisplayName: "Ally Three",
        discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
        notHelpfulCount: 1,
      },
    ],
    proposalCandidates: [
      {
        commentId: "comment-p1",
        excerpt: "Add a dedicated composting station.",
        authorDisplayName: "Ally Four",
        discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
        candidateId: "candidate-1",
      },
    ],
    activeAlliesCount: 4,
    readyToCollaborateCount: 2,
    discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
    isEmpty: false,
  } as const;

  const populatedDraft = await generateAnalysisDraft({
    initiativeTitle: "Community Garden",
    snapshot: populatedSnapshot,
  });

  assert(
    populatedDraft.summary.includes("5 discussion comments") &&
      populatedDraft.summary.includes("3 marked Helpful") &&
      populatedDraft.summary.includes("1 marked Not Helpful") &&
      populatedDraft.summary.includes("1 proposal-marked contribution") &&
      populatedDraft.summary.includes("4 Active Allies") &&
      populatedDraft.summary.includes("2 participants ready to collaborate"),
    "Populated summary must report every collected metric verbatim, with no invented numbers.",
  );
  assert(
    populatedDraft.supportingEvidence.includes("This plan improves community access.") &&
      populatedDraft.supportingEvidence.includes("Ally Two") &&
      populatedDraft.supportingEvidence.includes("3 Helpful"),
    "Populated supportingEvidence must cite the real repeated argument verbatim.",
  );
  assert(
    populatedDraft.risks.includes("Maintenance funding may run short.") &&
      populatedDraft.risks.includes("1 Not Helpful"),
    "Populated risks must cite the real repeated concern verbatim.",
  );
  assert(
    populatedDraft.openQuestions.includes("Have we budgeted for winter maintenance?"),
    "Populated openQuestions must cite the real open question verbatim.",
  );
  assert(
    populatedDraft.suggestedImprovements.includes("composting") &&
      populatedDraft.suggestedImprovements.includes("mentioned 3 times"),
    "Populated suggestedImprovements must cite the real most-discussed topic verbatim.",
  );
  assert(
    populatedDraft.references.includes("Add a dedicated composting station."),
    "Populated references must cite the real proposal candidate verbatim.",
  );

  const rerun = await generateAnalysisDraft({
    initiativeTitle: "Community Garden",
    snapshot: populatedSnapshot,
  });
  assert(
    JSON.stringify(rerun) === JSON.stringify(populatedDraft),
    "Draft Builder must be deterministic: same snapshot in, byte-identical draft out, every time.",
  );

  console.log("   OK — empty + populated snapshots produce honest, verbatim, deterministic drafts.");
}

async function main(): Promise<void> {
  await verifyDraftBuilder();

  const isolation = await activateVerificationDatabaseIsolationAsync("PART-B-ANALYSIS");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-b-analysis-verify-${runSuffix}`;

  let initiativeId = "";
  const commentIds: string[] = [];

  try {
    assertVerificationDatabaseIsolated();

    const { connectMongoClient } = await import("../infrastructure/mongodb/mongo-connection.js");
    const { ensureMongoIndexes } = await import("../infrastructure/mongodb/mongo-indexes.js");
    await connectMongoClient();
    await ensureMongoIndexes();

    const { createInitiativeDraft, publishInitiative } = await import(
      "../modules/initiatives/initiative.service.js"
    );
    const { createInitiativeComment } = await import("../modules/initiative-comments/index.js");
    const { setInitiativeCommentReaction } = await import(
      "../modules/initiative-comment-reactions/index.js"
    );
    const { upsertAlly } = await import(
      "../modules/initiative-discussion-collaboration/initiative-ally.store.js"
    );
    const { createProposalCandidate } = await import(
      "../modules/initiative-discussion-collaboration/initiative-proposal-candidate.store.js"
    );
    const { buildInitiativeAnalysisSourceSnapshot } = await import(
      "../modules/initiative-collaborative-analysis/initiative-analysis-source-snapshot.service.js"
    );
    const {
      createInitiativeCollaborativeAnalysisDraft,
      generateInitiativeCollaborativeAnalysisDraft,
      saveInitiativeCollaborativeAnalysisDraft,
      publishInitiativeCollaborativeAnalysis,
      getMyInitiativeCollaborativeAnalysisForInitiative,
    } = await import(
      "../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js"
    );
    const { getPublicInitiativeCollaborativeAnalysis } = await import(
      "../modules/initiative-collaborative-analysis/public-initiative-collaborative-analysis.projection.js"
    );
    const { buildInitiativeLifecycleStageProjection } = await import(
      "../modules/initiatives/initiative-lifecycle-stage-projection.service.js"
    );
    const { getNextInitiativeLifecycleStageId } = await import("@hu/types");
    const {
      handleInitiativeLifecycleStagePublishedNotification,
      publishInitiativeLifecycleStage,
    } = await import("../shared/initiative-lifecycle-stage/index.js");
    const { setInitiativeAnalysisReaction, getInitiativeAnalysisReactionSummary } = await import(
      "../modules/initiative-analysis-reactions/index.js"
    );
    const { listMyNotifications } = await import("../modules/notifications/notification.service.js");
    const { dispatchOutboxOnceForTests, findOutboxRecordById } = await import(
      "../infrastructure/outbox/index.js"
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

    console.log("2. Create published Initiative fixture");
    const draft = createInitiativeDraft(steward, {
      title: "Part B Verification Community Garden",
      description: "Exists only to exercise the Collaborative Analysis vertical slice end-to-end.",
      communitySlug: initiativeCommunitySlug,
      activityArea: "Environment",
    });
    const initiative = publishInitiative(steward, draft.initiativeId);
    initiativeId = initiative.initiativeId;
    assert(initiative.lifecyclePhase === "projected", "Initiative must be published/projected.");

    console.log("3. Automatic Source Collection — seed real Discussion + Allies fixtures");
    const commentOpenQuestion = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-open-question",
      body: "Have we budgeted for composting maintenance during winter months this year?",
    });
    const commentArgument = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-argument",
      body: "This plan will meaningfully improve shared community garden access for everyone nearby.",
    });
    const commentConcern = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-concern",
      body: "Maintenance funding could run short every single winter season without more volunteers.",
    });
    const commentProposal = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-proposal",
      body: "We should add a composting station because reducing seasonal waste helps everyone involved.",
    });
    commentIds.push(
      commentOpenQuestion.commentId,
      commentArgument.commentId,
      commentConcern.commentId,
      commentProposal.commentId,
    );

    await setInitiativeCommentReaction({
      initiativeId,
      commentId: commentArgument.commentId,
      actorUserId: "verify-reactor-1",
      reaction: "like",
    });
    await setInitiativeCommentReaction({
      initiativeId,
      commentId: commentArgument.commentId,
      actorUserId: "verify-reactor-2",
      reaction: "like",
    });
    await setInitiativeCommentReaction({
      initiativeId,
      commentId: commentConcern.commentId,
      actorUserId: "verify-reactor-3",
      reaction: "dislike",
    });

    await createProposalCandidate({
      candidateId: `verify-candidate-${runSuffix}`,
      initiativeId,
      sourceCommentId: commentProposal.commentId,
      sourceParticipantId: "verify-commenter-proposal",
      creatorParticipantId: steward.participantId,
      commentText: commentProposal.body,
      status: "candidate",
      createdAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    await upsertAlly({
      initiativeId,
      participantId: "verify-ally-active-1",
      status: "active",
      requestedByParticipantId: "verify-ally-active-1",
      createdAt: now,
      updatedAt: now,
    });
    await upsertAlly({
      initiativeId,
      participantId: "verify-ally-active-2",
      status: "active",
      requestedByParticipantId: "verify-ally-active-2",
      createdAt: now,
      updatedAt: now,
    });
    await upsertAlly({
      initiativeId,
      participantId: "verify-ally-ready-1",
      status: "interest_pending",
      requestedByParticipantId: "verify-ally-ready-1",
      createdAt: now,
      updatedAt: now,
    });

    console.log("4. Source Snapshot Builder — verify every field is real, collected data");
    const snapshot = await buildInitiativeAnalysisSourceSnapshot(initiativeId);

    assert(snapshot.discussionStatistics.commentCount === 4, "commentCount must equal the 4 seeded comments.");
    assert(snapshot.discussionStatistics.helpfulCount === 2, "helpfulCount must equal the 2 Helpful reactions.");
    assert(
      snapshot.discussionStatistics.notHelpfulCount === 1,
      "notHelpfulCount must equal the 1 Not Helpful reaction.",
    );
    assert(
      snapshot.mostDiscussedTopics.some((topic) => topic.topic === "composting" && topic.mentionCount === 2),
      "mostDiscussedTopics must surface 'composting' (mentioned across 2 comments), not an invented topic.",
    );
    assert(snapshot.openQuestions.length === 1, "Exactly one comment ends in '?'.");
    assert(
      snapshot.openQuestions[0]?.commentId === commentOpenQuestion.commentId,
      "The surfaced open question must be the real seeded comment.",
    );
    assert(snapshot.repeatedArguments.length === 1, "Exactly one non-question comment has Helpful reactions.");
    assert(
      snapshot.repeatedArguments[0]?.commentId === commentArgument.commentId &&
        snapshot.repeatedArguments[0]?.helpfulCount === 2,
      "The surfaced repeated argument must be the real seeded comment with its real Helpful count.",
    );
    assert(snapshot.repeatedConcerns.length === 1, "Exactly one non-question comment has Not Helpful reactions.");
    assert(
      snapshot.repeatedConcerns[0]?.commentId === commentConcern.commentId &&
        snapshot.repeatedConcerns[0]?.notHelpfulCount === 1,
      "The surfaced repeated concern must be the real seeded comment with its real Not Helpful count.",
    );
    assert(snapshot.proposalCandidates.length === 1, "Exactly one comment was marked as a proposal candidate.");
    assert(
      snapshot.proposalCandidates[0]?.commentId === commentProposal.commentId,
      "The surfaced proposal candidate must reference the real seeded comment.",
    );
    assert(snapshot.activeAlliesCount === 2, "activeAlliesCount must equal the 2 seeded 'active' Allies.");
    assert(
      snapshot.readyToCollaborateCount === 1,
      "readyToCollaborateCount must equal the 1 seeded 'interest_pending' Ally.",
    );
    assert(snapshot.discussionUrl === `/initiatives/public/${initiativeId}#discussion`, "discussionUrl must deep-link to Discussion.");
    assert(snapshot.isEmpty === false, "isEmpty must be false once real activity exists.");
    console.log("   OK — every Source Snapshot field traces to a real, seeded record.");

    console.log("5. Analysis Editor — create draft, Generate Draft, Save Draft");
    const emptyDraftAnalysis = await createInitiativeCollaborativeAnalysisDraft(steward, {
      initiativeId,
      title: "Placeholder title",
      summary: "Placeholder summary",
      supportingEvidence: "Placeholder evidence",
      risks: "Placeholder risks",
      suggestedImprovements: "Placeholder improvements",
      references: "Placeholder references",
    });
    assert(emptyDraftAnalysis.status === "draft", "A freshly created Analysis must be a draft.");

    const generated = await generateInitiativeCollaborativeAnalysisDraft(steward, initiativeId);
    assert(
      generated.analysisId === emptyDraftAnalysis.analysisId,
      "Generate Draft must overwrite the Author's existing in-progress draft, not create a second one.",
    );
    assert(
      generated.title === `Collaborative Analysis: ${initiative.title}`,
      "Generated title must embed the real Initiative title.",
    );
    assert(
      generated.summary.includes("4 discussion comment"),
      "Generated summary must reflect the real collected comment count.",
    );
    assert(
      generated.openQuestions?.includes("Have we budgeted for composting") === true,
      "Generated openQuestions must cite the real seeded open question.",
    );

    const savedAnalysis = saveInitiativeCollaborativeAnalysisDraft(steward, generated.analysisId, {
      title: "Part B Verification — Collaborative Analysis",
    });
    assert(
      savedAnalysis.title === "Part B Verification — Collaborative Analysis",
      "Save Draft must persist Author edits.",
    );

    const resolvedDraft = getMyInitiativeCollaborativeAnalysisForInitiative(steward, initiativeId);
    assert(
      resolvedDraft?.analysisId === savedAnalysis.analysisId,
      "The Lifecycle Workspace must resolve the Author's in-progress draft as 'the' Analysis.",
    );
    console.log("   OK — Generate Draft is a real, deterministic action; Save Draft persists edits.");

    console.log("6. Public Analysis Projection — hidden while draft, exposed once published");
    const draftProjection = await getPublicInitiativeCollaborativeAnalysis(savedAnalysis.analysisId);
    assert(draftProjection === null, "A draft Analysis must never be publicly visible.");

    const publishedAnalysis = await publishInitiativeCollaborativeAnalysis(steward, savedAnalysis.analysisId);
    assert(publishedAnalysis.status === "published", "Publish must transition the Analysis to published.");
    assert(publishedAnalysis.publishedAt !== undefined, "Publish must stamp publishedAt.");

    const publicProjection = await getPublicInitiativeCollaborativeAnalysis(publishedAnalysis.analysisId);
    assert(publicProjection !== null, "A published Analysis must be publicly visible.");
    assert(
      publicProjection.openQuestions.includes("Have we budgeted for composting"),
      "Public projection must expose openQuestions.",
    );
    assert(
      publicProjection.reactionSummary.support === 0 && publicProjection.reactionSummary.doNotSupport === 0,
      "A freshly published Analysis must start with zero reactions.",
    );
    console.log("   OK — draft stays private; published Analysis is public with openQuestions + reactionSummary.");

    console.log("7. Lifecycle Rule — metadata transitions to 'published', next stage always reachable");
    const projectionBeforePublish = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: steward.participantId,
    });
    assert(projectionBeforePublish !== null, "Analysis stage projection must resolve.");
    assert(
      projectionBeforePublish.viewerRole === "author" && projectionBeforePublish.presentationMode === "author_workspace",
      "The Initiative steward must always see Author Workspace mode.",
    );

    const projectionAfterPublish = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: steward.participantId,
    });
    assert(
      projectionAfterPublish?.metadata.presentationStatus === "published",
      "Lifecycle metadata must report 'published' after Publish (Section 11 — 'Analysis Published').",
    );
    assert(
      projectionAfterPublish?.metadata.publishedRecordId === publishedAnalysis.analysisId,
      "Lifecycle metadata must reference the real published Analysis record.",
    );
    assert(
      projectionAfterPublish?.metadata.canViewPublicResult === true,
      "Lifecycle metadata must confirm a public result now exists.",
    );
    assert(
      getNextInitiativeLifecycleStageId("analysis") === "proposal",
      "The next stage after Collaborative Analysis must be Improvement Proposals — unlocked, not blocked.",
    );
    assert(
      projectionAfterPublish?.nextStage?.stageId === "proposal",
      "The projection's own nextStage must point at Improvement Proposals.",
    );

    const allyProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: "verify-ally-active-1",
    });
    assert(
      allyProjection?.viewerRole === "active_ally" && allyProjection.presentationMode === "public",
      "An Active Ally must see the public renderer, never Author editing controls.",
    );
    assert(
      allyProjection?.authorActions.length === 0,
      "An Active Ally must receive zero Author actions from the ONE shared renderer.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "analysis",
      viewerParticipantId: null,
    });
    assert(
      guestProjection?.viewerRole === "guest" && guestProjection.presentationMode === "public",
      "A signed-out Guest must see the public renderer.",
    );
    assert(
      guestProjection?.aiCapabilities.canGenerateDraft === false,
      "The AI Assistant must never expose Author-only capabilities to a Guest.",
    );
    console.log("   OK — Author/Active-Ally/Guest all resolve from the ONE renderer with correct permissions.");

    console.log("8. Lifecycle notification fan-out — Active Allies notified, Author excluded, exact copy");
    const notificationRuns: Array<{ userId: string; title: string; message: string; relatedUrl: string }> = [];
    const fakeAllyIds = [steward.participantId, "verify-ally-active-1", "verify-ally-active-2"];
    const { createNotification } = await import("../modules/notifications/notification.service.js");
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
          title: input.title,
          message: input.message,
          relatedUrl: input.relatedUrl,
        });
        return createNotification(input);
      },
    };

    // `publishInitiativeCollaborativeAnalysis` (Section 6) already performed
    // the ONE real publish transition for this Analysis — it internally
    // called this exact same `publishInitiativeLifecycleStage` function
    // with these exact same coordinates. Calling it again here with
    // identical coordinates is therefore itself a genuine retry, and must
    // resolve to `"duplicate_ignored"` rather than a second enqueue — this
    // doubles as live proof of Section 9's idempotency guarantee using the
    // real publish path (not a synthetic one).
    const publishOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: publishedAnalysis.analysisId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#collaborative-analysis`,
    });
    assert(
      publishOutcome.outcome === "duplicate_ignored",
      "Section 6's real Publish already enqueued this exact transition; retrying it here must be ignored.",
    );

    const outboxDocument = await getMongoCollection<{ envelope: string; eventName: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: publishOutcome.event.eventId });
    assert(outboxDocument !== null, "The publication event enqueued by Section 6's real Publish must be findable.");
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
      "The Author must never be notified about their own publish action (Section 10 — Author excluded).",
    );
    assert(
      notificationRuns.every((run) => run.title === "Collaborative Analysis Published"),
      'Notification title must be exactly "Collaborative Analysis Published".',
    );
    assert(
      notificationRuns.every(
        (run) => run.message === "The Initiative Author has published a new Collaborative Analysis.",
      ),
      'Notification body must be exactly "The Initiative Author has published a new Collaborative Analysis."',
    );
    assert(
      notificationRuns.every((run) => run.relatedUrl.includes("#collaborative-analysis")),
      "Notification must deep-link to the Collaborative Analysis stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: "user-verify-ally-active-1",
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.title === "Collaborative Analysis Published"),
      "The Active Ally's own /notifications feed must contain the delivered notification.",
    );
    console.log("   OK — exactly the Active Allies (never the Author) are notified, with the exact required copy.");

    console.log("9. Idempotent publication — a retried publish transition never double-enqueues");
    // A second, independent retry (Section 8's own call was already the
    // first retry) — proves this holds under repeated retries, not just once.
    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "analysis",
      stageLabel: "Collaborative Analysis",
      stageArtifactId: publishedAnalysis.analysisId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#collaborative-analysis`,
    });
    assert(
      retryOutcome.outcome === "duplicate_ignored",
      "Retrying the exact same (initiativeId, stageId, stageVersion, publicationKind) transition must be ignored, never double-enqueued.",
    );
    assert(
      retryOutcome.event.eventId === publishOutcome.event.eventId,
      "The retried transition must resolve to the same deterministic event id.",
    );

    const outboxCountForEvent = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: publishOutcome.event.eventId,
    });
    assert(
      outboxCountForEvent === 1,
      `Exactly one outbox record must exist for this transition, found ${String(outboxCountForEvent)}.`,
    );

    clearDomainEventHandlers();
    const dispatchCount = await dispatchOutboxOnceForTests();
    assert(dispatchCount >= 1, "The outbox dispatcher must process the enqueued event without error.");
    const dispatchCountAgain = await dispatchOutboxOnceForTests();
    assert(dispatchCountAgain === 0, "A fully published record has nothing left to redispatch.");

    const dispatchedRecord = await findOutboxRecordById(outboxDocument!._id as unknown as string);
    assert(
      dispatchedRecord?.status === "published",
      "The dispatched record must remain retrievable and reach 'published' status (retained for replay/backfill).",
    );
    console.log("   OK — publish retries and outbox redispatch are both fully idempotent.");

    console.log("10. Reaction Model — one reaction per participant, immediate counts, changeable");
    const summaryBefore = await getInitiativeAnalysisReactionSummary({
      analysisId: publishedAnalysis.analysisId,
    });
    assert(
      summaryBefore.support === 0 && summaryBefore.doNotSupport === 0,
      "Reaction summary must start at zero.",
    );

    await setInitiativeAnalysisReaction({
      initiativeId,
      analysisId: publishedAnalysis.analysisId,
      actorUserId: "verify-reactor-support-1",
      reaction: "support",
    });
    await setInitiativeAnalysisReaction({
      initiativeId,
      analysisId: publishedAnalysis.analysisId,
      actorUserId: "verify-reactor-support-2",
      reaction: "support",
    });
    await setInitiativeAnalysisReaction({
      initiativeId,
      analysisId: publishedAnalysis.analysisId,
      actorUserId: "verify-reactor-oppose-1",
      reaction: "do_not_support",
    });

    const summaryAfterThree = await getInitiativeAnalysisReactionSummary({
      analysisId: publishedAnalysis.analysisId,
    });
    assert(
      summaryAfterThree.support === 2 && summaryAfterThree.doNotSupport === 1,
      "Counts must update immediately to reflect exactly the reactions just cast.",
    );

    // Same participant reacting again with a DIFFERENT kind must replace,
    // never add, their reaction — "one reaction per participant" (Section 9).
    await sleep(600);
    await setInitiativeAnalysisReaction({
      initiativeId,
      analysisId: publishedAnalysis.analysisId,
      actorUserId: "verify-reactor-support-1",
      reaction: "do_not_support",
    });
    const summaryAfterChange = await getInitiativeAnalysisReactionSummary({
      analysisId: publishedAnalysis.analysisId,
    });
    assert(
      summaryAfterChange.support === 1 && summaryAfterChange.doNotSupport === 2,
      "Changing an existing reaction must move the count, never create a second reaction for the same participant.",
    );

    // The SAME participant reacting with the SAME kind again must be a
    // pure no-op (idempotent — no rate-limit error, no double count).
    const unchangedResult = await setInitiativeAnalysisReaction({
      initiativeId,
      analysisId: publishedAnalysis.analysisId,
      actorUserId: "verify-reactor-support-2",
      reaction: "support",
    });
    assert(unchangedResult === "support", "Re-casting the identical reaction must be a no-op.");
    const summaryStillUnchanged = await getInitiativeAnalysisReactionSummary({
      analysisId: publishedAnalysis.analysisId,
    });
    assert(
      summaryStillUnchanged.support === 1 && summaryStillUnchanged.doNotSupport === 2,
      "Re-casting the identical reaction must not change any count.",
    );

    await sleep(600);
    await setInitiativeAnalysisReaction({
      initiativeId,
      analysisId: publishedAnalysis.analysisId,
      actorUserId: "verify-reactor-support-2",
      reaction: "none",
    });
    const summaryAfterRemoval = await getInitiativeAnalysisReactionSummary({
      analysisId: publishedAnalysis.analysisId,
    });
    assert(
      summaryAfterRemoval.support === 0 && summaryAfterRemoval.doNotSupport === 2,
      "Setting reaction to 'none' must remove the participant's reaction entirely.",
    );

    const viewerSummary = await getInitiativeAnalysisReactionSummary({
      analysisId: publishedAnalysis.analysisId,
      actorUserId: "verify-reactor-oppose-1",
    });
    assert(
      viewerSummary.currentUserReaction === "do_not_support",
      "The summary must report the requesting viewer's own current reaction.",
    );
    console.log("   OK — reactions are one-per-participant, changeable, immediately reflected, and 'none' removes.");

    console.log("All Initiative Lifecycle — Part B Collaborative Analysis checks passed.");
  } finally {
    try {
      const { resetInitiativeAlliesStoreForTests } = await import(
        "../modules/initiative-discussion-collaboration/initiative-ally.store.js"
      );
      const { resetInitiativeProposalCandidateStoreForTests } = await import(
        "../modules/initiative-discussion-collaboration/initiative-proposal-candidate.store.js"
      );
      const { resetInitiativeCommentsMongoForTests } = await import(
        "../modules/initiative-comments/initiative-comment.service.js"
      );
      if (initiativeId) {
        await resetInitiativeAlliesStoreForTests(initiativeId);
        await resetInitiativeProposalCandidateStoreForTests(initiativeId);
        await resetInitiativeCommentsMongoForTests(initiativeId);
      }
    } catch (cleanupError) {
      console.warn(`Best-effort fixture cleanup skipped: ${String(cleanupError)}`);
    }

    await isolation.dispose();
  }
}

await runVerificationScript(main);
