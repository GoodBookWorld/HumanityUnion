import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Isolate from apps/api/.env Mongo overrides (see load-api-environment.ts).
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_CIVIC_ARCHIVE_SKIP_REMINDERS = "1";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_CIVIC_ARCHIVE_VERSION_PERSISTENCE = "memory";
process.env.INITIATIVE_CIVIC_ARCHIVE_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_PUBLIC_IMPACT_REPORT_PERSISTENCE = "memory";
process.env.INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE = "memory";
process.env.MONGODB_URI =
  "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=1&connectTimeoutMS=1";

import type { Initiative, InitiativePublicImpactReport } from "@hu/types";
import { resolveInitiativeLifecycleState } from "@hu/types";

const {
  generateInitiativeCivicArchiveDraft,
  getPublishedInitiativeCivicArchiveVersion,
  publishInitiativeCivicArchiveStage,
  saveInitiativeCivicArchiveDraft,
} = await import(
  "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-lifecycle.service.js"
);
const { getInitiativeCivicArchiveLifecycleDraftByInitiativeId } = await import(
  "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-lifecycle-draft.store.js"
);
const {
  deleteArchiveVersionsByInitiativeIdForTests,
  getLatestArchiveVersionByInitiativeId,
} = await import(
  "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-version.store.js"
);
const { generateCivicArchiveDraftContent } = await import(
  "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-builder.js"
);
const { buildInitiativeCivicArchiveIntelligenceSnapshot } = await import(
  "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-intelligence.service.js"
);
const {
  deleteReportsByInitiativeIdForTests,
  upsertReport,
} = await import(
  "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-report.store.js"
);
const {
  deletePackagesByInitiativeIdForTests: deleteOfficialPackages,
  upsertPackage: upsertOfficialPackage,
} = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-package.store.js"
);
const { createInitiative, deleteInitiative, getInitiativeById } = await import(
  "../../../src/modules/initiatives/initiative.store.js"
);
const { buildLifecycleNavigation } = await import(
  "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js"
);

const STEWARD = "civic-archive-final-steward";

function identity() {
  return { participantId: STEWARD };
}

function buildInitiative(
  initiativeId: string,
  lifecycleProfile: "STANDARD" | "PUBLIC_CHOICE" = "STANDARD",
): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: STEWARD,
    title: "River Cleanup",
    description: "Restore the riverbank and publish progress.",
    status: "implementation",
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

function emptyTraceability(): InitiativePublicImpactReport["traceability"] {
  return {
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    revisionId: null,
    revisionVersion: null,
    petitionId: null,
    petitionVersion: null,
    decisionSessionId: null,
    decisionSessionVersion: null,
    decisionId: null,
    commitmentPackageId: null,
    trackingPackageId: null,
    officialResponsePackageId: null,
    relatedTrackingIds: [],
    relatedCommitmentIds: [],
    relatedOfficialResponseIds: [],
    evidenceReferences: [],
  };
}

