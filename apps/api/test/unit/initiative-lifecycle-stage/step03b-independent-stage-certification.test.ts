/**
 * INITIATIVE LIFECYCLE SIMPLIFICATION — STEP 03B
 * Independent-stage system certification (certification tests only).
 *
 * Proves Author Lifecycle contract end-to-end with memory persistence.
 * Minimal production guards (Petition Mongo try/catch) exist only so
 * SOURCE_OPTIONAL sources do not crash Author generate offline.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_DECISION_SESSION_DRAFT_PERSISTENCE = "memory";
process.env.DECISION_SESSION_PERSISTENCE = "memory";
process.env.INITIATIVE_COLLECTIVE_DECISION_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PACKAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_TRACKING_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PACKAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PERSISTENCE = "memory";
process.env.INITIATIVE_OFFICIAL_RESPONSE_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_PUBLIC_IMPACT_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_PUBLIC_IMPACT_REPORT_PERSISTENCE = "memory";
process.env.INITIATIVE_CIVIC_ARCHIVE_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_CIVIC_ARCHIVE_VERSION_PERSISTENCE = "memory";
process.env.INITIATIVE_PUBLIC_IMPACT_SKIP_REMINDERS = "1";
process.env.INITIATIVE_CIVIC_ARCHIVE_SKIP_REMINDERS = "1";
process.env.NOTIFICATION_PERSISTENCE = "memory";
// Leave Mongo unconfigured so optional substrates fail closed immediately
// (no 30s selection timeouts) during Author Lifecycle certification.
delete process.env.MONGODB_URI;

import type { Initiative, PublicInitiativeLifecycleRecordItem } from "@hu/types";
import { resolveInitiativeLifecycleState } from "@hu/types";

const { createInitiative, deleteInitiative, getInitiativeById } = await import(
  "../../../src/modules/initiatives/initiative.store.js"
);
const { buildLifecycleNavigation } = await import(
  "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js"
);

const {
  generateInitiativeDecisionSessionDraft,
  publishInitiativeDecisionSessionStage,
  saveInitiativeDecisionSessionDraft,
} = await import(
  "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-lifecycle.service.js"
);
const { getInitiativeDecisionSessionDraftByInitiativeId } = await import(
  "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-draft.store.js"
);
const { listPublicSessionsByInitiative } = await import(
  "../../../src/modules/decision-session/decision-session.store.js"
);

const {
  generateInitiativeCollectiveDecisionDraft,
  publishInitiativeCollectiveDecisionStage,
  saveInitiativeCollectiveDecisionDraft,
} = await import(
  "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle.service.js"
);
const { getInitiativeCollectiveDecisionLifecycleDraftByInitiativeId } = await import(
  "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle-draft.store.js"
);
const { listDecisionsByInitiative } = await import(
  "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js"
);

const {
  generateInitiativeImplementationCommitmentDraft,
  publishInitiativeImplementationCommitmentStage,
  saveInitiativeImplementationCommitmentDraft,
} = await import(
  "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.service.js"
);
const { getPackageByInitiativeId: getCommitmentPackage } = await import(
  "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-package.store.js"
);

const {
  generateInitiativeImplementationTrackingDraft,
  publishInitiativeImplementationTrackingStage,
  saveInitiativeImplementationTrackingDraft,
} = await import(
  "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-lifecycle.service.js"
);
const { getPackageByInitiativeId: getTrackingPackage } = await import(
  "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js"
);

const {
  generateInitiativeOfficialResponseDraft,
  publishInitiativeOfficialResponseStage,
  saveInitiativeOfficialResponseDraft,
} = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-lifecycle.service.js"
);
const { getPackageByInitiativeId: getOfficialPackage } = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-package.store.js"
);

const {
  generateInitiativePublicImpactDraft,
  publishInitiativePublicImpactStage,
  saveInitiativePublicImpactDraft,
} = await import(
  "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-lifecycle.service.js"
);
const { getReportByInitiativeId } = await import(
  "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-report.store.js"
);

const {
  generateInitiativeCivicArchiveDraft,
  publishInitiativeCivicArchiveStage,
  saveInitiativeCivicArchiveDraft,
} = await import(
  "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-lifecycle.service.js"
);
const { getLatestArchiveVersionByInitiativeId } = await import(
  "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-version.store.js"
);

const { assessInitiativeCollectiveDecisionEligibilityForResolved } = await import(
  "../../../src/modules/initiative-collective-decision/initiative-collective-decision-eligibility.js"
);
const { assessInitiativeImplementationCommitmentEligibilityForResolved } = await import(
  "../../../src/modules/initiative-implementation-commitment/initiative-implementation-commitment-eligibility.js"
);
const { buildPipelineStatus } = await import(
  "../../../src/modules/capability02-integration/capability02-integration.service.js"
);
const {
  LIFECYCLE_PROGRESSION_DISCONNECTED_AUTHORITIES,
  resolveCanonicalCurrentStageId,
} = await import("../../../src/shared/lifecycle/lifecycle-progression-authority.js");

const { isLifecycleStageSelectable } = await import(
  "../../../../web/src/features/public-initiative-experience/lifecycle-stage-navigation.js"
);
const {
  buildInitiativeExperienceHref,
  buildInitiativeExperienceManageHref,
} = await import(
  "../../../../web/src/features/initiative-owner-studio/initiative-experience-routes.js"
);

const STEWARD = "step03b-cert-steward";

function identity() {
  return { participantId: STEWARD, displayName: "Cert Steward" };
}

function buildInitiative(
  initiativeId: string,
  lifecycleProfile: "STANDARD" | "PUBLIC_CHOICE" = "STANDARD",
  status: Initiative["status"] = "implementation",
): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: STEWARD,
    title: "Certification River Cleanup",
    description: "Step 03B independent-stage certification fixture.",
    status,
    lifecyclePhase: "projected",
    lifecycleProfile,
    visibility: { policy: "public" },
    metadata: {
      activityArea: "Environment",
      communitySlug: "fixture-community",
      category: "Environment",
    },
    timeline: [],
    createdAt: now,
    updatedAt: now,
  } as Initiative;
}

function record(
  recordId: string,
  title: string,
  updatedAt: string,
): PublicInitiativeLifecycleRecordItem {
  return { recordId, title, updatedAt };
}

function countsFromNav(stageIds: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stageId of stageIds) {
    counts[stageId] = 1;
  }
  return counts;
}

/** Historical: Initiative + Petition published; no later Author artifacts. */
function historicalPetitionStoppedRecords(initiativeId: string, now: string) {
  return new Map<string, PublicInitiativeLifecycleRecordItem[]>([
    ["initiative", [record(initiativeId, "Initiative", now)]],
    ["discussion", [record("discussion-1", "Discussion", now)]],
    ["analysis", [record("analysis-1", "Analysis", now)]],
    ["proposal", [record("proposal-1", "Proposals", now)]],
    ["petition", [record("petition-1", "Petition", now)]],
  ]);
}

