/**
 * Initiative Lifecycle — Part E (Intelligent Revision Vertical Slice)
 * end-to-end verification.
 *
 * Covers, against a real (isolated, per-run) MongoDB database:
 *   1. Revision Sources — published Initiative, published Collaborative
 *      Analysis, published Improvement Proposals (curated + unresolved),
 *      all loaded read-only by the Revision Intelligence Snapshot.
 *   2. Intelligent Revision Builder — deterministic Generate is enriching
 *      (never duplicating), never invents an acceptance decision.
 *   3. Author-originated changes — explicit reason + explanation, fully
 *      participates in traceability alongside Proposal-based changes.
 *   4. Conflict Detection — two changes targeting the same section.
 *   5. Canonical Traceability — publish is rejected when any change loses
 *      its Proposal reference or Author-originated reason.
 *   6. Apply — the Author-triggered, explicit copy of a reviewed "after"
 *      into the draft's real title/description (never automatic).
 *   7. Publish — Proposal IDs and structured changes survive into the
 *      published `InitiativeVersionRevision`, verbatim.
 *   8. Public Presentation — Before/After, Change Summary, Proposal
 *      references, zero-start Community Reactions.
 *   9. Lifecycle Stage Projection — Author/Guest, Petition unlocked.
 *  10. Lifecycle notification fan-out — Active Allies notified once,
 *      Author excluded, exact required copy, idempotent retries.
 *  11. Community Reactions — Support / Do Not Support, one per
 *      participant, changeable, blocked on a non-existent version.
 *  12. Petition Integration — Petition's public projection surfaces the
 *      Published Revision's Change Summary/metadata, informationally.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-revision-e2e.ts
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
  participantId: "verify-revision-steward-1",
  displayName: "Steward Verify",
};

async function main(): Promise<void> {
  const isolation = await activateVerificationDatabaseIsolationAsync("PART-E-REVISION");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-e-revision-verify-${runSuffix}`;

  let initiativeId = "";
  let petitionId = "";

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
    } = await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
    const {
      generateImprovementProposalsDraft,
      addManualInitiativeStructuredProposal,
      setInitiativeStructuredProposalStatus,
      publishImprovementProposalsCollection,
    } = await import(
      "../modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.service.js"
    );
    const { buildInitiativeRevisionIntelligenceSnapshot } = await import(
      "../modules/initiative-version-revision/initiative-revision-intelligence.service.js"
    );
    const {
      getInitiativeRevisionWorkspaceContext,
      generateInitiativeRevisionChanges,
      addAuthorOriginatedRevisionChange,
      saveRevisionChange,
      removeRevisionChange,
      applyRevisionChangeToDraft,
      saveInitiativeRevisionDraft,
      publishInitiativeRevision,
      publishInitiativeRevisionStage,
    } = await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
    const { getRevisionDraftByInitiativeId, updateRevisionDraft, getRevisionByInitiativeAndVersion } = await import(
      "../modules/initiative-version-revision/initiative-version-revision.store.js"
    );
    const { getPublicInitiativeVersionRevision } = await import(
      "../modules/initiative-version-revision/public-initiative-version-revision.projection.js"
    );
    const { buildInitiativeLifecycleStageProjection } = await import(
      "../modules/initiatives/initiative-lifecycle-stage-projection.service.js"
    );
    const { getNextInitiativeLifecycleStageId } = await import("@hu/types");
    const {
      handleInitiativeLifecycleStagePublishedNotification,
      publishInitiativeLifecycleStage,
    } = await import("../shared/initiative-lifecycle-stage/index.js");
    const { setInitiativeRevisionReaction, getInitiativeRevisionReactionSummary } = await import(
      "../modules/initiative-revision-reactions/index.js"
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
    const { createDecision } = await import("../modules/collective-decision/collective-decision.store.js");
    const { bootstrapCollectiveDecision } = await import(
      "../modules/collective-decision/bootstrap-collective-decision.js"
    );
    const { createPetition, preparePetition, publishPetition } = await import(
      "../modules/petition/petition.store.js"
    );
    const { defaultPetitionPolicy } = await import("../modules/petition/petition.defaults.js");
    const { toPublicPetitionProjection } = await import("../modules/petition/public-petition.projection.js");

    console.log("1. Create published Initiative fixture (auto-creates version 1)");
    const draft = createInitiativeDraft(steward, {
      title: "Part E Verification Community Garden",
      description: "Exists only to exercise the Intelligent Revision vertical slice end-to-end.",
      communitySlug: initiativeCommunitySlug,
      activityArea: "Environment",
    });
    const initiative = publishInitiative(steward, draft.initiativeId);
    initiativeId = initiative.initiativeId;
    assert(initiative.lifecyclePhase === "projected", "Initiative must be published/projected.");

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

    console.log("2. Published Collaborative Analysis fixture (Part 1/2 — Revision Sources include the published Analysis)");
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

    console.log("3. Published Improvement Proposals fixture — one curated 'Included in Revision', one still 'unresolved'");
    // `addManualInitiativeStructuredProposal` requires an existing
    // collectionId — provision one via the same Generate-then-add flow
    // Part D's own Author Workspace uses, since this Initiative has no
    // Discussion candidates seeded for this verification run.
    const emptyCollection = await generateImprovementProposalsDraft(steward, initiativeId);
    assert(emptyCollection.proposals.length === 0, "With no Discussion candidates, Generate must produce zero proposals.");

    const withCompost = await addManualInitiativeStructuredProposal(steward, emptyCollection.collectionId, {
      title: "Add a composting station near the entrance",
      summary: "Add a dedicated composting station near the entrance.",
      description: "A dedicated bin reduces contamination of general waste.",
      reason: "Repeated Ally requests during Discussion.",
      expectedImprovement: "Reduces seasonal waste and gives residents a convenient drop-off point.",
      supportingSources: "",
      relatedDiscussionReferences: "",
    });
    const withFunding = await addManualInitiativeStructuredProposal(steward, emptyCollection.collectionId, {
      title: "Increase winter maintenance funding",
      summary: "Increase the budget allocated for winter maintenance.",
      description: "Winter maintenance has been underfunded for two seasons.",
      reason: "Budget shortfall reported by multiple Allies.",
      expectedImprovement: "Consistent snow/ice clearing across the season.",
      supportingSources: "",
      relatedDiscussionReferences: "",
    });
    const compostStructuredId = withCompost.proposals.find((p) => p.title.includes("composting"))!.proposalId;
    const fundingStructuredId = withFunding.proposals.find((p) => p.title.includes("funding"))!.proposalId;

    await setInitiativeStructuredProposalStatus(steward, emptyCollection.collectionId, compostStructuredId, "ready");
    await setInitiativeStructuredProposalStatus(steward, emptyCollection.collectionId, fundingStructuredId, "ready");
    const publishedProposals = await publishImprovementProposalsCollection(steward, emptyCollection.collectionId);
    assert(publishedProposals.status === "published", "Improvement Proposals collection must be published.");

    // Author curates the composting proposal for this Revision; the
    // funding proposal is deliberately left "published" — an unresolved
    // proposal the Revision Assistant must highlight (Part 4).
    await setInitiativeStructuredProposalStatus(
      steward,
      emptyCollection.collectionId,
      compostStructuredId,
      "included_in_revision",
    );
    console.log("   OK — one published, curated ('Included in Revision') Proposal; one published, unresolved Proposal.");

    console.log("4. Revision Sources / Intelligent Revision Builder — the intelligence snapshot loads only real, read-only data");
    const snapshotBeforeDraft = await buildInitiativeRevisionIntelligenceSnapshot(initiativeId);
    assert(snapshotBeforeDraft.eligibleProposals.length === 2, "Both published proposals must be eligible sources.");
    assert(
      snapshotBeforeDraft.analysisReference?.analysisId === publishedAnalysis.analysisId,
      "The snapshot must reference the real published Collaborative Analysis.",
    );
    assert(
      snapshotBeforeDraft.missingReferenceProposalIds.includes(compostStructuredId),
      "Before any change exists, the curated composting proposal must be a 'missing reference'.",
    );
    assert(
      snapshotBeforeDraft.unresolvedProposalIds.includes(fundingStructuredId),
      "The still-'published' funding proposal must surface as unresolved.",
    );
    assert(
      snapshotBeforeDraft.currentDescription === initiative.description,
      "With no draft yet, the Builder's baseline must be the Current published Initiative text.",
    );
    console.log("   OK — every Intelligence field traces to real, seeded records; sources remain read-only.");

    console.log("5. Author Workspace context — no draft yet, eligible structured proposals surfaced");
    const workspaceContext = await getInitiativeRevisionWorkspaceContext(steward, initiativeId);
    assert(workspaceContext.draft === null, "No Revision draft must exist before the Author starts one.");
    assert(workspaceContext.currentVersion === 1, "Exactly one published version (the initial one) must exist so far.");
    assert(
      workspaceContext.eligibleStructuredProposals.length === 2,
      "Both published structured proposals must be surfaced as eligible sources.",
    );

    console.log("6. Intelligent Revision Builder — Generate is enriching, never duplicating, never AI-published");
    const firstGenerate = await generateInitiativeRevisionChanges(steward, initiativeId);
    assert(firstGenerate.changes.length === 1, "Generate must create exactly one suggested change for the one curated proposal.");
    const generatedChange = firstGenerate.changes[0]!;
    assert(generatedChange.origin === "proposal", "A Builder-generated change's origin must be 'proposal'.");
    assert(
      generatedChange.proposalIds.length === 1 && generatedChange.proposalIds[0] === compostStructuredId,
      "The generated change must reference exactly the curated composting Proposal ID.",
    );
    assert(generatedChange.section === "description", "The Builder's suggestion targets the description section.");
    assert(generatedChange.before === initiative.description, "'before' must be the real current description, verbatim.");

    const secondGenerate = await generateInitiativeRevisionChanges(steward, initiativeId);
    assert(
      secondGenerate.changes.length === 1,
      "Re-running Generate against unchanged sources must be enriching, not duplicating — still exactly 1 change.",
    );
    console.log("   OK — Generate proposes text changes deterministically; re-running never duplicates.");

    console.log("7. Author-originated changes — explicit reason + explanation, participates in full traceability");
    const withAuthorChange = addAuthorOriginatedRevisionChange(steward, initiativeId, {
      section: "title",
      after: "Community Garden & Composting Initiative",
      before: initiative.title,
      authorOriginatedReason: "Improves discoverability in search.",
      explanation: "The Author renamed the Initiative to reflect its expanded composting scope.",
    });
    assert(withAuthorChange.changes.length === 2, "Adding an Author-originated change must add exactly one more change.");
    const authorChange = withAuthorChange.changes.find((c) => c.origin === "author_originated")!;
    assert(authorChange.proposalIds.length === 0, "An Author-originated change must carry no Proposal IDs.");
    assert(
      authorChange.authorOriginatedReason === "Improves discoverability in search.",
      "The Author-originated reason must persist verbatim.",
    );
    console.log("   OK — an Author-originated change is fully tracked with its own reason and explanation.");

    console.log("8. Conflict Detection — two changes targeting the same section");
    const conflictingChange = addAuthorOriginatedRevisionChange(steward, initiativeId, {
      section: "description",
      after: "A second, competing description edit.",
      before: initiative.description,
      authorOriginatedReason: "Testing conflict detection.",
      explanation: "Deliberately targets the same section as the Builder's suggestion.",
    });
    assert(conflictingChange.changes.length === 3, "Three changes must now exist in the working draft.");
    const conflictSnapshot = await buildInitiativeRevisionIntelligenceSnapshot(initiativeId);
    assert(
      conflictSnapshot.conflictWarnings.length === 1 && conflictSnapshot.conflictWarnings[0]!.section === "description",
      "Two changes targeting 'description' must raise exactly one Conflict Warning for that section.",
    );
    const conflictingChangeId = conflictingChange.changes.find(
      (c) => c.after === "A second, competing description edit.",
    )!.changeId;
    const afterRemoval = removeRevisionChange(steward, initiativeId, conflictingChangeId);
    assert(afterRemoval.changes.length === 2, "Removing the conflicting change must resolve back to 2 changes.");
    const resolvedSnapshot = await buildInitiativeRevisionIntelligenceSnapshot(initiativeId);
    assert(resolvedSnapshot.conflictWarnings.length === 0, "Removing the conflicting change must clear the warning.");
    console.log("   OK — Conflict Detection is deterministic and advisory; the Author resolves it by editing/removing changes.");

    console.log("9. Canonical Traceability — publish rejects any change lacking a Proposal reference or Author-originated reason");
    const editedChange = saveRevisionChange(steward, initiativeId, generatedChange.changeId, {
      explanation: "Revised explanation confirming the traceable rationale.",
    });
    const stillTracedChange = editedChange.changes.find((c) => c.changeId === generatedChange.changeId)!;
    assert(
      stillTracedChange.explanation === "Revised explanation confirming the traceable rationale.",
      "Editing a change must persist the Author's explanation edit.",
    );

    // A real revisionSummary must already be in place so that the ONLY
    // reason publish can fail below is the traceability violation itself
    // (not the unrelated, already-covered "revisionSummary is required"
    // check) — this is set once, for real, ahead of the final Publish in
    // Section 12 too.
    saveInitiativeRevisionDraft(steward, initiativeId, {
      revisionSummary: "Incorporated the composting Proposal and renamed the Initiative for clarity.",
    });

    updateRevisionDraft(initiativeId, {
      changes: editedChange.changes.map((c) =>
        c.changeId === authorChange.changeId ? { ...c, proposalIds: [], authorOriginatedReason: null } : c,
      ),
    });
    let untracedPublishError: string | null = null;
    try {
      publishInitiativeRevision(steward, initiativeId);
    } catch (error) {
      untracedPublishError = error instanceof Error ? error.message : String(error);
    }
    assert(
      untracedPublishError !== null && /requires a reason/.test(untracedPublishError),
      `Publish must reject specifically on the missing Author-originated reason, got: ${String(untracedPublishError)}`,
    );
    // Restore the valid, fully-traceable state before continuing.
    updateRevisionDraft(initiativeId, {
      changes: editedChange.changes.map((c) =>
        c.changeId === authorChange.changeId
          ? { ...c, proposalIds: [], authorOriginatedReason: "Improves discoverability in search." }
          : c,
      ),
    });
    console.log("   OK — an untraceable change blocks publication; every declared change must have an identifiable origin.");

    console.log("10. Apply — Author-triggered, explicit copy of a reviewed 'after' into the draft's real text (never automatic)");
    const beforeApply = getRevisionDraftByInitiativeId(initiativeId)!;
    assert(
      beforeApply.description === initiative.description,
      "Before Apply, the draft's real description must remain untouched by the still-pending suggestion.",
    );
    const appliedDraft = applyRevisionChangeToDraft(steward, initiativeId, generatedChange.changeId);
    assert(
      appliedDraft.description === generatedChange.after,
      "Apply must copy exactly the reviewed 'after' text into the draft's real description.",
    );
    const appliedTitleDraft = applyRevisionChangeToDraft(steward, initiativeId, authorChange.changeId);
    assert(
      appliedTitleDraft.title === authorChange.after,
      "Apply must copy the Author-originated change's 'after' text into the draft's real title too.",
    );
    console.log("   OK — Apply only ever runs when the Author explicitly triggers it, once per change.");

    console.log("11. Save Draft — revisionSummary already set in Section 9, real edits persist across Save Draft calls");
    const resavedDraft = saveInitiativeRevisionDraft(steward, initiativeId, {
      revisionSummary: "Incorporated the composting Proposal and renamed the Initiative for clarity.",
    });
    assert(
      resavedDraft.changes.length === 2,
      "Save Draft must never touch the structured changes array — only its own explicit fields.",
    );

    console.log("12. Publish — Proposal IDs and structured changes survive publication verbatim");
    const { revision, initiative: initiativeAfterPublish } = await publishInitiativeRevisionStage(
      steward,
      initiativeId,
    );
    assert(revision.version === 2, "Publishing a Revision must create version 2.");
    assert(revision.changes.length === 2, "Both fully-traceable changes must survive into the published revision.");
    const publishedGeneratedChange = revision.changes.find((c) => c.changeId === generatedChange.changeId)!;
    assert(
      publishedGeneratedChange.proposalIds[0] === compostStructuredId,
      "The Proposal-based change's Proposal ID must survive publication verbatim (Part 7 traceability).",
    );
    const publishedAuthorChange = revision.changes.find((c) => c.changeId === authorChange.changeId)!;
    assert(
      publishedAuthorChange.authorOriginatedReason === "Improves discoverability in search.",
      "The Author-originated change's reason must survive publication verbatim.",
    );
    assert(
      revision.description === generatedChange.after,
      "The published revision's description must reflect the Applied suggestion.",
    );
    assert(
      revision.title === authorChange.after,
      "The published revision's title must reflect the Applied Author-originated change.",
    );
    assert(
      initiativeAfterPublish.description === revision.description,
      "Publishing a Revision is the only place the Initiative's own text changes.",
    );
    assert(
      getRevisionDraftByInitiativeId(initiativeId) === null,
      "The working draft must be deleted once its Revision is published.",
    );
    console.log("   OK — every published change keeps its exact Proposal reference / Author-originated reason; Initiative text updated exactly once.");

    console.log("13. Public Presentation — Before/After, Change Summary, Proposal references, zero-start reactions");
    const publicRevision = await getPublicInitiativeVersionRevision(initiativeId, 2, null);
    assert(publicRevision !== null, "A published revision must be publicly visible.");
    assert(publicRevision!.changes.length === 2, "The public projection must expose every published structured change.");
    assert(
      publicRevision!.changes.every((c) => c.origin === "proposal" || Boolean(c.authorOriginatedReason)),
      "Every publicly-visible change must show its Origin and (if Author-originated) its reason.",
    );
    assert(
      publicRevision!.reactionSummary.support === 0 && publicRevision!.reactionSummary.doNotSupport === 0,
      "A freshly published revision must start with zero reactions.",
    );
    assert(publicRevision!.isCurrent === true, "Version 2 must now be the current published version.");
    console.log("   OK — Public sees only the published Revision, its Before/After trace, and Proposal references; no editing controls.");

    console.log("14. Lifecycle Stage Projection — Author/Guest, Petition unlocked");
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative: initiativeAfterPublish,
      stageId: "revision",
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
      authorProjection?.metadata.publishedRecordId === "2",
      "Lifecycle metadata must reference the real published version (2).",
    );
    assert(
      getNextInitiativeLifecycleStageId("revision") === "petition",
      "The next stage after Revision must be Petition — unlocked (Part 11/12/13).",
    );
    assert(authorProjection?.nextStage?.stageId === "petition", "The projection's own nextStage must point at Petition.");

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative: initiativeAfterPublish,
      stageId: "revision",
      viewerParticipantId: null,
    });
    assert(guestProjection?.viewerRole === "guest" && guestProjection.presentationMode === "public", "A signed-out Guest must see the public renderer.");
    assert(
      guestProjection?.aiCapabilities.canGenerateDraft === false,
      "The AI Assistant must never expose Author-only capabilities (Generate) to a Guest.",
    );
    console.log("   OK — Author/Guest resolve from the ONE shared renderer with correct permissions; Petition unlocked.");

    console.log("15. Lifecycle notification fan-out — Active Allies notified, Author excluded, exact required copy");
    const notificationRuns: Array<{ userId: string; title: string; message: string; relatedUrl: string }> = [];
    const fakeAllyIds = [steward.participantId, "verify-ally-active-1", "verify-ally-active-2"];
    const now = new Date().toISOString();
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

    // `publishInitiativeRevisionStage` (Section 12) already performed the
    // ONE real publish transition, internally calling this exact same
    // `publishInitiativeLifecycleStage` function. Calling it again here
    // with identical coordinates is therefore a genuine retry, which must
    // resolve to `"duplicate_ignored"`.
    const publishOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: revision.title,
      stageId: "revision",
      stageLabel: "Revision",
      stageArtifactId: revision.revisionId,
      stageVersion: revision.version,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#revision`,
    });
    assert(
      publishOutcome.outcome === "duplicate_ignored",
      "Section 12's real Publish already enqueued this exact transition; retrying it here must be ignored.",
    );

    const outboxDocument = await getMongoCollection<{ envelope: string; eventName: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: publishOutcome.event.eventId });
    assert(outboxDocument !== null, "The publication event enqueued by Section 12's real Publish must be findable.");
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
      notificationRuns.every((run) => run.title === "Revision Published"),
      'Notification title must be exactly "Revision Published".',
    );
    assert(
      notificationRuns.every(
        (run) => run.message === `The Initiative Author has published a new Revision for "${revision.title}".`,
      ),
      "Notification body must be the exact required, Initiative-specific copy.",
    );
    assert(
      notificationRuns.every((run) => run.relatedUrl.includes("#revision")),
      "Notification must deep-link to the Revision stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: "user-verify-ally-active-1",
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.title === "Revision Published"),
      "The Active Ally's own /notifications feed must contain the delivered notification.",
    );

    // A second, independent retry proves idempotency holds under repeats.
    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: revision.title,
      stageId: "revision",
      stageLabel: "Revision",
      stageArtifactId: revision.revisionId,
      stageVersion: revision.version,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#revision`,
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
    console.log("   OK — exactly the Active Allies (never the Author) are notified once, with the exact required copy; retries never double-notify; Lifecycle Progress advances.");

    console.log("16. Community Reactions — Support / Do Not Support, one per participant, changeable, blocked on a non-existent version");
    let rejectedReactionOnMissingVersion = false;
    try {
      await setInitiativeRevisionReaction({
        initiativeId,
        version: 99,
        actorUserId: "verify-reactor-illegal",
        reaction: "support",
      });
    } catch {
      rejectedReactionOnMissingVersion = true;
    }
    assert(rejectedReactionOnMissingVersion, "Reacting to a non-existent revision version must be rejected.");

    const targetRevisionId = getRevisionByInitiativeAndVersion(initiativeId, 2)!.revisionId;
    const summaryBefore = await getInitiativeRevisionReactionSummary({ revisionId: targetRevisionId });
    assert(summaryBefore.support === 0 && summaryBefore.doNotSupport === 0, "Reaction summary must start at zero.");

    await setInitiativeRevisionReaction({
      initiativeId,
      version: 2,
      actorUserId: "verify-reactor-support-1",
      reaction: "support",
    });
    await setInitiativeRevisionReaction({
      initiativeId,
      version: 2,
      actorUserId: "verify-reactor-support-2",
      reaction: "support",
    });
    await setInitiativeRevisionReaction({
      initiativeId,
      version: 2,
      actorUserId: "verify-reactor-oppose-1",
      reaction: "do_not_support",
    });
    const summaryAfterThree = await getInitiativeRevisionReactionSummary({ revisionId: targetRevisionId });
    assert(
      summaryAfterThree.support === 2 && summaryAfterThree.doNotSupport === 1,
      "Counts must update immediately to reflect exactly the reactions just cast.",
    );

    await sleep(600);
    await setInitiativeRevisionReaction({
      initiativeId,
      version: 2,
      actorUserId: "verify-reactor-support-1",
      reaction: "do_not_support",
    });
    const summaryAfterChange = await getInitiativeRevisionReactionSummary({ revisionId: targetRevisionId });
    assert(
      summaryAfterChange.support === 1 && summaryAfterChange.doNotSupport === 2,
      "Changing an existing reaction must move the count, never create a second reaction for the same participant.",
    );

    await sleep(600);
    await setInitiativeRevisionReaction({
      initiativeId,
      version: 2,
      actorUserId: "verify-reactor-oppose-1",
      reaction: "none",
    });
    const summaryAfterRemoval = await getInitiativeRevisionReactionSummary({ revisionId: targetRevisionId });
    assert(
      summaryAfterRemoval.support === 1 && summaryAfterRemoval.doNotSupport === 1,
      "Setting reaction to 'none' must remove the participant's reaction entirely.",
    );

    const viewerSummary = await getInitiativeRevisionReactionSummary({
      revisionId: targetRevisionId,
      actorUserId: "verify-reactor-support-2",
    });
    assert(
      viewerSummary.currentUserReaction === "support",
      "The summary must report the requesting viewer's own current reaction.",
    );
    console.log("   OK — reactions are advisory-only, one-per-participant, changeable, and gated to a genuinely published revision.");

    console.log("17. Petition Integration — Petition's public projection surfaces the Published Revision informationally");
    const decisionId = `decision-part-e-revision-verify-${runSuffix}`;
    await createDecision({
      ...structuredClone(bootstrapCollectiveDecision),
      decisionId,
      decisionSubjectId: initiativeId,
    });
    petitionId = `petition-part-e-revision-verify-${runSuffix}`;
    const petitionNow = new Date().toISOString();
    const petition = await createPetition({
      petitionId,
      collectiveDecisionId: decisionId,
      status: "Draft",
      createdAt: petitionNow,
      updatedAt: petitionNow,
      subject: {
        decisionId,
        initiativeId,
        title: "Part E Revision Verification Petition",
        summary: "Exercises the Petition Integration seam end-to-end.",
      },
      policy: structuredClone(defaultPetitionPolicy),
      shareLink: null,
      signatures: [],
      supportMetrics: {
        totalSignatures: 0,
        participantSignatures: 0,
        dailyActivity: [],
        supportThresholdStatus: {
          thresholdDefined: false,
          thresholdReached: false,
          currentCount: 0,
          thresholdCount: null,
        },
      },
      outcome: null,
    });
    void petition;

    // Only a Ready-or-later Petition is publicly visible at all (Draft
    // and Ready are Author-only) — advance it once so the public
    // projection (and this integration seam) is actually reachable.
    await preparePetition(petitionId);
    const publishedPetition = await publishPetition(petitionId);
    assert(publishedPetition !== null, "The Petition fixture must transition to Published.");

    const petitionProjection = await toPublicPetitionProjection(publishedPetition!);
    assert(petitionProjection !== null, "A Published Petition must be publicly visible.");
    assert(
      petitionProjection.relatedRevisionContext !== null,
      "The Petition's public projection must surface the Initiative's latest Published Revision.",
    );
    assert(
      petitionProjection.relatedRevisionContext!.revisionId === revision.revisionId,
      "The Petition's revision context must reference the real, just-published Revision.",
    );
    assert(
      petitionProjection.relatedRevisionContext!.version === 2,
      "The Petition's revision context must report the real published version.",
    );
    assert(
      petitionProjection.relatedRevisionContext!.changeCount === revision.changes.length,
      "The Petition's revision context must report the real Change Summary count.",
    );
    console.log("   OK — Petition automatically receives the Published Revision's metadata and Change Summary, with no duplicated editing.");

    console.log("All Initiative Lifecycle — Part E Revision checks passed.");
  } finally {
    try {
      if (petitionId) {
        const { deletePetitionsByIdForTests } = await import("../modules/petition/petition.store.js");
        await deletePetitionsByIdForTests(petitionId);
      }
      const { resetInitiativeAlliesStoreForTests } = await import(
        "../modules/initiative-discussion-collaboration/initiative-ally.store.js"
      );
      const { deleteCollectionsByAuthorIdForTests } = await import(
        "../modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.store.js"
      );
      const { resetInitiativeRevisionReactionsForTests } = await import(
        "../modules/initiative-revision-reactions/initiative-revision-reaction.service.js"
      );
      if (initiativeId) {
        await resetInitiativeAlliesStoreForTests(initiativeId);
      }
      await deleteCollectionsByAuthorIdForTests(steward.participantId);
      resetInitiativeRevisionReactionsForTests();
    } catch (cleanupError) {
      console.warn(`Best-effort fixture cleanup skipped: ${String(cleanupError)}`);
    }

    await isolation.dispose();
  }
}

await runVerificationScript(main);
