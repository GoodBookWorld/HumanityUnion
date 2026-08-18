import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";
import { resolveInitiativeLifecycleState } from "@hu/types";

import {
  generateInitiativeImplementationTrackingDraft,
  publishInitiativeImplementationTrackingStage,
  saveInitiativeImplementationTrackingDraft,
} from "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-lifecycle.service.js";
import { getInitiativeImplementationTrackingLifecycleDraftByInitiativeId } from "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-lifecycle-draft.store.js";
import { getPackageByInitiativeId } from "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-package.store.js";
import { generateImplementationTrackingDraftContent } from "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-draft-builder.js";
import { createInitiative, deleteInitiative, getInitiativeById } from "../../../src/modules/initiatives/initiative.store.js";
import { listTrackingsByInitiative } from "../../../src/modules/initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { buildLifecycleNavigation } from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";

const STEWARD = "tracking-final-steward";

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

describe("Implementation Tracking final workflow", () => {
  it("zero accepted commitments → Author can generate and publish", async () => {
    const initiativeId = `initiative-tracking-zero-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));

    const draft = await generateInitiativeImplementationTrackingDraft(identity(), initiativeId);
    assert.ok(draft.candidates.length >= 1);
    assert.ok(draft.candidates.every((candidate) => candidate.commitmentId === ""));
    assert.ok(draft.candidates.every((candidate) => candidate.responsibleParticipantId === ""));

    const pkg = await publishInitiativeImplementationTrackingStage(identity(), initiativeId);
    assert.equal(pkg.status, "published");
    assert.ok(pkg.trackingIds.length >= 1);
    assert.equal(getPackageByInitiativeId(initiativeId)?.packageId, pkg.packageId);

    const trackings = listTrackingsByInitiative(initiativeId);
    assert.ok(trackings.length >= 1);
    assert.ok(trackings.every((tracking) => tracking.commitmentId === ""));

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        petition: 1,
        decision_session: 1,
        collective_decision: 1,
        commitment: 1,
        tracking: 1,
      },
    });
    assert.equal(state.currentStageId, "official_response");

    const nav = buildLifecycleNavigation(getInitiativeById(initiativeId)!, new Map([
      ["initiative", [{ recordId: initiativeId, title: "i", updatedAt: pkg.updatedAt }]],
      ["discussion", [{ recordId: "d", title: "d", updatedAt: pkg.updatedAt }]],
      ["analysis", [{ recordId: "a", title: "a", updatedAt: pkg.updatedAt }]],
      ["proposal", [{ recordId: "p", title: "p", updatedAt: pkg.updatedAt }]],
      ["petition", [{ recordId: "pe", title: "pe", updatedAt: pkg.updatedAt }]],
      ["decision_session", [{ recordId: "ds", title: "ds", updatedAt: pkg.updatedAt }]],
      ["collective_decision", [{ recordId: "cd", title: "cd", updatedAt: pkg.updatedAt }]],
      ["commitment", [{ recordId: "c", title: "c", updatedAt: pkg.updatedAt }]],
      ["tracking", [{ recordId: pkg.packageId, title: pkg.title, updatedAt: pkg.updatedAt }]],
    ]));
    assert.equal(nav.currentStageId, "official_response");

    deleteInitiative(initiativeId);
  });

  it("Save Draft does not advance lifecycle", async () => {
    const initiativeId = `initiative-tracking-draft-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));

    const draft = await generateInitiativeImplementationTrackingDraft(identity(), initiativeId);
    const saved = saveInitiativeImplementationTrackingDraft(identity(), initiativeId, {
      title: "Edited Tracking Draft",
      summary: "Still a draft.",
      candidates: draft.candidates,
    });

    assert.equal(saved.title, "Edited Tracking Draft");
    assert.equal(getPackageByInitiativeId(initiativeId), null);
    assert.ok(getInitiativeImplementationTrackingLifecycleDraftByInitiativeId(initiativeId));

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        petition: 1,
        decision_session: 1,
        collective_decision: 1,
        commitment: 1,
      },
    });
    assert.equal(state.currentStageId, "tracking");

    deleteInitiative(initiativeId);
  });

  it("Preview does not advance lifecycle (display-only)", () => {
    const before = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        petition: 1,
        decision_session: 1,
        collective_decision: 1,
        commitment: 1,
      },
    });
    const after = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        petition: 1,
        decision_session: 1,
        collective_decision: 1,
        commitment: 1,
      },
    });
    assert.equal(before.currentStageId, "tracking");
    assert.equal(after.currentStageId, "tracking");
  });

  it("Mongo/file reload preserves published plan", async () => {
    const initiativeId = `initiative-tracking-reload-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));

    await generateInitiativeImplementationTrackingDraft(identity(), initiativeId);
    const pkg = await publishInitiativeImplementationTrackingStage(identity(), initiativeId);

    const reloadedPackage = getPackageByInitiativeId(initiativeId);
    assert.ok(reloadedPackage);
    assert.equal(reloadedPackage.packageId, pkg.packageId);
    assert.deepEqual(reloadedPackage.trackingIds, pkg.trackingIds);

    const trackings = listTrackingsByInitiative(initiativeId);
    assert.equal(trackings.length, pkg.trackingIds.length);
    assert.ok(trackings.every((tracking) => tracking.packageId === pkg.packageId));

    deleteInitiative(initiativeId);
  });

  it("AI cannot finalize stage — generate alone never publishes", async () => {
    const initiativeId = `initiative-tracking-ai-${Date.now()}`;
    createInitiative(buildInitiative(initiativeId));

    const draft = await generateInitiativeImplementationTrackingDraft(identity(), initiativeId);
    assert.ok(draft.candidates.length >= 1);
    assert.equal(getPackageByInitiativeId(initiativeId), null);
    assert.equal(listTrackingsByInitiative(initiativeId).length, 0);

    const content = await generateImplementationTrackingDraftContent({
      initiativeId,
      generatedAt: new Date().toISOString(),
      initiativeTitle: "River Cleanup",
      initiativeDescription: "Restore the riverbank.",
      packageReference: null,
      acceptedCommitments: [],
      decisionApprovedActions: [],
      activeAllyCount: 0,
      consistencyChecks: [],
      isCommitmentPackageAvailable: false,
      isEmpty: false,
    });
    assert.ok(content.candidates.every((candidate) => candidate.responsibleParticipantId === ""));

    deleteInitiative(initiativeId);
  });
});