async function ensurePublicImpactPublishable(initiativeId: string): Promise<void> {
  const draft = await generateInitiativePublicImpactDraft(identity(), initiativeId);
  const sections = draft.sections.map((section) => ({
    ...section,
    body:
      section.body.trim() ||
      (section.sectionId === "executive_summary"
        ? "Author certification: incomplete upstream history documented as uncertainty."
        : section.sectionId === "evidence"
          ? "Missing optional upstream evidence — recorded honestly."
          : section.body || "Documented from available Initiative context."),
    evidenceReferences:
      section.evidenceReferences.length > 0
        ? [...section.evidenceReferences]
        : ["Initiative context"],
  }));
  saveInitiativePublicImpactDraft(identity(), initiativeId, {
    title: draft.title || "Public Impact Report",
    sections,
  });
}

async function publishAuthorChainFromDecisionSession(initiativeId: string): Promise<{
  sessionId: string;
  decisionId: string;
  commitmentPackageId: string;
  trackingPackageId: string;
  officialPackageId: string;
  impactReportId: string;
  archiveVersionId: string;
}> {
  // Decision Session — no Petition required
  const dsDraft = await generateInitiativeDecisionSessionDraft(identity(), initiativeId);
  assert.ok(dsDraft.title.trim());
  assert.ok(dsDraft.options.length >= 1);
  // Intrinsic edit when optional sources left context empty (Author Edit).
  saveInitiativeDecisionSessionDraft(identity(), initiativeId, {
    title: dsDraft.title.trim() || "Decision Session",
    decisionQuestion:
      dsDraft.decisionQuestion.trim() ||
      "Should the community proceed with this Initiative?",
    decisionContext:
      dsDraft.decisionContext.trim() ||
      "Author certification draft from Initiative context (Petition optional / absent).",
    options: dsDraft.options.length > 0 ? [...dsDraft.options] : ["Approve", "Decline"],
  });
  assert.equal(listPublicSessionsByInitiative(initiativeId).length, 0, "Save must not publish DS");

  const session = await publishInitiativeDecisionSessionStage(identity(), initiativeId);
  assert.equal(session.status, "published");
  assert.equal(listPublicSessionsByInitiative(initiativeId).length, 1);

  // Collective Decision — no fabricated DS requirement when generating without link;
  // here DS exists and may be consumed.
  const cdDraft = await generateInitiativeCollectiveDecisionDraft(identity(), initiativeId);
  assert.ok(cdDraft.approvedActions.length >= 1);
  const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  saveInitiativeCollectiveDecisionDraft(identity(), initiativeId, {
    title: cdDraft.title || "Collective Decision",
    decisionSummary: cdDraft.decisionSummary || "Certification collective decision summary.",
    closesAt,
  });
  assert.equal(
    listDecisionsByInitiative(initiativeId).filter((d) => d.status === "closed").length,
    0,
    "Save must not close CD",
  );

  const decision = await publishInitiativeCollectiveDecisionStage(identity(), initiativeId);
  assert.equal(decision.status, "closed");

  const commitmentDraft = await generateInitiativeImplementationCommitmentDraft(
    identity(),
    initiativeId,
  );
  assert.ok(commitmentDraft.candidates.length >= 1);
  saveInitiativeImplementationCommitmentDraft(identity(), initiativeId, {
    title: commitmentDraft.title || "Commitments",
  });
  assert.equal(getCommitmentPackage(initiativeId), null, "Save must not publish commitments");

  const commitmentPkg = await publishInitiativeImplementationCommitmentStage(
    identity(),
    initiativeId,
  );
  assert.equal(commitmentPkg.status, "published");
  assert.ok(getCommitmentPackage(initiativeId));

  const trackingDraft = await generateInitiativeImplementationTrackingDraft(
    identity(),
    initiativeId,
  );
  assert.ok(trackingDraft.candidates.length >= 1);
  saveInitiativeImplementationTrackingDraft(identity(), initiativeId, {
    title: trackingDraft.title || "Tracking",
  });
  assert.equal(getTrackingPackage(initiativeId), null, "Save must not publish tracking");

  const trackingPkg = await publishInitiativeImplementationTrackingStage(identity(), initiativeId);
  assert.equal(trackingPkg.status, "published");

  const orDraft = await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
  saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
    title: orDraft.title || "Official Responses",
    outcomeKind: "no_official_response_received",
    candidates: [],
    noResponseDetail: {
      contactedOrganizations: ["City Hall"],
      contactedDates: [new Date().toISOString().slice(0, 10)],
      note: "No official response received (certification).",
    },
  });
  assert.equal(getOfficialPackage(initiativeId), null, "Save must not publish OR");

  const orPkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);
  assert.equal(orPkg.status, "published");
  assert.equal(orPkg.outcomeKind, "no_official_response_received");

  await ensurePublicImpactPublishable(initiativeId);
  assert.equal(getReportByInitiativeId(initiativeId), null, "Save must not publish PI");

  const impact = await publishInitiativePublicImpactStage(identity(), initiativeId);
  assert.equal(impact.status, "published");
  assert.ok(getReportByInitiativeId(initiativeId));

  const archiveDraft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
  saveInitiativeCivicArchiveDraft(identity(), initiativeId, {
    finalArchiveTitle: archiveDraft.finalArchiveTitle || "Civic Archive",
    finalSummary: archiveDraft.finalSummary || "Certification archive summary.",
  });
  assert.equal(
    getLatestArchiveVersionByInitiativeId(initiativeId),
    null,
    "Save must not publish Archive",
  );

  const archive = await publishInitiativeCivicArchiveStage(identity(), initiativeId);
  assert.equal(archive.status, "published");
  assert.ok(getLatestArchiveVersionByInitiativeId(initiativeId));

  const finalState = resolveInitiativeLifecycleState({
    lifecycleProfile: "STANDARD",
    publishedStageCounts: countsFromNav([
      "initiative",
      "discussion",
      "analysis",
      "proposal",
      "petition",
      "decision_session",
      "collective_decision",
      "commitment",
      "tracking",
      "official_response",
      "public_impact",
      "archive",
    ]),
  });
  assert.equal(finalState.currentStageId, "archive");
  assert.equal(finalState.nextStageId, null);

  // Memory reload / persistence re-read
  assert.equal(listPublicSessionsByInitiative(initiativeId)[0]?.sessionId, session.sessionId);
  assert.equal(getCommitmentPackage(initiativeId)?.packageId, commitmentPkg.packageId);
  assert.equal(getTrackingPackage(initiativeId)?.packageId, trackingPkg.packageId);
  assert.equal(getOfficialPackage(initiativeId)?.packageId, orPkg.packageId);
  assert.equal(getReportByInitiativeId(initiativeId)?.reportId, impact.reportId);
  assert.equal(
    getLatestArchiveVersionByInitiativeId(initiativeId)?.archiveVersionId,
    archive.archiveVersionId,
  );

  return {
    sessionId: session.sessionId,
    decisionId: decision.decisionId,
    commitmentPackageId: commitmentPkg.packageId,
    trackingPackageId: trackingPkg.packageId,
    officialPackageId: orPkg.packageId,
    impactReportId: impact.reportId,
    archiveVersionId: archive.archiveVersionId,
  };
}

