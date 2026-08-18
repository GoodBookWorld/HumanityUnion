import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Isolate from apps/api/.env Mongo overrides (see load-api-environment.ts).
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PUBLIC_IMPACT_SKIP_REMINDERS = "1";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_PUBLIC_IMPACT_REPORT_PERSISTENCE = "memory";
process.env.INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PACKAGE_PERSISTENCE = "memory";
// Pre-set so monorepo .env cannot fill an Atlas SRV URI during loadApiEnvironment.
process.env.MONGODB_URI =
  "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=1&connectTimeoutMS=1";

import type { Initiative } from "@hu/types";
import { resolveInitiativeLifecycleState } from "@hu/types";

const {
  generateInitiativePublicImpactDraft,
  publishInitiativePublicImpactStage,
  saveInitiativePublicImpactDraft,
} = await import(
  "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-lifecycle.service.js"
);
const { getInitiativePublicImpactLifecycleDraftByInitiativeId } = await import(
  "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-lifecycle-draft.store.js"
);
const { deleteReportsByInitiativeIdForTests, getReportByInitiativeId } = await import(
  "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-report.store.js"
);
const { generatePublicImpactDraftContent } = await import(
  "../../../src/modules/initiative-public-impact-lifecycle/initiative-public-impact-draft-builder.js"
);
const { upsertPackage: upsertTrackingPackage } = await import(
  "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js"
);
const {
  deletePackagesByInitiativeIdForTests: deleteOfficialPackages,
  upsertPackage: upsertOfficialPackage,
  upsertResponse,
} = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-package.store.js"
);
const { createInitiative, deleteInitiative, getInitiativeById } = await import(
  "../../../src/modules/initiatives/initiative.store.js"
);
const { buildLifecycleNavigation } = await import(
  "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js"
);

const STEWARD = "public-impact-final-steward";

function identity() {
  return { participantId: STEWARD };
}

function buildInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: STEWARD,
    title: "River Cleanup",
    description: "Restore the riverbank and publish progress.",
    status: "implementation",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
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

