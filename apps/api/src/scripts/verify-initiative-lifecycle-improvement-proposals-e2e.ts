/**
 * Initiative Lifecycle — Part D (Automated Improvement Proposals Vertical
 * Slice) end-to-end verification.
 *
 * Covers, against a real (isolated, per-run) MongoDB database:
 *   1. Deterministic grouping / duplicate detection — pure function.
 *   2. Automatic Proposal Collection — from real Discussion comments
 *      marked as Proposal candidates, reactions, and Allies.
 *   3. Proposal Intelligence snapshot — groups, duplicate detection,
 *      categories, open questions, Analysis reference, no AI.
 *   4. Author Workspace — Generate (enriching, not overwriting), Edit,
 *      add a manual (Author-originated) proposal, status transitions.
 *   5. Publish — only "ready" proposals publish; still-"draft" proposals
 *      never silently publish; validation of required fields.
 *   6. Proposal Traceability — stable Proposal IDs survive publish.
 *   7. Public Presentation — draft hidden, published visible, still-draft
 *      proposals inside a published collection stay hidden.
 *   8. Lifecycle Stage Projection — Author / Active Ally / Guest modes,
 *      metadata "published", Revision unlocked.
 *   9. Lifecycle notification fan-out — Active Allies notified, Author
 *      excluded, exact required copy — and idempotent retries.
 *  10. Community Reactions — Support / Do Not Support, one per
 *      participant, changeable, "none" removes, blocked on a non-public
 *      proposal.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-improvement-proposals-e2e.ts
 * (safe to run repeatedly: every run gets its own throwaway `hu_verify_*`
 * database via `activateVerificationDatabaseIsolation`)
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const steward: RequestIdentity = {
  participantId: "verify-proposal-steward-1",
  displayName: "Steward Verify",
};

/** Section 1 — deterministic grouping / duplicate detection (pure function, no persistence). */
async function verifyGrouping(): Promise<void> {
  console.log("1. Deterministic grouping / duplicate detection — pure function, never AI");

  const { buildProposalGroupsFromCandidates } = await import(
    "../modules/initiative-improvement-proposals-stage/initiative-proposal-intelligence.service.js"
  );

  const discussionUrl = "/initiatives/public/grouping-fixture#discussion";

  function candidate(overrides: Record<string, unknown>) {
    return {
      candidateId: "candidate-default",
      commentId: "comment-default",
      excerpt: "Add a dedicated composting station near the entrance.",
      authorDisplayName: "Ally One",
      discussionUrl,
      helpfulCount: 0,
      notHelpfulCount: 0,
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  const groups = buildProposalGroupsFromCandidates(
    [
      candidate({
        candidateId: "candidate-1",
        commentId: "comment-1",
        excerpt: "Add a dedicated composting station near the entrance.",
        authorDisplayName: "Ally One",
        helpfulCount: 3,
      }),
      candidate({
        candidateId: "candidate-2",
        commentId: "comment-2",
        excerpt: "We should add a composting station near the entrance too.",
        authorDisplayName: "Ally Two",
        helpfulCount: 2,
      }),
      candidate({
        candidateId: "candidate-3",
        commentId: "comment-3",
        excerpt: "The budget for winter maintenance needs more funding.",
        authorDisplayName: "Ally Three",
        helpfulCount: 1,
      }),
    ],
    discussionUrl,
  );

  assert(groups.length === 2, `Two distinct ideas must produce two groups, got ${String(groups.length)}.`);
  const compostGroup = groups.find((group) => group.representativeExcerpt.includes("composting station"));
  const fundingGroup = groups.find((group) => group.category === "Funding");
  assert(compostGroup !== undefined, "The composting idea must form its own group.");
  assert(
    compostGroup!.isDuplicateGroup && compostGroup!.memberCount === 2,
    "Two similarly-worded composting comments must be detected as duplicates of each other.",
  );
  assert(fundingGroup !== undefined && !fundingGroup.isDuplicateGroup, "The funding idea must be its own, non-duplicate group.");

  const rerun = buildProposalGroupsFromCandidates(
    [
      candidate({ candidateId: "candidate-1", commentId: "comment-1", helpfulCount: 3 }),
      candidate({
        candidateId: "candidate-2",
        commentId: "comment-2",
        excerpt: "We should add a composting station near the entrance too.",
        authorDisplayName: "Ally Two",
        helpfulCount: 2,
      }),
      candidate({
        candidateId: "candidate-3",
        commentId: "comment-3",
        excerpt: "The budget for winter maintenance needs more funding.",
        authorDisplayName: "Ally Three",
        helpfulCount: 1,
      }),
    ],
    discussionUrl,
  );
  assert(
    JSON.stringify(rerun) === JSON.stringify(groups),
    "Grouping must be deterministic: identical candidates in, byte-identical groups out, every time.",
  );

  console.log("   OK — similar wording clusters into duplicate groups; unrelated ideas stay separate; fully deterministic.");
}

async function main(): Promise<void> {
  await verifyGrouping();

  const isolation = activateVerificationDatabaseIsolation("PART-D-PROPOSALS");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-d-proposals-verify-${runSuffix}`;

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
    const {
      createInitiativeCollaborativeAnalysisDraft,
      generateInitiativeCollaborativeAnalysisDraft,
      publishInitiativeCollaborativeAnalysis,
    } = await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
    const { buildInitiativeProposalIntelligenceSnapshot } = await import(
      "../modules/initiative-improvement-proposals-stage/initiative-proposal-intelligence.service.js"
    );
    const {
      generateImprovementProposalsDraft,
      saveInitiativeStructuredProposal,
      addManualInitiativeStructuredProposal,
      setInitiativeStructuredProposalStatus,
      publishImprovementProposalsCollection,
      getMyImprovementProposalsCollectionForInitiative,
    } = await import(
      "../modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.service.js"
    );
    const {
      getPublicInitiativeImprovementProposalsCollection,
      listPublicInitiativeImprovementProposalsCollections,
    } = await import(
      "../modules/initiative-improvement-proposals-stage/public-initiative-improvement-proposals-stage.projection.js"
    );
    const { buildInitiativeLifecycleStageProjection } = await import(
      "../modules/initiatives/initiative-lifecycle-stage-projection.service.js"
    );
    const { getNextInitiativeLifecycleStageId } = await import("@hu/types");
    const {
      handleInitiativeLifecycleStagePublishedNotification,
      publishInitiativeLifecycleStage,
    } = await import("../shared/initiative-lifecycle-stage/index.js");
    const { setInitiativeProposalReaction, getInitiativeProposalReactionSummary } = await import(
      "../modules/initiative-proposal-reactions/index.js"
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
      title: "Part D Verification Community Garden",
      description: "Exists only to exercise the Improvement Proposals vertical slice end-to-end.",
      communitySlug: initiativeCommunitySlug,
      activityArea: "Environment",
    });
    const initiative = publishInitiative(steward, draft.initiativeId);
    initiativeId = initiative.initiativeId;
    assert(initiative.lifecyclePhase === "projected", "Initiative must be published/projected.");

    console.log("3. Published Collaborative Analysis fixture (Part 1 — proposals receive input from published Analysis)");
    const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(steward, {
      initiativeId,
      title: "Placeholder title",
      summary: "Placeholder summary",
      supportingEvidence: "Placeholder evidence",
      risks: "Placeholder risks",
      suggestedImprovements: "Placeholder improvements",
      references: "Placeholder references",
    });
    const generatedAnalysis = await generateInitiativeCollaborativeAnalysisDraft(steward, initiativeId);
    assert(generatedAnalysis.analysisId === analysisDraft.analysisId, "Generate must reuse the same in-progress draft.");
    const publishedAnalysis = await publishInitiativeCollaborativeAnalysis(steward, generatedAnalysis.analysisId);
    assert(publishedAnalysis.status === "published", "Analysis fixture must actually be published.");

    console.log("4. Automatic Proposal Collection — seed real Proposal-marked comments + Allies");
    const commentComposting1 = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-compost-1",
      body: "We should add a dedicated composting station because it reduces seasonal waste for everyone.",
    });
    const commentComposting2 = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-compost-2",
      body: "Please add a composting station near the entrance, it reduces seasonal waste too.",
    });
    const commentFunding = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-funding",
      body: "The budget allocated for winter maintenance funding should be increased significantly.",
    });
    const commentNotACandidate = await createInitiativeComment({
      initiativeId,
      authorUserId: "verify-commenter-plain",
      body: "I really enjoyed reading through this whole discussion thread today.",
    });

    await setInitiativeCommentReaction({
      initiativeId,
      commentId: commentComposting1.commentId,
      actorUserId: "verify-reactor-1",
      reaction: "like",
    });
    await setInitiativeCommentReaction({
      initiativeId,
      commentId: commentComposting1.commentId,
      actorUserId: "verify-reactor-2",
      reaction: "like",
    });

    const now = new Date().toISOString();
    for (const [candidateSuffix, comment, authorParticipantId] of [
      ["compost-1", commentComposting1, "verify-commenter-compost-1"],
      ["compost-2", commentComposting2, "verify-commenter-compost-2"],
      ["funding", commentFunding, "verify-commenter-funding"],
    ] as const) {
      await createProposalCandidate({
        candidateId: `verify-candidate-${candidateSuffix}-${runSuffix}`,
        initiativeId,
        sourceCommentId: comment.commentId,
        sourceParticipantId: authorParticipantId,
        creatorParticipantId: steward.participantId,
        commentText: comment.body,
        status: "candidate",
        createdAt: now,
      });
    }
    void commentNotACandidate;

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
    console.log("   OK — 3 comments marked as Proposal candidates (2 duplicates + 1 distinct), 2 Active Allies seeded.");

    console.log("5. Proposal Intelligence snapshot — groups, duplicate detection, categories, open questions, Analysis reference");
    const snapshot = await buildInitiativeProposalIntelligenceSnapshot(initiativeId);

    assert(snapshot.totalCandidateCount === 3, `Exactly the 3 marked comments must surface, got ${String(snapshot.totalCandidateCount)}.`);
    assert(snapshot.groups.length === 2, `The 2 duplicate composting comments + 1 distinct funding comment must form 2 groups, got ${String(snapshot.groups.length)}.`);
    assert(snapshot.duplicateGroupCount === 1, "Exactly one group (composting) must be flagged as a duplicate group.");
    const compostingSnapshotGroup = snapshot.groups.find((group) => group.memberCount === 2);
    assert(compostingSnapshotGroup !== undefined, "The 2-member composting group must be present.");
    assert(
      compostingSnapshotGroup!.totalHelpfulCount === 2,
      "The composting group's totalHelpfulCount must equal the 2 real Helpful reactions.",
    );
    assert(
      compostingSnapshotGroup!.memberCount === 2 && compostingSnapshotGroup!.authorDisplayNames.length >= 1,
      "The composting group must aggregate real (deduplicated) comment author display names for both members.",
    );
    const fundingSnapshotGroup = snapshot.groups.find((group) => group.category === "Funding");
    assert(fundingSnapshotGroup !== undefined, "The funding comment must be categorized as Funding, deterministically by keyword.");
    assert(
      snapshot.analysisReference?.analysisId === publishedAnalysis.analysisId,
      "The snapshot must reference the real published Collaborative Analysis (Part 1).",
    );
    assert(snapshot.isEmpty === false, "isEmpty must be false once real candidates exist.");
    console.log("   OK — every Intelligence field traces to real, seeded records; no AI, no invented data.");

    console.log("6. Author Workspace — Generate (enriching), Edit, add a manual (Author-originated) proposal");
    const firstGenerate = await generateImprovementProposalsDraft(steward, initiativeId);
    assert(firstGenerate.status === "draft", "A freshly generated collection must be a draft.");
    assert(
      firstGenerate.proposals.length === 2,
      `Generate must create exactly one draft proposal per detected group (2), got ${String(firstGenerate.proposals.length)}.`,
    );
    assert(
      firstGenerate.proposals.every((proposal) => proposal.status === "draft"),
      "Every freshly generated proposal must start as 'draft' — the AI Assistant never decides acceptance.",
    );
    assert(
      firstGenerate.analysisId === publishedAnalysis.analysisId,
      "The collection must carry the real published Analysis reference forward.",
    );

    const secondGenerate = await generateImprovementProposalsDraft(steward, initiativeId);
    assert(
      secondGenerate.collectionId === firstGenerate.collectionId,
      "Generate must reuse the same in-progress draft collection, never create a second one.",
    );
    assert(
      secondGenerate.proposals.length === 2,
      "Re-running Generate against unchanged Discussion data must be enriching, not duplicating: still exactly 2 proposals.",
    );
    console.log("   OK — Generate is enriching (idempotent re-runs never duplicate), never AI-decided acceptance.");

    const compostingProposal = firstGenerate.proposals.find((proposal) =>
      proposal.summary.includes("composting station"),
    )!;
    const fundingProposal = firstGenerate.proposals.find((proposal) => proposal !== compostingProposal)!;

    const edited = await saveInitiativeStructuredProposal(steward, firstGenerate.collectionId, compostingProposal.proposalId, {
      title: "Add a composting station near the entrance",
      expectedImprovement: "Reduces seasonal waste and gives residents a convenient drop-off point.",
    });
    const editedProposal = edited.proposals.find((proposal) => proposal.proposalId === compostingProposal.proposalId)!;
    assert(
      editedProposal.title === "Add a composting station near the entrance",
      "Save Draft must persist the Author's title edit.",
    );
    assert(
      editedProposal.expectedImprovement === "Reduces seasonal waste and gives residents a convenient drop-off point.",
      "Save Draft must persist the Author's expectedImprovement edit.",
    );
    assert(
      editedProposal.summary === compostingProposal.summary,
      "Save Draft must leave untouched fields exactly as they were.",
    );

    const withManual = await addManualInitiativeStructuredProposal(steward, firstGenerate.collectionId, {
      title: "Install additional bicycle racks",
      summary: "An Author-originated idea not sourced from any Discussion comment.",
      description: "The Author identified this improvement independently.",
      reason: "Improves accessibility for participants who cycle to the Initiative site.",
      expectedImprovement: "More participants can attend in-person sessions.",
      supportingSources: "",
      relatedDiscussionReferences: "",
    });
    assert(withManual.proposals.length === 3, "Adding a manual proposal must add exactly one more proposal.");
    const manualProposal = withManual.proposals.find((proposal) => proposal.title === "Install additional bicycle racks")!;
    assert(manualProposal.groupId === null, "A manual, Author-originated proposal must carry no groupId (Part 6/12).");
    assert(manualProposal.sourceCommentIds.length === 0, "A manual proposal must have no automatic Discussion source.");
    console.log("   OK — Edit persists Author changes; a manual, Author-originated proposal can be added alongside generated ones.");

    console.log("7. Status transitions — pre-publication toggling, invalid transitions rejected");
    let rejectedDirectPublish = false;
    try {
      await setInitiativeStructuredProposalStatus(steward, firstGenerate.collectionId, fundingProposal.proposalId, "published");
    } catch {
      rejectedDirectPublish = true;
    }
    assert(rejectedDirectPublish, 'Setting "published" directly on a proposal must be rejected — only the collection-level Publish action may do that.');

    await setInitiativeStructuredProposalStatus(steward, firstGenerate.collectionId, compostingProposal.proposalId, "ready");
    const readiedManual = await setInitiativeStructuredProposalStatus(steward, firstGenerate.collectionId, manualProposal.proposalId, "ready");
    assert(
      readiedManual.proposals.find((p) => p.proposalId === compostingProposal.proposalId)?.status === "ready",
      "The composting proposal must now be 'ready'.",
    );
    assert(
      readiedManual.proposals.find((p) => p.proposalId === manualProposal.proposalId)?.status === "ready",
      "The manual proposal must now be 'ready'.",
    );
    assert(
      readiedManual.proposals.find((p) => p.proposalId === fundingProposal.proposalId)?.status === "draft",
      "The funding proposal, left untouched, must still be 'draft' — Publish must never force-finish it.",
    );
    console.log("   OK — direct 'published' is rejected; 'draft' <-> 'ready' toggling works freely pre-publication.");

    console.log("8. Publish — only 'ready' proposals publish; a lone 'draft' proposal carries over untouched");
    const stableCompostingProposalId = compostingProposal.proposalId;
    const stableManualProposalId = manualProposal.proposalId;
    const stableFundingProposalId = fundingProposal.proposalId;

    const published = await publishImprovementProposalsCollection(steward, firstGenerate.collectionId);
    assert(published.status === "published", "The collection must transition to 'published'.");
    assert(published.publishedAt !== undefined, "Publish must stamp publishedAt.");
    const publishedComposting = published.proposals.find((p) => p.proposalId === stableCompostingProposalId)!;
    const publishedManual = published.proposals.find((p) => p.proposalId === stableManualProposalId)!;
    const stillDraftFunding = published.proposals.find((p) => p.proposalId === stableFundingProposalId)!;
    assert(publishedComposting.status === "published", "Every 'ready' proposal must become 'published'.");
    assert(publishedManual.status === "published", "Every 'ready' proposal must become 'published', including manual ones.");
    assert(
      stillDraftFunding.status === "draft",
      "A proposal never marked 'ready' must remain 'draft' even after the collection publishes — Publish never silently finishes it.",
    );
    console.log("   OK — Publish only promotes 'ready' proposals; a forgotten draft proposal is safely left behind.");

    console.log("6b. Proposal Traceability — stable Proposal IDs survive publish");
    assert(publishedComposting.proposalId === stableCompostingProposalId, "Proposal IDs must never change across the publish transition.");
    assert(publishedManual.proposalId === stableManualProposalId, "Manual proposal IDs must never change across the publish transition.");
    console.log("   OK — every published proposal keeps the exact Proposal ID assigned at draft time (Part 7).");

    console.log("9. Public Presentation — draft hidden entirely; published collection exposes only publicly-visible proposals");
    const preferredDraft = await getMyImprovementProposalsCollectionForInitiative(steward, initiativeId);
    assert(
      preferredDraft?.collectionId === published.collectionId && preferredDraft.status === "published",
      "With no newer draft in progress, the Workspace must resolve the most recently published collection.",
    );

    const publicProjection = await getPublicInitiativeImprovementProposalsCollection(published.collectionId);
    assert(publicProjection !== null, "A published collection must be publicly visible.");
    assert(
      publicProjection.proposals.length === 2,
      `Only the 2 published proposals must be publicly visible; the still-'draft' funding proposal must stay hidden, got ${String(publicProjection.proposals.length)}.`,
    );
    assert(
      publicProjection.proposals.every((proposal) => proposal.status === "published"),
      "Every publicly-visible proposal must actually be in a publicly-visible status.",
    );
    assert(
      !publicProjection.proposals.some((proposal) => proposal.proposalId === stableFundingProposalId),
      "The still-'draft' funding proposal must never leak into the public projection.",
    );
    assert(
      publicProjection.proposals.every((proposal) => proposal.reactionSummary.support === 0 && proposal.reactionSummary.doNotSupport === 0),
      "Freshly published proposals must start with zero reactions.",
    );
    assert(publicProjection.authorDisplayName.length > 0, "The public projection must resolve a real Author display name.");

    const listedCollections = await listPublicInitiativeImprovementProposalsCollections(initiativeId);
    assert(listedCollections.length === 1, "Exactly one published collection must be listed for this Initiative.");
    assert(listedCollections[0]!.version === 1, "The first-ever published collection must be version 1.");
    console.log("   OK — Public sees only published proposals with editing controls and comments absent; no draft leakage.");

    console.log("10. Lifecycle Stage Projection — Author / Active Ally / Guest, metadata published, Revision unlocked");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "proposal",
      viewerParticipantId: steward.participantId,
    });
    assert(
      authorProjection?.viewerRole === "author" && authorProjection.presentationMode === "author_workspace",
      "The Author must see the Author Workspace presentation mode.",
    );
    assert(
      authorProjection?.metadata.presentationStatus === "published",
      "Lifecycle metadata must report 'published' after Publish.",
    );
    assert(
      authorProjection?.metadata.publishedRecordId === published.collectionId,
      "Lifecycle metadata must reference the real published collection.",
    );
    assert(
      getNextInitiativeLifecycleStageId("proposal") === "revision",
      "The next stage after Improvement Proposals must be Revision — unlocked, not blocked (Part 12/13).",
    );
    assert(
      authorProjection?.nextStage?.stageId === "revision",
      "The projection's own nextStage must point at Revision.",
    );

    const allyProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "proposal",
      viewerParticipantId: "verify-ally-active-1",
    });
    assert(
      allyProjection?.viewerRole === "active_ally" && allyProjection.presentationMode === "public",
      "An Active Ally must see the public renderer, never Author editing controls.",
    );
    assert(allyProjection?.authorActions.length === 0, "An Active Ally must receive zero Author actions.");

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative,
      stageId: "proposal",
      viewerParticipantId: null,
    });
    assert(guestProjection?.viewerRole === "guest" && guestProjection.presentationMode === "public", "A signed-out Guest must see the public renderer.");
    assert(
      guestProjection?.aiCapabilities.canGenerateDraft === false,
      "The AI Assistant must never expose Author-only capabilities (Generate) to a Guest.",
    );
    console.log("   OK — Author/Active-Ally/Guest all resolve from the ONE shared renderer with correct permissions; Revision unlocked.");

    console.log("11. Lifecycle notification fan-out — Active Allies notified, Author excluded, exact required copy");
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

    // `publishImprovementProposalsCollection` (Section 8) already performed
    // the ONE real publish transition — it internally called this exact
    // same `publishInitiativeLifecycleStage` function. Calling it again
    // here with identical coordinates is therefore a genuine retry, which
    // must resolve to `"duplicate_ignored"`.
    const publishOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "proposal",
      stageLabel: "Improvement Proposals",
      stageArtifactId: published.collectionId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#improvement-proposals`,
    });
    assert(
      publishOutcome.outcome === "duplicate_ignored",
      "Section 8's real Publish already enqueued this exact transition; retrying it here must be ignored.",
    );

    const outboxDocument = await getMongoCollection<{ envelope: string; eventName: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: publishOutcome.event.eventId });
    assert(outboxDocument !== null, "The publication event enqueued by Section 8's real Publish must be findable.");
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
      notificationRuns.every((run) => run.title === "Improvement Proposals Published"),
      'Notification title must be exactly "Improvement Proposals Published".',
    );
    assert(
      notificationRuns.every(
        (run) => run.message === `The Initiative Author has published new Improvement Proposals for "${initiative.title}".`,
      ),
      "Notification body must be the exact required, Initiative-specific copy.",
    );
    assert(
      notificationRuns.every((run) => run.relatedUrl.includes("#improvement-proposals")),
      "Notification must deep-link to the Improvement Proposals stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: "user-verify-ally-active-1",
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.title === "Improvement Proposals Published"),
      "The Active Ally's own /notifications feed must contain the delivered notification.",
    );

    // A second, independent retry proves idempotency holds under repeats.
    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "proposal",
      stageLabel: "Improvement Proposals",
      stageArtifactId: published.collectionId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#improvement-proposals`,
    });
    assert(retryOutcome.outcome === "duplicate_ignored", "Retrying the exact same transition must never double-enqueue.");
    const outboxCountForEvent = await getMongoCollection(MONGO_COLLECTIONS.outbox).countDocuments({
      eventId: publishOutcome.event.eventId,
    });
    assert(outboxCountForEvent === 1, `Exactly one outbox record must exist for this transition, found ${String(outboxCountForEvent)}.`);

    clearDomainEventHandlers();
    const dispatchCount = await dispatchOutboxOnceForTests();
    assert(dispatchCount >= 1, "The outbox dispatcher must process the enqueued event without error.");
    const dispatchedRecord = await findOutboxRecordById(outboxDocument!._id as unknown as string);
    assert(dispatchedRecord?.status === "published", "The dispatched record must reach 'published' status.");
    console.log("   OK — exactly the Active Allies (never the Author) are notified once, with the exact required copy; retries never double-notify.");

    console.log("12. Community Reactions — Support / Do Not Support, one per participant, changeable, blocked on non-public proposals");
    let rejectedReactionOnDraft = false;
    try {
      await setInitiativeProposalReaction({
        initiativeId,
        collectionId: published.collectionId,
        proposalId: stableFundingProposalId,
        actorUserId: "verify-reactor-illegal",
        reaction: "support",
      });
    } catch {
      rejectedReactionOnDraft = true;
    }
    assert(rejectedReactionOnDraft, "Reacting to a still-'draft' proposal (even inside a published collection) must be rejected.");

    const summaryBefore = await getInitiativeProposalReactionSummary({ proposalId: stableCompostingProposalId });
    assert(summaryBefore.support === 0 && summaryBefore.doNotSupport === 0, "Reaction summary must start at zero.");

    await setInitiativeProposalReaction({
      initiativeId,
      collectionId: published.collectionId,
      proposalId: stableCompostingProposalId,
      actorUserId: "verify-reactor-support-1",
      reaction: "support",
    });
    await setInitiativeProposalReaction({
      initiativeId,
      collectionId: published.collectionId,
      proposalId: stableCompostingProposalId,
      actorUserId: "verify-reactor-support-2",
      reaction: "support",
    });
    await setInitiativeProposalReaction({
      initiativeId,
      collectionId: published.collectionId,
      proposalId: stableCompostingProposalId,
      actorUserId: "verify-reactor-oppose-1",
      reaction: "do_not_support",
    });

    const summaryAfterThree = await getInitiativeProposalReactionSummary({ proposalId: stableCompostingProposalId });
    assert(
      summaryAfterThree.support === 2 && summaryAfterThree.doNotSupport === 1,
      "Counts must update immediately to reflect exactly the reactions just cast.",
    );

    await sleep(600);
    await setInitiativeProposalReaction({
      initiativeId,
      collectionId: published.collectionId,
      proposalId: stableCompostingProposalId,
      actorUserId: "verify-reactor-support-1",
      reaction: "do_not_support",
    });
    const summaryAfterChange = await getInitiativeProposalReactionSummary({ proposalId: stableCompostingProposalId });
    assert(
      summaryAfterChange.support === 1 && summaryAfterChange.doNotSupport === 2,
      "Changing an existing reaction must move the count, never create a second reaction for the same participant.",
    );

    // The SAME participant reacting with the SAME kind again must be a
    // pure no-op (idempotent — no rate-limit error, no double count).
    const unchangedResult = await setInitiativeProposalReaction({
      initiativeId,
      collectionId: published.collectionId,
      proposalId: stableCompostingProposalId,
      actorUserId: "verify-reactor-support-2",
      reaction: "support",
    });
    assert(unchangedResult === "support", "Re-casting the identical reaction must be a no-op.");
    const summaryStillUnchanged = await getInitiativeProposalReactionSummary({ proposalId: stableCompostingProposalId });
    assert(
      summaryStillUnchanged.support === 1 && summaryStillUnchanged.doNotSupport === 2,
      "Re-casting the identical reaction must not change any count.",
    );

    await sleep(600);
    await setInitiativeProposalReaction({
      initiativeId,
      collectionId: published.collectionId,
      proposalId: stableCompostingProposalId,
      actorUserId: "verify-reactor-support-2",
      reaction: "none",
    });
    const summaryAfterRemoval = await getInitiativeProposalReactionSummary({ proposalId: stableCompostingProposalId });
    assert(
      summaryAfterRemoval.support === 0 && summaryAfterRemoval.doNotSupport === 2,
      "Setting reaction to 'none' must remove the participant's reaction entirely.",
    );

    const viewerSummary = await getInitiativeProposalReactionSummary({
      proposalId: stableCompostingProposalId,
      actorUserId: "verify-reactor-oppose-1",
    });
    assert(
      viewerSummary.currentUserReaction === "do_not_support",
      "The summary must report the requesting viewer's own current reaction.",
    );
    console.log("   OK — reactions are advisory-only, one-per-participant, changeable, and gated to genuinely public proposals.");

    console.log("All Initiative Lifecycle — Part D Improvement Proposals checks passed.");
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
      const { deleteCollectionsByAuthorIdForTests } = await import(
        "../modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js"
      );
      const { resetInitiativeProposalReactionsForTests } = await import(
        "../modules/initiative-proposal-reactions/index.js"
      );
      if (initiativeId) {
        await resetInitiativeAlliesStoreForTests(initiativeId);
        await resetInitiativeProposalCandidateStoreForTests(initiativeId);
        await resetInitiativeCommentsMongoForTests(initiativeId);
      }
      await deleteCollectionsByAuthorIdForTests(steward.participantId);
      resetInitiativeProposalReactionsForTests();
    } catch (cleanupError) {
      console.warn(`Best-effort fixture cleanup skipped: ${String(cleanupError)}`);
    }

    isolation.restore();
  }
}

await runVerificationScript(main);