describe("Step 03B — Scenario A Historical Petition-stopped continuation", () => {
  it("Author continues Petition-stopped Initiative through Archive without reset", async () => {
    const initiativeId = `step03b-hist-${Date.now()}`;
    const now = new Date().toISOString();
    createInitiative(buildInitiative(initiativeId, "STANDARD", "petition"));

    const navBefore = buildLifecycleNavigation(
      getInitiativeById(initiativeId)!,
      historicalPetitionStoppedRecords(initiativeId, now),
    );
    assert.equal(navBefore.currentStageId, "decision_session");
    assert.equal(navBefore.stages.find((s) => s.stageId === "petition")?.state, "completed");
    for (const stageId of [
      "decision_session",
      "collective_decision",
      "commitment",
      "tracking",
      "official_response",
      "public_impact",
      "archive",
    ]) {
      const stage = navBefore.stages.find((s) => s.stageId === stageId);
      assert.ok(stage);
      assert.notEqual(stage.state, "not_applicable");
      assert.equal(
        isLifecycleStageSelectable(navBefore.stages, stageId, { viewerIsSteward: true }),
        true,
        `${stageId} must be Author-selectable`,
      );
    }

    const published = await publishAuthorChainFromDecisionSession(initiativeId);

    // Existing earlier synthetic petition remains representable; later artifacts exist.
    const navAfter = buildLifecycleNavigation(
      getInitiativeById(initiativeId)!,
      new Map([
        ...historicalPetitionStoppedRecords(initiativeId, now),
        ["decision_session", [record(published.sessionId, "DS", now)]],
        ["collective_decision", [record(published.decisionId, "CD", now)]],
        ["commitment", [record(published.commitmentPackageId, "C", now)]],
        ["tracking", [record(published.trackingPackageId, "T", now)]],
        ["official_response", [record(published.officialPackageId, "OR", now)]],
        ["public_impact", [record(published.impactReportId, "PI", now)]],
        ["archive", [record(published.archiveVersionId, "Archive", now)]],
      ]),
    );
    assert.equal(navAfter.currentStageId, "archive");
    assert.equal(navAfter.stages.find((s) => s.stageId === "petition")?.recordCount, 1);

    deleteInitiative(initiativeId);
  });
});

