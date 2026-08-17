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
  it("STANDARD route includes Discussion then full civic lifecycle", () => {
    assert.deepEqual([...STANDARD_LIFECYCLE_STAGE_ROUTE], [
      "initiative",
      "discussion",
      "analysis",
      "proposal",
      "revision",
      "petition",
      "decision_session",
      "collective_decision",
      "commitment",
      "tracking",
      "official_response",
      "public_impact",
      "archive",
    ]);
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
    assert.equal(state.nextStageId, "revision");
    assert.equal(state.stageApplicability.analysis, "COMPLETED");
    assert.equal(state.stageApplicability.proposal, "CURRENT");
    assert.equal(state.stageApplicability.petition, "LOCKED");
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
