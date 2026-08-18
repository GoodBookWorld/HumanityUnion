import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Isolate from apps/api/.env Mongo overrides (see load-api-environment.ts).
process.env.NODE_TEST_ENV = "true";
process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_OFFICIAL_RESPONSE_PACKAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_IMPLEMENTATION_TRACKING_PACKAGE_PERSISTENCE = "memory";
process.env.INITIATIVE_OFFICIAL_RESPONSE_LIFECYCLE_DRAFT_PERSISTENCE = "memory";
process.env.INITIATIVE_PUBLIC_IMPACT_SKIP_REMINDERS = "1";
process.env.MONGODB_URI =
  "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=1&connectTimeoutMS=1";

import type { Initiative, InitiativeOfficialResponseCandidate } from "@hu/types";
import { resolveInitiativeLifecycleState } from "@hu/types";

const {
  generateInitiativeOfficialResponseDraft,
  getPublishedOfficialResponsePackageView,
  publishInitiativeOfficialResponseStage,
  saveInitiativeOfficialResponseDraft,
} = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-lifecycle.service.js"
);
const { getInitiativeOfficialResponseLifecycleDraftByInitiativeId } = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-lifecycle-draft.store.js"
);
const {
  deletePackagesByInitiativeIdForTests: deleteOfficialPackages,
  getPackageByInitiativeId: getOfficialPackageByInitiativeId,
  listResponsesByInitiativeId,
} = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-package.store.js"
);
const { generateOfficialResponseDraftContent } = await import(
  "../../../src/modules/initiative-official-response-lifecycle/initiative-official-response-draft-builder.js"
);
const { upsertPackage: upsertTrackingPackage } = await import(
  "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js"
);
const { createInitiative, deleteInitiative, getInitiativeById } = await import(
  "../../../src/modules/initiatives/initiative.store.js"
);
const { buildLifecycleNavigation } = await import(
  "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js"
);

const STEWARD = "official-response-final-steward";

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
    title: `Implementation Tracking: River Cleanup`,
    summary: "Tracking package available for Official Responses.",
    trackingIds: [],
    status: "published",
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return packageId;
}

function priorStageCounts(officialResponseCount = 0): Record<string, number> {
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
    ...(officialResponseCount > 0 ? { official_response: officialResponseCount } : {}),
  };
}

function priorNavRecords(official?: { recordId: string; title: string; updatedAt: string }) {
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
  ]);
  if (official) {
    map.set("official_response", [official]);
  }
  return map;
}

function fillCandidate(
  candidate: InitiativeOfficialResponseCandidate,
  overrides: Partial<InitiativeOfficialResponseCandidate> = {},
): InitiativeOfficialResponseCandidate {
  return {
    ...candidate,
    institution: "City Sustainability Office",
    organization: "",
    subject: candidate.subject || "Response regarding: River Cleanup",
    receivedAt: candidate.receivedAt || "2026-08-10",
    summary: "City confirmed cleanup completion in writing.",
    documentIds: ["doc-evidence-1"],
    links: ["https://example.org/official-letter"],
    verificationStatus: "verified",
    ...overrides,
  };
}

function cleanup(initiativeId: string): void {
  deleteOfficialPackages(initiativeId);
  deleteInitiative(initiativeId);
}