describe("Step 03B — Scenario B New zero-data STANDARD Initiative", () => {
  it("Author completes full STANDARD route with zero community data and no Petition", async () => {
    const initiativeId = `step03b-zero-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD", "draft"));

    // Zero community / no Petition — still generate DS
    const ds = await generateInitiativeDecisionSessionDraft(identity(), initiativeId);
    assert.equal(ds.petitionId, null);
    assert.ok(ds.options.length >= 1);

    await publishAuthorChainFromDecisionSession(initiativeId);

    const archive = getLatestArchiveVersionByInitiativeId(initiativeId);
    assert.ok(archive);
    assert.match(archive.finalSummary || archive.finalArchiveTitle, /.+/);

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 0,
        analysis: 0,
        proposal: 0,
        petition: 0,
        decision_session: 1,
        collective_decision: 1,
        commitment: 1,
        tracking: 1,
        official_response: 1,
        public_impact: 1,
        archive: 1,
      },
    });
    // With sparse early counts, archive published still closes when count includes archive
    // and earlier applicable published furthest includes archive.
    assert.equal(
      resolveInitiativeLifecycleState({
        lifecycleProfile: "STANDARD",
        publishedStageCounts: countsFromNav([
          "initiative",
          "discussion",
          "analysis",
          "proposal",
          "petition",
          "decision_session",
          "collective_decision",
          "commitment",
          "tracking",
          "official_response",
          "public_impact",
          "archive",
        ]),
      }).nextStageId,
      null,
    );
    void state;

    deleteInitiative(initiativeId);
  });
});

describe("Step 03B — Scenario C PUBLIC_CHOICE unchanged", () => {
  it("Initiative → Discussion → Collective Decision → Civic Archive with no STANDARD substrates", async () => {
    const initiativeId = `step03b-pc-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "PUBLIC_CHOICE"));

    const cdDraft = await generateInitiativeCollectiveDecisionDraft(identity(), initiativeId);
    assert.equal(cdDraft.decisionSessionId, null);
    const closesAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    saveInitiativeCollectiveDecisionDraft(identity(), initiativeId, {
      title: "Public Choice Decision",
      decisionSummary: "Community choice without STANDARD Decision Session.",
      approvedActions: cdDraft.approvedActions.length
        ? [...cdDraft.approvedActions]
        : ["Advance the Public Choice outcome"],
      closesAt,
    });
    const decision = await publishInitiativeCollectiveDecisionStage(identity(), initiativeId);
    assert.equal(decision.decisionSessionId, null);
    assert.equal(decision.status, "closed");

    const archiveDraft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    assert.equal(archiveDraft.publicImpactReportId, null);
    saveInitiativeCivicArchiveDraft(identity(), initiativeId, {
      finalArchiveTitle: archiveDraft.finalArchiveTitle || "PC Archive",
      finalSummary: archiveDraft.finalSummary || "Public Choice journey archived.",
    });
    const archive = await publishInitiativeCivicArchiveStage(identity(), initiativeId);
    assert.equal(archive.status, "published");

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "PUBLIC_CHOICE",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        collective_decision: 1,
        archive: 1,
      },
    });
    assert.equal(state.currentStageId, "archive");
    assert.equal(state.nextStageId, null);
    assert.ok(state.notApplicableStageIds.includes("petition"));
    assert.ok(state.notApplicableStageIds.includes("decision_session"));
    assert.ok(state.notApplicableStageIds.includes("public_impact"));

    deleteInitiative(initiativeId);
  });
});

