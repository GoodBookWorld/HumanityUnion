import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE,
  STANDARD_LIFECYCLE_STAGE_ROUTE,
  canChangeInitiativeLifecycleProfile,
  getNextApplicableLifecycleStageId,
  isLifecycleStageApplicableToProfile,
  listNotApplicableLifecycleStageIds,
  resolveInitiativeLifecycleProfile,
  resolveInitiativeLifecycleState,
} from "@hu/types";

describe("Lifecycle Finalization Phase 02 — profiles + state resolver", () => {
  it("STANDARD route is 12 user-visible stages without Revision", () => {
    assert.deepEqual([...STANDARD_LIFECYCLE_STAGE_ROUTE], [
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
    ]);
    assert.equal(STANDARD_LIFECYCLE_STAGE_ROUTE.length, 12);
    assert.equal(STANDARD_LIFECYCLE_STAGE_ROUTE.includes("revision"), false);
  });

  it("PUBLIC_CHOICE route is Initiative → Discussion → Collective Decision → Archive", () => {
    assert.deepEqual([...PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE], [
      "initiative",
      "discussion",
      "collective_decision",
      "archive",
    ]);
  });

  it("missing profile resolves to STANDARD", () => {
    assert.equal(resolveInitiativeLifecycleProfile(undefined), "STANDARD");
    assert.equal(resolveInitiativeLifecycleProfile(null), "STANDARD");
    assert.equal(resolveInitiativeLifecycleProfile("nope"), "STANDARD");
  });

  it("notApplicable stages are not treated as blocked for PUBLIC_CHOICE", () => {
    const notApplicable = listNotApplicableLifecycleStageIds("PUBLIC_CHOICE");
    assert.ok(notApplicable.includes("analysis"));
    assert.ok(notApplicable.includes("petition"));
    assert.equal(isLifecycleStageApplicableToProfile("discussion", "PUBLIC_CHOICE"), true);
    assert.equal(isLifecycleStageApplicableToProfile("petition", "PUBLIC_CHOICE"), false);
    assert.equal(isLifecycleStageApplicableToProfile("collective_decision", "PUBLIC_CHOICE"), true);
  });

  it("derives deterministic current/next for STANDARD", () => {
    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: { initiative: 1, discussion: 1, analysis: 1 },
    });
    assert.equal(state.currentStageId, "proposal");
    assert.equal(state.nextStageId, "petition");
    assert.equal(state.stageApplicability.analysis, "COMPLETED");
    assert.equal(state.stageApplicability.proposal, "CURRENT");
    assert.equal(state.stageApplicability.petition, "LOCKED");
  });

  it("proposal next applicable stage is petition (Revision not on route)", () => {
    assert.equal(getNextApplicableLifecycleStageId("proposal", "STANDARD"), "petition");
  });

  it("legacy Revision counts do not become currentStageId", () => {
    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        revision: 3,
      },
    });
    assert.notEqual(state.currentStageId, "revision");
    assert.equal(state.currentStageId, "petition");
  });

  it("profile-aware next-stage: Initiative → Discussion for both profiles", () => {
    assert.equal(getNextApplicableLifecycleStageId("initiative", "STANDARD"), "discussion");
    assert.equal(getNextApplicableLifecycleStageId("initiative", "PUBLIC_CHOICE"), "discussion");
    assert.equal(getNextApplicableLifecycleStageId("discussion", "STANDARD"), "analysis");
    assert.equal(
      getNextApplicableLifecycleStageId("discussion", "PUBLIC_CHOICE"),
      "collective_decision",
    );
    assert.equal(
      getNextApplicableLifecycleStageId("collective_decision", "PUBLIC_CHOICE"),
      "archive",
    );
  });

  it("PUBLIC_CHOICE after Initiative is Discussion (not Collective Decision)", () => {
    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "PUBLIC_CHOICE",
      publishedStageCounts: { initiative: 1 },
    });
    assert.equal(state.currentStageId, "discussion");
    assert.equal(state.nextStageId, "collective_decision");
    assert.equal(state.stageApplicability.analysis, "NOT_APPLICABLE");
    assert.equal(state.stageApplicability.petition, "NOT_APPLICABLE");
  });

  it("refuses profile change after published lifecycle artifacts", () => {
    const denied = canChangeInitiativeLifecycleProfile({
      from: "STANDARD",
      to: "PUBLIC_CHOICE",
      initiativeLifecyclePhase: "draft",
      hasPublishedLifecycleArtifactsBeyondInitiative: true,
    });
    assert.equal(denied.allowed, false);

    const allowed = canChangeInitiativeLifecycleProfile({
      from: "STANDARD",
      to: "PUBLIC_CHOICE",
      initiativeLifecyclePhase: "draft",
      hasPublishedLifecycleArtifactsBeyondInitiative: false,
    });
    assert.equal(allowed.allowed, true);
  });
});