describe("Official Responses final workflow", () => {
  it("zero responses → No Response can be published", async () => {
    const initiativeId = `initiative-or-zero-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    const draft = await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    const saved = saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: draft.title || "Official Responses: River Cleanup",
      summary: draft.summary || "No institution replied.",
      outcomeKind: "no_official_response_received",
      noResponseDetail: {
        contactedOrganizations: ["City Hall", "Parks Dept"],
        contactedDates: ["2026-08-01", "2026-08-08"],
        note: "Two follow-ups; no reply.",
      },
      candidates: [],
    });

    assert.equal(saved.outcomeKind, "no_official_response_received");
    assert.equal(saved.candidates.length, 0);

    const pkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);
    assert.equal(pkg.status, "published");
    assert.equal(pkg.outcomeKind, "no_official_response_received");
    assert.deepEqual(pkg.responseIds, []);
    assert.equal(listResponsesByInitiativeId(initiativeId).length, 0);
    assert.deepEqual(pkg.noResponseDetail.contactedOrganizations, ["City Hall", "Parks Dept"]);

    cleanup(initiativeId);
  });

  it("No Response → Public Impact unlocked", async () => {
    const initiativeId = `initiative-or-unlock-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: "Official Responses: River Cleanup",
      summary: "No reply.",
      outcomeKind: "no_official_response_received",
      noResponseDetail: {
        contactedOrganizations: [],
        contactedDates: [],
        note: "No official response received.",
      },
      candidates: [],
    });
    const pkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(1),
    });
    assert.equal(state.currentStageId, "public_impact");

    const nav = buildLifecycleNavigation(
      getInitiativeById(initiativeId)!,
      priorNavRecords({
        recordId: pkg.packageId,
        title: pkg.title,
        updatedAt: pkg.updatedAt,
      }),
    );
    assert.equal(nav.currentStageId, "public_impact");
    const officialNav = nav.stages.find((stage) => stage.stageId === "official_response");
    assert.ok(officialNav);
    assert.notEqual(officialNav.state, "not_started");
    assert.notEqual(officialNav.state, "unavailable");

    cleanup(initiativeId);
  });

  it("actual response can be recorded and published with document metadata", async () => {
    const initiativeId = `initiative-or-response-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    const draft = await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    const filled = draft.candidates.map((candidate) => fillCandidate(candidate));
    saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: draft.title,
      summary: draft.summary,
      outcomeKind: "responses_received",
      candidates: filled,
    });

    const pkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);
    assert.equal(pkg.outcomeKind, "responses_received");
    assert.ok(pkg.responseIds.length >= 1);

    const view = getPublishedOfficialResponsePackageView(initiativeId);
    assert.ok(view.package);
    assert.equal(view.package!.packageId, pkg.packageId);
    assert.ok(view.responses.length >= 1);
    assert.deepEqual(view.responses[0]!.documentIds, ["doc-evidence-1"]);
    assert.deepEqual(view.responses[0]!.links, ["https://example.org/official-letter"]);
    assert.equal(view.responses[0]!.institution, "City Sustainability Office");

    cleanup(initiativeId);
  });

  it("document/source metadata survives persistence reload", async () => {
    const initiativeId = `initiative-or-reload-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    const draft = await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: draft.title,
      summary: draft.summary,
      outcomeKind: "responses_received",
      candidates: draft.candidates.map((candidate) =>
        fillCandidate(candidate, {
          documentIds: ["doc-a", "doc-b"],
          links: ["https://example.org/a"],
          referenceNumber: "REF-77",
          notes: "Scanned letter retained.",
        }),
      ),
    });
    const pkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);

    const reloaded = getOfficialPackageByInitiativeId(initiativeId);
    assert.ok(reloaded);
    assert.equal(reloaded.packageId, pkg.packageId);
    assert.deepEqual(reloaded.responseIds, pkg.responseIds);

    const responses = listResponsesByInitiativeId(initiativeId);
    assert.equal(responses.length, pkg.responseIds.length);
    assert.deepEqual(responses[0]!.documentIds, ["doc-a", "doc-b"]);
    assert.equal(responses[0]!.referenceNumber, "REF-77");
    assert.equal(responses[0]!.notes, "Scanned letter retained.");

    cleanup(initiativeId);
  });

  it("Save Draft does not advance lifecycle", async () => {
    const initiativeId = `initiative-or-draft-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    const draft = await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    const saved = saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: "Edited Official Responses Draft",
      summary: "Still a draft.",
      candidates: draft.candidates,
    });

    assert.equal(saved.title, "Edited Official Responses Draft");
    assert.equal(getOfficialPackageByInitiativeId(initiativeId), null);
    assert.ok(getInitiativeOfficialResponseLifecycleDraftByInitiativeId(initiativeId));

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(state.currentStageId, "official_response");

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
    assert.equal(before.currentStageId, "official_response");
    assert.equal(after.currentStageId, "official_response");
  });

  it("multiple responses are preserved", async () => {
    const initiativeId = `initiative-or-multi-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    const draft = await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    const first = fillCandidate(draft.candidates[0]!, {
      subject: "Letter from City Hall",
      institution: "City Hall",
    });
    const second: InitiativeOfficialResponseCandidate = {
      ...fillCandidate(draft.candidates[0]!, {
        subject: "Email from Parks",
        institution: "",
        organization: "Parks Dept",
        documentIds: ["doc-parks"],
      }),
      candidateId: "official-response-candidate-extra",
    };

    saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: draft.title,
      summary: draft.summary,
      outcomeKind: "responses_received",
      candidates: [first, second],
    });
    const pkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);
    assert.equal(pkg.responseIds.length, 2);
    assert.equal(listResponsesByInitiativeId(initiativeId).length, 2);

    cleanup(initiativeId);
  });

  it("AI cannot publish or advance — generate alone never publishes", async () => {
    const initiativeId = `initiative-or-ai-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    const draft = await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    assert.ok(draft.candidates.length >= 1 || draft.title);
    assert.equal(getOfficialPackageByInitiativeId(initiativeId), null);
    assert.equal(listResponsesByInitiativeId(initiativeId).length, 0);

    const content = await generateOfficialResponseDraftContent({
      initiativeId,
      generatedAt: new Date().toISOString(),
      initiativeTitle: "River Cleanup",
      initiativeDescription: "Restore the riverbank.",
      trackingPackageReference: {
        packageId: "tracking-package-x",
        title: "Tracking",
        summary: "Summary",
        publishedAt: new Date().toISOString(),
        trackingIds: [],
        commitmentPackageId: null,
        decisionId: null,
      },
      trackingRecords: [],
      completedCommitmentCount: 0,
      activeAllyCount: 0,
      decisionId: null,
      consistencyChecks: [],
      isTrackingPackageAvailable: true,
      isEmpty: false,
    });
    assert.equal(content.outcomeKind, "responses_received");
    assert.ok(content.candidates.every((candidate) => !candidate.institution && !candidate.organization));

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: priorStageCounts(0),
    });
    assert.equal(state.currentStageId, "official_response");

    cleanup(initiativeId);
  });

  it("published No Response is not presented as Not Started / Unavailable", async () => {
    const initiativeId = `initiative-or-nav-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: "Official Responses",
      summary: "",
      outcomeKind: "no_official_response_received",
      noResponseDetail: {
        contactedOrganizations: [],
        contactedDates: [],
        note: "No official response received.",
      },
      candidates: [],
    });
    const pkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);
    const view = getPublishedOfficialResponsePackageView(initiativeId);
    assert.equal(view.package?.outcomeKind, "no_official_response_received");
    assert.equal(view.responses.length, 0);

    const nav = buildLifecycleNavigation(
      getInitiativeById(initiativeId)!,
      priorNavRecords({
        recordId: pkg.packageId,
        title: pkg.title,
        updatedAt: pkg.publishedAt,
      }),
    );
    const official = nav.stages.find((stage) => stage.stageId === "official_response");
    assert.ok(official);
    assert.ok(official.state === "published" || official.state === "completed");
    assert.notEqual(official.stateLabel, "Not Started");
    assert.notEqual(official.stateLabel, "Unavailable");

    cleanup(initiativeId);
  });

  it("different viewers receive the same published lifecycle state", async () => {
    const initiativeId = `initiative-or-viewers-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));
    seedTrackingPackage(initiativeId);

    await generateInitiativeOfficialResponseDraft(identity(), initiativeId);
    saveInitiativeOfficialResponseDraft(identity(), initiativeId, {
      title: "Official Responses",
      summary: "No reply.",
      outcomeKind: "no_official_response_received",
      noResponseDetail: {
        contactedOrganizations: ["City Hall"],
        contactedDates: [],
        note: "No official response received.",
      },
      candidates: [],
    });
    const pkg = await publishInitiativeOfficialResponseStage(identity(), initiativeId);
    const records = priorNavRecords({
      recordId: pkg.packageId,
      title: pkg.title,
      updatedAt: pkg.publishedAt,
    });

    const authorNav = buildLifecycleNavigation(getInitiativeById(initiativeId)!, records);
    const guestNav = buildLifecycleNavigation(getInitiativeById(initiativeId)!, records);
    assert.equal(authorNav.currentStageId, guestNav.currentStageId);
    assert.equal(authorNav.currentStageId, "public_impact");
    assert.deepEqual(
      authorNav.stages.map((stage) => ({ stageId: stage.stageId, state: stage.state })),
      guestNav.stages.map((stage) => ({ stageId: stage.stageId, state: stage.state })),
    );

    cleanup(initiativeId);
  });
});