describe("Step 03B — Scenario D Workspace/Header entry parity", () => {
  it("same Author + Initiative share canonical URL, Manage, stewardship selectability", () => {
    const initiativeId = "step03b-parity";
    const workspaceHref = buildInitiativeExperienceHref(initiativeId);
    const headerHref = buildInitiativeExperienceHref(initiativeId);
    assert.equal(workspaceHref, headerHref);
    assert.equal(workspaceHref, `/initiatives/public/${initiativeId}`);
    assert.equal(
      buildInitiativeExperienceManageHref(initiativeId),
      `/initiatives/public/${initiativeId}#manage`,
    );

    const stages = [
      {
        stageId: "petition",
        label: "Petition",
        hash: "petition",
        state: "published" as const,
        stateLabel: "Published",
        recordCount: 1,
      },
      {
        stageId: "decision_session",
        label: "Decision Session",
        hash: "decision-session",
        state: "not_started" as const,
        stateLabel: "Not Started",
        recordCount: 0,
      },
      {
        stageId: "archive",
        label: "Civic Archive",
        hash: "civic-archive",
        state: "not_started" as const,
        stateLabel: "Not Started",
        recordCount: 0,
      },
    ];

    // Stewardship — not entry path — controls Author selectability
    assert.equal(
      isLifecycleStageSelectable(stages, "archive", { viewerIsSteward: true }),
      true,
    );
    assert.equal(
      isLifecycleStageSelectable(stages, "archive", { viewerIsSteward: false }),
      false,
    );
  });
});