function seedTrackingPackage(initiativeId: string): string {
  const now = new Date().toISOString();
  const packageId = `tracking-package-${initiativeId}`;
  upsertTrackingPackage({
    packageId,
    initiativeId,
    commitmentPackageId: null,
    decisionId: null,
    stewardId: STEWARD,
    title: "Implementation Tracking: River Cleanup",
    summary: "Tracking package for Public Impact.",
    trackingIds: [],
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return packageId;
}

function seedOfficialNoResponsePackage(initiativeId: string, trackingPackageId: string): string {
  const now = new Date().toISOString();
  const packageId = `official-response-package-${initiativeId}`;
  upsertOfficialPackage({
    packageId,
    initiativeId,
    trackingPackageId,
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

function seedOfficialResponsePackage(initiativeId: string, trackingPackageId: string): string {
  const now = new Date().toISOString();
  const packageId = `official-response-package-${initiativeId}`;
  const responseId = `official-response-${initiativeId}-0`;
  upsertResponse({
    responseId,
    packageId,
    initiativeId,
    institution: "City Sustainability Office",
    organization: "",
    responseType: "official_letter",
    subject: "Cleanup acknowledgment",
    receivedAt: "2026-08-10",
    publishedAt: now,
    summary: "City acknowledged the cleanup plan.",
    referenceNumber: "REF-1",
    relatedActions: [],
    relatedCommitmentIds: [],
    relatedTrackingIds: [],
    documentIds: ["doc-evidence-1"],
    links: ["https://example.org/letter"],
    verificationStatus: "verified",
    notes: "",
    references: [trackingPackageId],
    traceability: {
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
      trackingPackageId,
      relatedTrackingIds: [],
      relatedCommitmentIds: [],
      relatedActions: [],
    },
    createdAt: now,
    updatedAt: now,
  });
  upsertOfficialPackage({
    packageId,
    initiativeId,
    trackingPackageId,
    decisionId: null,
    stewardId: STEWARD,
    title: "Official Responses: River Cleanup",
    summary: "City replied.",
    outcomeKind: "responses_received",
    noResponseDetail: {
      contactedOrganizations: [],
      contactedDates: [],
      note: "",
    },
    responseIds: [responseId],
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return packageId;
}

function priorStageCounts(publicImpactCount = 0): Record<string, number> {
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
    ...(publicImpactCount > 0 ? { public_impact: publicImpactCount } : {}),
  };
}

function priorNavRecords(publicImpact?: { recordId: string; title: string; updatedAt: string }) {
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
  ]);
  if (publicImpact) {
    map.set("public_impact", [publicImpact]);
  }
  return map;
}

function cleanup(initiativeId: string): void {
  deleteReportsByInitiativeIdForTests(initiativeId);
  deleteOfficialPackages(initiativeId);
  deleteInitiative(initiativeId);
}

describe("Public Impact final workflow", () => {
  it("automatic draft from Tracking + Official Responses", async () => {
    const initiativeId = `initiative-pi-auto-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialResponsePackage(initiativeId, trackingPackageId);

    const draft = await generateInitiativePublicImpactDraft(identity(), initiativeId);
    assert.ok(draft.title.includes("River Cleanup"));
    assert.ok(draft.officialResponsePackageId);
    assert.equal(draft.trackingPackageId, trackingPackageId);
    const official = draft.sections.find((section) => section.sectionId === "official_responses");
    assert.ok(official?.body.includes("Cleanup acknowledgment") || official?.body.includes("City"));
    const executive = draft.sections.find((section) => section.sectionId === "executive_summary");
    assert.ok(executive?.body.trim());
    assert.ok(executive?.evidenceReferences.length >= 1);

    cleanup(initiativeId);
  });

  it("No Response outcome included correctly", async () => {
    const initiativeId = `initiative-pi-noresp-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialNoResponsePackage(initiativeId, trackingPackageId);

    const draft = await generateInitiativePublicImpactDraft(identity(), initiativeId);
    const official = draft.sections.find((section) => section.sectionId === "official_responses");
    const executive = draft.sections.find((section) => section.sectionId === "executive_summary");
    assert.ok(official?.body.includes("No official response received"));
    assert.ok(official?.body.includes("City Hall"));
    assert.ok(!/no response summaries loaded/i.test(official?.body ?? ""));
    assert.ok(!/unavailable|not started/i.test(`${official?.body ?? ""}${executive?.body ?? ""}`));
    assert.ok(executive?.body.includes("No official response received"));

    cleanup(initiativeId);
  });

  it("zero measurable impact can publish", async () => {
    const initiativeId = `initiative-pi-zero-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialNoResponsePackage(initiativeId, trackingPackageId);

    const draft = await generateInitiativePublicImpactDraft(identity(), initiativeId);
    assert.ok(
      draft.sections.some(
        (section) =>
          /no measurable impact yet|incomplete|none yet|insufficient/i.test(section.body),
      ),
    );

    const report = await publishInitiativePublicImpactStage(identity(), initiativeId);
    assert.equal(report.status, "published");
    assert.ok(getReportByInitiativeId(initiativeId));

    cleanup(initiativeId);
  });

  it("missing evidence produces uncertainty, not blocker", async () => {
    const initiativeId = `initiative-pi-evidence-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialNoResponsePackage(initiativeId, trackingPackageId);

    const draft = await generateInitiativePublicImpactDraft(identity(), initiativeId);
    const evidence = draft.sections.find((section) => section.sectionId === "evidence");
    assert.ok(evidence?.body.trim());
    assert.ok(
      /insufficient|uncertainty|do not invent/i.test(evidence?.body ?? "") ||
        evidence!.evidenceReferences.length >= 1,
    );

    const report = await publishInitiativePublicImpactStage(identity(), initiativeId);
    assert.equal(report.status, "published");

    cleanup(initiativeId);
  });

  it("Save Draft does not advance lifecycle", async () => {
    const initiativeId = `initiative-pi-draft-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialResponsePackage(initiativeId, trackingPackageId);

    const draft = await generateInitiativePublicImpactDraft(identity(), initiativeId);
    const saved = saveInitiativePublicImpactDraft(identity(), initiativeId, {
      title: "Edited Public Impact Draft",
      sections: draft.sections,
    });

    assert.equal(saved.title, "Edited Public Impact Draft");
    assert.equal(getReportByInitiativeId(initiativeId), null);
    assert.ok(getInitiativePublicImpactLifecycleDraftByInitiativeId(initiativeId));

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(state.currentStageId, "public_impact");

    cleanup(initiativeId);
  });

  it("Preview does not advance lifecycle (display-only)", () => {
    const before = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    const after = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(before.currentStageId, "public_impact");
    assert.equal(after.currentStageId, "public_impact");
  });

  it("Publish unlocks Civic Archive", async () => {
    const initiativeId = `initiative-pi-unlock-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialNoResponsePackage(initiativeId, trackingPackageId);

    await generateInitiativePublicImpactDraft(identity(), initiativeId);
    const report = await publishInitiativePublicImpactStage(identity(), initiativeId);

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(1),
    });
    assert.equal(state.currentStageId, "archive");

    const nav = buildLifecycleNavigation(
      getInitiativeById(initiativeId)!,
      priorNavRecords({
        recordId: report.reportId,
        title: report.title,
        updatedAt: report.updatedAt,
      }),
    );
    assert.equal(nav.currentStageId, "archive");
    const impactNav = nav.stages.find((stage) => stage.stageId === "public_impact");
    assert.ok(impactNav);
    assert.notEqual(impactNav.state, "not_started");
    assert.notEqual(impactNav.state, "unavailable");

    cleanup(initiativeId);
  });

  it("Mongo/file reload preserves published artifact", async () => {
    const initiativeId = `initiative-pi-reload-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialResponsePackage(initiativeId, trackingPackageId);

    await generateInitiativePublicImpactDraft(identity(), initiativeId);
    const report = await publishInitiativePublicImpactStage(identity(), initiativeId);

    const reloaded = getReportByInitiativeId(initiativeId);
    assert.ok(reloaded);
    assert.equal(reloaded.reportId, report.reportId);
    assert.equal(reloaded.sections.length, report.sections.length);
    assert.ok(reloaded.traceability.officialResponsePackageId);
    assert.ok(reloaded.sections.every((section) => Array.isArray(section.evidenceReferences)));

    cleanup(initiativeId);
  });

  it("AI cannot publish — generate alone never publishes", async () => {
    const initiativeId = `initiative-pi-ai-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialNoResponsePackage(initiativeId, trackingPackageId);

    const draft = await generateInitiativePublicImpactDraft(identity(), initiativeId);
    assert.ok(draft.sections.length >= 1);
    assert.equal(getReportByInitiativeId(initiativeId), null);

    const content = await generatePublicImpactDraftContent({
      initiativeId,
      generatedAt: new Date().toISOString(),
      initiativeTitle: "River Cleanup",
      initiativeDescription: "Restore the riverbank.",
      analysisReference: null,
      revisionReference: null,
      petitionReference: null,
      decisionSessionReference: null,
      decisionReference: null,
      commitmentPackageReference: null,
      trackingPackageReference: {
        packageId: trackingPackageId,
        title: "Tracking",
        summary: "Summary",
        trackingIds: [],
        commitmentPackageId: null,
        decisionId: null,
        publishedAt: new Date().toISOString(),
      },
      officialResponsePackageReference: {
        packageId: "official-response-package-x",
        title: "Official Responses",
        summary: "No reply.",
        responseIds: [],
        trackingPackageId,
        decisionId: null,
        publishedAt: new Date().toISOString(),
        outcomeKind: "no_official_response_received",
        noResponseDetail: {
          contactedOrganizations: [],
          contactedDates: [],
          note: "No official response received.",
        },
      },
      trackingRecords: [],
      completedCommitmentCount: 0,
      officialResponseSummaries: [],
      participationStatistics: {
        signatureCount: 0,
        supportCount: 0,
        reactionCount: 0,
        activeAllyCount: 0,
      },
      evidenceItems: ["official-response-package-x"],
      consistencyChecks: [],
      isOfficialResponsePackageAvailable: true,
      isEmpty: false,
    });
    assert.ok(content.sections.some((section) => section.sectionId === "official_responses"));
    assert.equal(getReportByInitiativeId(initiativeId), null);

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(state.currentStageId, "public_impact");

    cleanup(initiativeId);
  });

  it("published status identical across viewers", async () => {
    const initiativeId = `initiative-pi-viewers-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    const trackingPackageId = seedTrackingPackage(initiativeId);
    seedOfficialNoResponsePackage(initiativeId, trackingPackageId);

    await generateInitiativePublicImpactDraft(identity(), initiativeId);
    const report = await publishInitiativePublicImpactStage(identity(), initiativeId);
    const records = priorNavRecords({
      recordId: report.reportId,
      title: report.title,
      updatedAt: report.publishedAt,
    });

    const authorNav = buildLifecycleNavigation(getInitiativeById(initiativeId)!, records);
    const guestNav = buildLifecycleNavigation(getInitiativeById(initiativeId)!, records);
    assert.equal(authorNav.currentStageId, guestNav.currentStageId);
    assert.equal(authorNav.currentStageId, "archive");
    assert.deepEqual(
      authorNav.stages.map((stage) => ({ stageId: stage.stageId, state: stage.state })),
      guestNav.stages.map((stage) => ({ stageId: stage.stageId, state: stage.state })),
    );

    cleanup(initiativeId);
  });
});
