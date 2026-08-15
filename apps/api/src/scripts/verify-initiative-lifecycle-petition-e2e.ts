/**
 * Initiative Lifecycle — Part F (Intelligent Petition Vertical Slice)
 * end-to-end verification.
 *
 * Covers, against a real (isolated, per-run) MongoDB database:
 *   1. Petition Sources — the Intelligence Snapshot loads the real
 *      published Revision (the Petition's one mandatory source), the
 *      Author's published Collaborative Analysis, and the Improvement
 *      Proposals the Revision accepted.
 *   2. Petition Workspace — the working draft is auto-provisioned on
 *      first use, exactly once.
 *   3. Petition Draft Builder — Generate is deterministic (re-running
 *      against unchanged sources produces byte-identical output), and it
 *      fully recomputes generated fields rather than duplicating.
 *   4. Author edits (Save Draft) persist and are not clobbered until the
 *      Author explicitly clicks Generate again.
 *   5. Publish — Canonical Traceability (Revision ID/Version, Proposal
 *      IDs, Analysis Version) survives into the published Petition
 *      verbatim; the Petition transitions all the way to Open so Sign
 *      Petition is immediately available; the working draft is deleted.
 *   6. Public Petition — only the published Petition is visible, with its
 *      Traceability, Supporting Initiative/Revision/Proposal references,
 *      and the participation transparency note.
 *   7. Representative Signatures — Sign / Withdraw Signature, one
 *      signature per Participant, Participants/Members/Visitors are three
 *      independent, non-summed counters.
 *   8. Decision Session Integration — a Decision Session is ineligible
 *      before Petition publication and becomes eligible immediately after
 *      (Petition context, signature statistics).
 *   9. Lifecycle Stage Projection — Author/Guest resolve from the ONE
 *      shared renderer with correct permissions.
 *  10. Lifecycle notification fan-out — Active Allies notified once,
 *      Author excluded; retries never double-notify; Lifecycle Progress
 *      advances.
 *
 * Run: tsx apps/api/src/scripts/verify-initiative-lifecycle-petition-e2e.ts
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

const steward: RequestIdentity = {
  participantId: "verify-petition-steward-1",
  displayName: "Steward Verify",
};

async function main(): Promise<void> {
  const isolation = activateVerificationDatabaseIsolation("PART-F-PETITION");
  const runSuffix = isolation.runId;
  const initiativeCommunitySlug = `part-f-petition-verify-${runSuffix}`;

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
    } = await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
    const {
      createInitiativeImprovementProposalDraft,
      submitInitiativeImprovementProposal,
      decideInitiativeImprovementProposal,
    } = await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
    const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevisionStage } =
      await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
    const { buildInitiativePetitionIntelligenceSnapshot } = await import(
      "../modules/initiative-petition-lifecycle/initiative-petition-intelligence.service.js"
    );
    const {
      getInitiativePetitionWorkspaceContext,
      generateInitiativePetitionDraft,
      saveInitiativePetitionDraft,
      publishInitiativePetitionStage,
    } = await import("../modules/initiative-petition-lifecycle/initiative-petition-lifecycle.service.js");
    const { getInitiativePetitionDraftByInitiativeId } = await import(
      "../modules/initiative-petition-lifecycle/initiative-petition-draft.store.js"
    );
    const { signPetition, withdrawPetitionSignature, getPetition } = await import(
      "../modules/petition/petition.store.js"
    );
    const { toPublicPetitionProjection } = await import("../modules/petition/public-petition.projection.js");
    const {
      recordPetitionVisitorSignal,
      resetPetitionVisitorSignalsForTests,
    } = await import("../modules/petition/petition-visitor-signal.service.js");
    const { assessDecisionSessionEligibilityForInitiative } = await import(
      "../modules/decision-session/decision-session-eligibility.js"
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
    const { sampleMember } = await import("../modules/member/member.sample.js");

    console.log("1. Create published Initiative fixture (auto-creates version 1) with two Active Allies");
    const draft = createInitiativeDraft(steward, {
      title: "Part F Verification Neighborhood Composting",
      description: "Exists only to exercise the Intelligent Petition vertical slice end-to-end.",
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

    console.log("2. Published Collaborative Analysis fixture (a Petition Source)");
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

    // Initiative Lifecycle — Part F verification note: `revision
    // .acceptedProposalIds` (the field Petition Intelligence's
    // `buildProposalReferences` and Decision Session eligibility both
    // read) is populated from the Revision draft's `appliedProposalIds`,
    // which is validated against the OLDER, singular
    // `initiative-improvement-proposal` module — not the newer, plural
    // `initiative-improvement-proposals-stage` ("structured Proposals")
    // module Part D's own Author Workspace UI uses. This fixture
    // therefore mirrors `verify-decision-session-e2e.ts`'s existing
    // `buildEligibleInitiativeContext` pattern (the one real, working path
    // to a non-empty `acceptedProposalIds`) rather than Part D/E's
    // structured-proposal "changes" flow, which never touches
    // `appliedProposalIds` at all.
    console.log("3. Published (legacy-module) Improvement Proposal fixture, accepted by the Steward");
    const proposalDraft = await createInitiativeImprovementProposalDraft(steward, {
      analysisId: publishedAnalysis.analysisId,
      targetSection: "Description",
      currentIssue: "No dedicated composting infrastructure exists.",
      proposedChange: "Add a composting station near the entrance.",
      rationale: "Repeated Ally requests during Discussion.",
      expectedImprovement: "Reduces seasonal waste and gives residents a convenient drop-off point.",
      references: "Ally feedback.",
    });
    const submittedProposal = submitInitiativeImprovementProposal(steward, proposalDraft.proposalId);
    const decidedProposal = decideInitiativeImprovementProposal(steward, submittedProposal.proposalId, {
      decision: "accepted",
      decisionNote: "Accepted for the next Revision.",
    });
    assert(decidedProposal.status === "accepted", "The Proposal fixture must be Steward-accepted.");

    console.log("4. Published Revision fixture — the Petition's one mandatory source");
    createInitiativeRevisionDraft(steward, initiativeId);
    saveInitiativeRevisionDraft(steward, initiativeId, {
      title: initiative.title,
      description: initiative.description,
      revisionSummary: "Incorporated the composting Proposal.",
      appliedProposalIds: [decidedProposal.proposalId],
    });
    const { revision } = await publishInitiativeRevisionStage(steward, initiativeId);
    assert(revision.version === 2, "Publishing a Revision must create version 2.");
    assert(
      revision.acceptedProposalIds.includes(decidedProposal.proposalId),
      "The published Revision must record the accepted Proposal ID.",
    );

    console.log("5. Petition Sources — the Intelligence Snapshot loads only real, read-only upstream data");
    const snapshot = await buildInitiativePetitionIntelligenceSnapshot(initiativeId);
    assert(snapshot.isRevisionAvailable === true, "The snapshot must recognize the just-published Revision.");
    assert(
      snapshot.revisionReference?.revisionId === revision.revisionId && snapshot.revisionReference.version === 2,
      "The snapshot's Revision reference must be the real, just-published Revision.",
    );
    assert(
      snapshot.analysisReference?.analysisId === publishedAnalysis.analysisId,
      "The snapshot must reference the real published Collaborative Analysis.",
    );
    assert(
      snapshot.proposalReferences.some((p) => p.proposalId === decidedProposal.proposalId),
      "The snapshot must reference the real accepted Improvement Proposal.",
    );
    assert(
      snapshot.consistencyChecks.every((check) => check.status === "ok"),
      "With every source present, every Petition Assistant consistency check must report 'ok'.",
    );
    console.log("   OK — every Petition Source traces to a real, seeded, published record; sources remain read-only.");

    console.log("6. Petition Workspace — the working draft is auto-provisioned exactly once");
    const workspaceContext = await getInitiativePetitionWorkspaceContext(steward, initiativeId);
    assert(workspaceContext.draft !== null, "A Petition draft must be auto-provisioned on first Workspace visit.");
    assert(workspaceContext.publishedPetitionId === null, "No Petition has been published yet.");
    const secondWorkspaceContext = await getInitiativePetitionWorkspaceContext(steward, initiativeId);
    assert(
      secondWorkspaceContext.draft!.draftId === workspaceContext.draft!.draftId,
      "Revisiting the Workspace must reuse the same draft, never provision a second one.",
    );

    console.log("7. Petition Draft Builder — Generate is deterministic, never invents an AI decision");
    const firstDraftGenerate = await generateInitiativePetitionDraft(steward, initiativeId);
    assert(firstDraftGenerate.title === `Petition: ${initiative.title}`, "Generated title must be derived from the real Initiative title.");
    assert(
      firstDraftGenerate.publicSummary === revision.revisionSummary,
      "Generated Public Summary must be the real published Revision's Change Summary.",
    );
    assert(
      firstDraftGenerate.revisionId === revision.revisionId && firstDraftGenerate.revisionVersion === 2,
      "The generated draft must record the real Revision reference for Canonical Traceability.",
    );
    assert(
      firstDraftGenerate.proposalIds.includes(decidedProposal.proposalId),
      "The generated draft must record the real accepted Proposal reference.",
    );
    // Revision reference + Analysis reference + one Proposal reference.
    assert(
      firstDraftGenerate.keyArguments.length === 3 &&
        firstDraftGenerate.keyArguments.some((entry) => entry.includes(decidedProposal.proposalId)),
      "Key Arguments must cite the real Revision/Analysis/Proposal, never an invented one.",
    );

    const secondDraftGenerate = await generateInitiativePetitionDraft(steward, initiativeId);
    assert(
      secondDraftGenerate.title === firstDraftGenerate.title &&
        secondDraftGenerate.publicSummary === firstDraftGenerate.publicSummary &&
        secondDraftGenerate.requestStatement === firstDraftGenerate.requestStatement,
      "Re-running Generate against unchanged sources must be fully deterministic — byte-identical output.",
    );
    console.log("   OK — Generate is deterministic and enriching from real sources; never an AI-authored decision.");

    console.log("8. Author edits (Save Draft) persist; not overwritten until Generate is explicitly re-run");
    const manuallyEdited = saveInitiativePetitionDraft(steward, initiativeId, {
      requestStatement: "We respectfully ask the Initiative Author and community to adopt this Revision in full.",
    });
    assert(
      manuallyEdited.requestStatement ===
        "We respectfully ask the Initiative Author and community to adopt this Revision in full.",
      "Save Draft must persist the Author's manual edit verbatim.",
    );
    const draftAfterUnrelatedRead = getInitiativePetitionDraftByInitiativeId(initiativeId);
    assert(
      draftAfterUnrelatedRead?.requestStatement === manuallyEdited.requestStatement,
      "The Author's manual edit must survive without an explicit re-Generate.",
    );

    console.log("9. Decision Session Integration — ineligible before Petition publication");
    const eligibilityBeforePetition = await assessDecisionSessionEligibilityForInitiative(initiative);
    assert(
      eligibilityBeforePetition.eligible === false && eligibilityBeforePetition.hasPublishedPetition === false,
      "A Decision Session must remain ineligible until the Petition itself is published.",
    );

    console.log("10. Publish — Canonical Traceability survives verbatim; Petition opens for signing immediately");
    const publishedPetition = await publishInitiativePetitionStage(steward, initiativeId);
    assert(publishedPetition.status === "Open", "A Lifecycle-published Petition must open for signing immediately.");
    assert(
      publishedPetition.traceability?.revisionId === revision.revisionId &&
        publishedPetition.traceability.revisionVersion === 2,
      "The published Petition's Traceability must record the real Revision ID/Version verbatim.",
    );
    assert(
      publishedPetition.traceability?.proposalIds.includes(decidedProposal.proposalId) === true,
      "The published Petition's Traceability must record the real accepted Proposal ID verbatim.",
    );
    assert(
      publishedPetition.traceability?.analysisId === publishedAnalysis.analysisId,
      "The published Petition's Traceability must record the real Analysis reference.",
    );
    assert(
      getInitiativePetitionDraftByInitiativeId(initiativeId) === null,
      "The working Petition draft must be deleted once its Petition is published.",
    );
    const workspaceAfterPublish = await getInitiativePetitionWorkspaceContext(steward, initiativeId);
    assert(
      workspaceAfterPublish.publishedPetitionId === publishedPetition.petitionId,
      "The Workspace must report the real published Petition ID once published.",
    );
    console.log("   OK — every Traceability field survives publication verbatim; the consumed draft is gone.");

    console.log("11. Public Petition — only the published Petition is visible, with full Traceability");
    const publicPetition = await toPublicPetitionProjection(publishedPetition);
    assert(publicPetition !== null, "A published (Open) Petition must be publicly visible.");
    assert(
      publicPetition!.traceability?.revisionId === revision.revisionId,
      "The public projection must expose the real Traceability, not a duplicate/derived copy.",
    );
    assert(
      publicPetition!.relatedRevisionContext?.revisionId === revision.revisionId,
      "The public projection must surface the real Supporting Revision context.",
    );
    assert(
      publicPetition!.petitionSubject.requestStatement === manuallyEdited.requestStatement,
      "The public Petition must show the Author's real (possibly manually edited) Request Statement.",
    );
    assert(
      typeof publicPetition!.participationTransparencyNote === "string" &&
        publicPetition!.participationTransparencyNote.length > 0,
      "The public Petition must always show the participation transparency note.",
    );
    assert(
      publicPetition!.supportBreakdown.participantSignatures === 0 &&
        publicPetition!.supportBreakdown.visitorSignals === 0,
      "A freshly opened Petition must start with zero signatures/visitor signals.",
    );
    console.log("   OK — the public sees only the published Petition, its real Traceability, and zero-start counters.");

    console.log("12. Representative Signatures — Sign / Withdraw, one per Participant, three independent counters");
    resetPetitionVisitorSignalsForTests();
    const signed = await signPetition(publishedPetition.petitionId, sampleMember.id, "Public");
    assert(signed?.signatures.filter((s) => s.status === "Active").length === 1, "Exactly one Active signature must exist after signing once.");

    let doubleSignRejected = false;
    try {
      await signPetition(publishedPetition.petitionId, sampleMember.id, "Public");
    } catch {
      doubleSignRejected = true;
    }
    assert(doubleSignRejected, "Signing twice while already Active must be rejected — one signature per Participant.");

    await recordPetitionVisitorSignal({ petitionId: publishedPetition.petitionId, visitorKey: "verify-visitor-1" });
    await recordPetitionVisitorSignal({ petitionId: publishedPetition.petitionId, visitorKey: "verify-visitor-2" });
    // Repeating the same visitorKey must not double count — a Visitor signal
    // is idempotent per cookie/visitor identity, distinct from a Signature.
    await recordPetitionVisitorSignal({ petitionId: publishedPetition.petitionId, visitorKey: "verify-visitor-1" });

    const signedPetition = await getPetition(publishedPetition.petitionId);
    const publicPetitionAfterSign = await toPublicPetitionProjection(signedPetition!, sampleMember.id);
    assert(
      publicPetitionAfterSign!.supportBreakdown.participantSignatures === 1,
      "The Participants counter must reflect exactly the one real Active signature.",
    );
    assert(
      publicPetitionAfterSign!.supportBreakdown.visitorSignals === 2,
      `The Visitors counter must reflect exactly 2 distinct visitor keys (idempotent per key), got ${String(publicPetitionAfterSign!.supportBreakdown.visitorSignals)}.`,
    );
    assert(
      publicPetitionAfterSign!.supportBreakdown.memberSignatures <=
        publicPetitionAfterSign!.supportBreakdown.participantSignatures,
      "The Members counter must never exceed the Participants counter — Members are always a subset.",
    );
    assert(
      publicPetitionAfterSign!.viewerHasSigned === true,
      "The public projection must report the real signer's own viewerHasSigned as true.",
    );

    const withdrawn = await withdrawPetitionSignature(publishedPetition.petitionId, sampleMember.id);
    assert(
      withdrawn?.signatures.filter((s) => s.status === "Active").length === 0,
      "After withdrawal, zero Active signatures must remain.",
    );
    const publicPetitionAfterWithdraw = await toPublicPetitionProjection(withdrawn!, sampleMember.id);
    assert(
      publicPetitionAfterWithdraw!.supportBreakdown.participantSignatures === 0,
      "The Participants counter must drop to zero after the only signature is withdrawn.",
    );
    assert(
      publicPetitionAfterWithdraw!.supportBreakdown.visitorSignals === 2,
      "Withdrawing a Signature must never affect the independent Visitors counter.",
    );
    assert(
      publicPetitionAfterWithdraw!.viewerHasSigned === false,
      "After withdrawal, the same viewer's viewerHasSigned must become false.",
    );

    const resigned = await signPetition(publishedPetition.petitionId, sampleMember.id, "Public");
    assert(
      resigned?.signatures.filter((s) => s.participantId === sampleMember.id).length === 1,
      "Re-signing after withdrawal must reactivate the same Signature row, never insert a duplicate.",
    );
    console.log("   OK — Sign/Withdraw both work; Participants/Members/Visitors remain three independent, non-summed counters.");

    console.log("13. Decision Session Integration — eligible immediately after Petition publication");
    const eligibilityAfterPetition = await assessDecisionSessionEligibilityForInitiative(initiative);
    assert(
      eligibilityAfterPetition.eligible === true && eligibilityAfterPetition.hasPublishedPetition === true,
      "A Decision Session must become eligible immediately once the Petition is published.",
    );

    console.log("14. Lifecycle Stage Projection — Author/Guest, Decision Session unlocked");
    const initiativeAfterPetition = { ...initiative };
    const authorProjection = await buildInitiativeLifecycleStageProjection({
      initiative: initiativeAfterPetition,
      stageId: "petition",
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
      getNextInitiativeLifecycleStageId("petition") === "decision_session",
      "The next stage after Petition must be Decision Session — unlocked.",
    );
    assert(
      authorProjection?.nextStage?.stageId === "decision_session",
      "The projection's own nextStage must point at Decision Session.",
    );

    const guestProjection = await buildInitiativeLifecycleStageProjection({
      initiative: initiativeAfterPetition,
      stageId: "petition",
      viewerParticipantId: null,
    });
    assert(
      guestProjection?.viewerRole === "guest" && guestProjection.presentationMode === "public",
      "A signed-out Guest must see the public renderer.",
    );
    assert(
      guestProjection?.aiCapabilities.canGenerateDraft === false,
      "The AI Assistant must never expose Author-only capabilities (Generate) to a Guest.",
    );
    console.log("   OK — Author/Guest resolve from the ONE shared renderer with correct permissions; Decision Session unlocked.");

    console.log("15. Lifecycle notification fan-out — Active Allies notified once, Author excluded");
    const notificationRuns: Array<{ userId: string; title: string; message: string; relatedUrl: string }> = [];
    const fakeAllyIds = [steward.participantId, "verify-ally-active-1", "verify-ally-active-2"];
    const now = new Date().toISOString();
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

    // `publishInitiativePetitionStage` (Section 10) already performed the
    // ONE real publish transition, internally calling this exact same
    // `publishInitiativeLifecycleStage` function. Calling it again here
    // with identical coordinates is therefore a genuine retry, which must
    // resolve to `"duplicate_ignored"`.
    const publishOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "petition",
      stageLabel: "Petition",
      stageArtifactId: publishedPetition.petitionId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#petition`,
    });
    assert(
      publishOutcome.outcome === "duplicate_ignored",
      "Section 10's real Publish already enqueued this exact transition; retrying it here must be ignored.",
    );

    const outboxDocument = await getMongoCollection<{ envelope: string; eventName: string }>(
      MONGO_COLLECTIONS.outbox,
    ).findOne({ eventId: publishOutcome.event.eventId });
    assert(outboxDocument !== null, "The publication event enqueued by Section 10's real Publish must be findable.");
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
      notificationRuns.every((run) => run.relatedUrl.includes("#petition")),
      "Notification must deep-link to the Petition stage.",
    );

    const allyNotifications = await listMyNotifications({
      userId: "user-verify-ally-active-1",
      status: "all",
      limit: 20,
      offset: 0,
    });
    assert(
      allyNotifications.notifications.some((n) => n.relatedUrl?.includes("#petition")),
      "The Active Ally's own /notifications feed must contain the delivered Petition notification.",
    );

    const retryOutcome = await publishInitiativeLifecycleStage({
      initiativeId,
      initiativeTitle: initiative.title,
      stageId: "petition",
      stageLabel: "Petition",
      stageArtifactId: publishedPetition.petitionId,
      stageVersion: 1,
      actorParticipantId: steward.participantId,
      publicationKind: "published",
      relatedUrl: `/initiatives/public/${encodeURIComponent(initiativeId)}#petition`,
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
    console.log("   OK — exactly the Active Allies (never the Author) are notified once; retries never double-notify; Lifecycle Progress advances.");

    console.log("All Initiative Lifecycle — Part F Petition checks passed.");
  } finally {
    try {
      const { resetInitiativeAlliesStoreForTests } = await import(
        "../modules/initiative-discussion-collaboration/initiative-ally.store.js"
      );
      const { resetPetitionVisitorSignalsForTests } = await import(
        "../modules/petition/petition-visitor-signal.service.js"
      );
      if (initiativeId) {
        await resetInitiativeAlliesStoreForTests(initiativeId);
      }
      resetPetitionVisitorSignalsForTests();
    } catch (cleanupError) {
      console.warn(`Best-effort fixture cleanup skipped: ${String(cleanupError)}`);
    }

    isolation.restore();
  }
}

await runVerificationScript(main);