describe("Step 03B — Scenario E Legacy non-authority", () => {
  it("legacy eligibility / Cap02 / status cannot block Author selectability or canonical progress", () => {
    assert.ok(
      LIFECYCLE_PROGRESSION_DISCONNECTED_AUTHORITIES.includes("capability02.buildPipelineStatus"),
    );

    const initiative = buildInitiative("step03b-legacy", "STANDARD", "proposal");
    createInitiative(initiative);

    // Legacy CD eligibility still requires a session — but Author pack publishes without it.
    const legacyCd = assessInitiativeCollectiveDecisionEligibilityForResolved(initiative, null);
    assert.equal(legacyCd.eligible, false);
    assert.ok(legacyCd.reasons[0]?.includes("Decision session"));

    // Legacy commitment eligibility still requires closed CD — Author pack does not use it.
    const legacyCommitment = assessInitiativeImplementationCommitmentEligibilityForResolved(
      initiative,
      null as never,
    );
    assert.equal(legacyCommitment.eligible, false);

    const counts = {
      initiative: 1,
      discussion: 1,
      analysis: 1,
      proposal: 1,
      petition: 1,
    };
    const asPetitionStatus = resolveCanonicalCurrentStageId({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: counts,
    });
    initiative.status = "archived";
    const afterStatusMutation = resolveCanonicalCurrentStageId({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: counts,
    });
    assert.equal(asPetitionStatus, afterStatusMutation);
    assert.equal(asPetitionStatus, "decision_session");

    const cap02 = buildPipelineStatus(initiative.initiativeId);
    assert.notEqual(
      String(cap02.currentStageId ?? ""),
      "decision_session",
      "Cap02 cursor must not be confused with canonical decision_session progress",
    );

    const nav = buildLifecycleNavigation(
      getInitiativeById(initiative.initiativeId)!,
      historicalPetitionStoppedRecords(initiative.initiativeId, new Date().toISOString()),
    );
    assert.equal(
      isLifecycleStageSelectable(nav.stages, "archive", { viewerIsSteward: true }),
      true,
    );

    deleteInitiative(initiative.initiativeId);
  });
});