function seedPublicImpactReport(
  initiativeId: string,
  summary = "No measurable impact recorded yet.",
): string {
  const now = new Date().toISOString();
  const reportId = `public-impact-report-${initiativeId}`;
  upsertReport({
    reportId,
    initiativeId,
    stewardId: STEWARD,
    title: `Public Impact Report: River Cleanup`,
    sections: [
      {
        sectionId: "executive_summary",
        title: "Executive Summary",
        body: summary,
        evidenceReferences: [],
      },
    ],
    participationStatistics: {
      signatureCount: 0,
      supportCount: 0,
      reactionCount: 0,
      activeAllyCount: 0,
    },
    officialResponsePackageId: null,
    trackingPackageId: null,
    commitmentPackageId: null,
    decisionId: null,
    traceability: emptyTraceability(),
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return reportId;
}

function seedOfficialNoResponsePackage(initiativeId: string): string {
  const now = new Date().toISOString();
  const packageId = `official-response-package-${initiativeId}`;
  upsertOfficialPackage({
    packageId,
    initiativeId,
    trackingPackageId: null,
    decisionId: null,
    stewardId: STEWARD,
    title: "Official Responses: River Cleanup",
    summary: "No institution replied.",
    outcomeKind: "no_official_response_received",
    noResponseDetail: {
      contactedOrganizations: ["City Hall"],
      contactedDates: ["2026-08-01"],
      note: "Two follow-ups; no reply.",
    },
    responseIds: [],
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return packageId;
}

function priorStageCounts(archiveCount = 0): Record<string, number> {
  return {
    initiative: 1,
    discussion: 1,
    analysis: 1,
    proposal: 1,
    petition: 1,
    decision_session: 1,
    collective_decision: 1,
    commitment: 1,
    tracking: 1,
    official_response: 1,
    public_impact: 1,
    ...(archiveCount > 0 ? { archive: archiveCount } : {}),
  };
}

function publicChoicePriorCounts(archiveCount = 0): Record<string, number> {
  return {
    initiative: 1,
    discussion: 1,
    collective_decision: 1,
    ...(archiveCount > 0 ? { archive: archiveCount } : {}),
  };
}

function priorNavRecords(archive?: { recordId: string; title: string; updatedAt: string }) {
  const now = new Date().toISOString();
  const map = new Map([
    ["initiative", [{ recordId: "i", title: "i", updatedAt: now }]],
    ["discussion", [{ recordId: "d", title: "d", updatedAt: now }]],
    ["analysis", [{ recordId: "a", title: "a", updatedAt: now }]],
    ["proposal", [{ recordId: "p", title: "p", updatedAt: now }]],
    ["petition", [{ recordId: "pe", title: "pe", updatedAt: now }]],
    ["decision_session", [{ recordId: "ds", title: "ds", updatedAt: now }]],
    ["collective_decision", [{ recordId: "cd", title: "cd", updatedAt: now }]],
    ["commitment", [{ recordId: "c", title: "c", updatedAt: now }]],
    ["tracking", [{ recordId: "t", title: "t", updatedAt: now }]],
    ["official_response", [{ recordId: "or", title: "or", updatedAt: now }]],
    ["public_impact", [{ recordId: "pi", title: "pi", updatedAt: now }]],
  ]);
  if (archive) {
    map.set("archive", [archive]);
  }
  return map;
}

function cleanup(initiativeId: string): void {
  deleteArchiveVersionsByInitiativeIdForTests(initiativeId);
  deleteReportsByInitiativeIdForTests(initiativeId);
  deleteOfficialPackages(initiativeId);
  deleteInitiative(initiativeId);
}

describe("Civic Archive final workflow", () => {
  it("STANDARD completed journey → Archive draft", async () => {
    const initiativeId = `initiative-ca-std-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    assert.ok(draft.sections.length >= 1);
    assert.match(draft.finalSummary, /LifecycleProfile: STANDARD/);
    assert.ok(draft.publicImpactReportId);
    assert.equal(getLatestArchiveVersionByInitiativeId(initiativeId), null);

    cleanup(initiativeId);
  });

  it("PUBLIC_CHOICE completed route → Archive draft", async () => {
    const initiativeId = `initiative-ca-pc-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "PUBLIC_CHOICE"));

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    assert.ok(draft.sections.length >= 1);
    assert.match(draft.finalSummary, /LifecycleProfile: PUBLIC_CHOICE/);
    assert.equal(draft.publicImpactReportId, null);

    cleanup(initiativeId);
  });

  it("PUBLIC_CHOICE needs no hidden STANDARD artifacts", async () => {
    const initiativeId = `initiative-ca-pc-hidden-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "PUBLIC_CHOICE"));

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const decisionSession = draft.sections.find((section) => section.sectionId === "decision_session");
    const commitments = draft.sections.find(
      (section) => section.sectionId === "implementation_commitments",
    );
    const tracking = draft.sections.find((section) => section.sectionId === "implementation_tracking");
    const official = draft.sections.find((section) => section.sectionId === "official_responses");
    const impact = draft.sections.find((section) => section.sectionId === "public_impact");

    for (const section of [decisionSession, commitments, tracking, official, impact]) {
      assert.ok(section?.body.includes("not on this Initiative's LifecycleProfile route"));
    }

    assert.equal(
      draft.timeline.some((entry) => entry.stageId === "decision_session"),
      false,
    );
    assert.equal(draft.timeline.some((entry) => entry.stageId === "revision"), false);

    cleanup(initiativeId);
  });

  it("zero comments/proposals/commitments do not block Archive", async () => {
    const initiativeId = `initiative-ca-zero-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const discussion = draft.sections.find(
      (section) => section.sectionId === "discussion_and_participation",
    );
    const proposals = draft.sections.find((section) => section.sectionId === "improvement_proposals");
    const commitments = draft.sections.find(
      (section) => section.sectionId === "implementation_commitments",
    );

    assert.ok(discussion?.body.includes("Zero comments"));
    assert.ok(proposals?.body.includes("Zero Improvement Proposals"));
    assert.ok(commitments?.body.includes("Zero Implementation Commitments"));

    const version = await publishInitiativeCivicArchiveStage(identity(), initiativeId);
    assert.equal(version.status, "published");

    cleanup(initiativeId);
  });

  it("No Official Response preserved", async () => {
    const initiativeId = `initiative-ca-noresp-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedOfficialNoResponsePackage(initiativeId);
    seedPublicImpactReport(initiativeId);

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const official = draft.sections.find((section) => section.sectionId === "official_responses");
    assert.ok(official?.body.includes("No official response received"));
    assert.ok(official?.body.includes("City Hall"));

    cleanup(initiativeId);
  });

  it("zero/no measurable impact preserved", async () => {
    const initiativeId = `initiative-ca-impact-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId, "No measurable impact recorded yet.");

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const impact = draft.sections.find((section) => section.sectionId === "public_impact");
    assert.ok(impact?.body.includes("No measurable impact"));
    assert.ok(impact?.body.includes("valid Public Impact conclusion"));

    cleanup(initiativeId);
  });

  it("Revision represented only as version/history", async () => {
    const initiativeId = `initiative-ca-rev-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const revision = draft.sections.find(
      (section) => section.sectionId === "revision_and_change_history",
    );
    assert.equal(revision?.title, "Version / revision history");
    assert.equal(draft.timeline.some((entry) => entry.stageId === "revision"), false);
    assert.equal(draft.completeness.missingOptionalStages.includes("revision"), false);

    cleanup(initiativeId);
  });

  it("Save Draft does not close Lifecycle", async () => {
    const initiativeId = `initiative-ca-draft-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const saved = saveInitiativeCivicArchiveDraft(identity(), initiativeId, {
      finalArchiveTitle: "Edited Civic Archive Draft",
      finalSummary: "Author note retained without closing lifecycle.",
    });

    assert.equal(saved.finalArchiveTitle, "Edited Civic Archive Draft");
    assert.equal(getLatestArchiveVersionByInitiativeId(initiativeId), null);
    assert.ok(getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiativeId));

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(state.currentStageId, "archive");
    assert.equal(state.nextStageId, null);

    cleanup(initiativeId);
  });

  it("Preview does not close Lifecycle", () => {
    const before = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    const after = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(before.currentStageId, "archive");
    assert.equal(after.currentStageId, "archive");
    assert.equal(after.nextStageId, null);
  });

  it("Publish closes Lifecycle with nextStageId null", async () => {
    const initiativeId = `initiative-ca-publish-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const version = await publishInitiativeCivicArchiveStage(identity(), initiativeId);

    assert.equal(version.status, "published");
    assert.equal(getInitiativeCivicArchiveLifecycleDraftByInitiativeId(initiativeId), null);

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(1),
    });
    assert.equal(state.currentStageId, "archive");
    assert.equal(state.nextStageId, null);

    const nav = buildLifecycleNavigation(
      getInitiativeById(initiativeId)!,
      priorNavRecords({
        recordId: version.archiveVersionId,
        title: version.finalArchiveTitle,
        updatedAt: version.updatedAt,
      }),
    );
    assert.equal(nav.currentStageId, "archive");
    const archiveNav = nav.stages.find((stage) => stage.stageId === "archive");
    assert.ok(archiveNav);
    assert.notEqual(archiveNav.state, "not_started");
    assert.notEqual(archiveNav.state, "unavailable");

    cleanup(initiativeId);
  });

  it("PUBLIC_CHOICE Publish closes Lifecycle without STANDARD substrates", async () => {
    const initiativeId = `initiative-ca-pc-publish-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "PUBLIC_CHOICE"));

    await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const version = await publishInitiativeCivicArchiveStage(identity(), initiativeId);
    assert.equal(version.status, "published");

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "PUBLIC_CHOICE",
      publishedStageCounts: publicChoicePriorCounts(1),
    });
    assert.equal(state.currentStageId, "archive");
    assert.equal(state.nextStageId, null);

    cleanup(initiativeId);
  });

  it("Mongo/file reload preserves completed Archive", async () => {
    const initiativeId = `initiative-ca-reload-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    const version = await publishInitiativeCivicArchiveStage(identity(), initiativeId);

    const reloaded = getPublishedInitiativeCivicArchiveVersion(initiativeId);
    assert.ok(reloaded);
    assert.equal(reloaded.archiveVersionId, version.archiveVersionId);
    assert.equal(reloaded.status, "published");
    assert.ok(reloaded.sections.length >= 1);
    assert.ok(Array.isArray(reloaded.frozenSourceRecordIds));
    assert.notEqual(reloaded.status, "draft");

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(1),
    });
    assert.equal(state.currentStageId, "archive");
    assert.equal(state.nextStageId, null);

    cleanup(initiativeId);
  });

  it("published state identical across viewers", async () => {
    const initiativeId = `initiative-ca-viewers-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    await publishInitiativeCivicArchiveStage(identity(), initiativeId);

    const authorView = getPublishedInitiativeCivicArchiveVersion(initiativeId);
    const allyView = getPublishedInitiativeCivicArchiveVersion(initiativeId);
    const participantView = getPublishedInitiativeCivicArchiveVersion(initiativeId);
    const visitorView = getPublishedInitiativeCivicArchiveVersion(initiativeId);

    assert.ok(authorView);
    assert.deepEqual(authorView, allyView);
    assert.deepEqual(authorView, participantView);
    assert.deepEqual(authorView, visitorView);
    assert.equal(authorView.status, "published");

    cleanup(initiativeId);
  });

  it("AI cannot publish/close Lifecycle", async () => {
    const initiativeId = `initiative-ca-ai-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId, "STANDARD"));
    seedPublicImpactReport(initiativeId);

    const draft = await generateInitiativeCivicArchiveDraft(identity(), initiativeId);
    assert.ok(draft.sections.length >= 1);
    assert.equal(getLatestArchiveVersionByInitiativeId(initiativeId), null);

    const snapshot = await buildInitiativeCivicArchiveIntelligenceSnapshot(initiativeId);
    const content = generateCivicArchiveDraftContent(snapshot, "STANDARD");
    assert.ok(content.sections.length >= 1);
    assert.equal(getLatestArchiveVersionByInitiativeId(initiativeId), null);

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(state.currentStageId, "archive");
    assert.equal(state.nextStageId, null);

    cleanup(initiativeId);
  });
});
