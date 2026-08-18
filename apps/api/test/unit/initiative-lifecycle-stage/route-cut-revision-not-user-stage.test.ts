import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE,
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES,
  STANDARD_LIFECYCLE_STAGE_ROUTE,
  getInitiativeAuthorWorkflowStageContract,
  getNextApplicableLifecycleStageId,
  getNextInitiativeLifecycleStageId,
  isInitiativeLifecycleStageId,
  resolveInitiativeLifecycleState,
} from "@hu/types";

import { buildLifecycleNavigation } from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";
import { resolveNextStageAfterPublish } from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-transition.contract.js";

describe("Lifecycle route cut — Revision not a user-visible stage", () => {
  it("STANDARD route has 12 stages and omits Revision", () => {
    assert.equal(STANDARD_LIFECYCLE_STAGE_ROUTE.length, 12);
    assert.equal(STANDARD_LIFECYCLE_STAGE_ROUTE.includes("revision"), false);
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
  });

  it("experience stages omit Revision from lifecycle nav", () => {
    assert.equal(
      PUBLIC_INITIATIVE_EXPERIENCE_STAGES.some((stage) => stage.stageId === "revision"),
      false,
    );
    assert.equal(PUBLIC_INITIATIVE_EXPERIENCE_STAGES.length, 12);
  });

  it("proposal → petition on STANDARD", () => {
    assert.equal(getNextApplicableLifecycleStageId("proposal", "STANDARD"), "petition");
    assert.equal(getNextInitiativeLifecycleStageId("proposal"), "petition");
    assert.equal(resolveNextStageAfterPublish("proposal", "STANDARD"), "petition");
  });

  it("PUBLIC_CHOICE route is unchanged", () => {
    assert.deepEqual([...PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE], [
      "initiative",
      "discussion",
      "collective_decision",
      "archive",
    ]);
    assert.equal(getNextApplicableLifecycleStageId("discussion", "PUBLIC_CHOICE"), "collective_decision");
    assert.equal(
      getNextApplicableLifecycleStageId("collective_decision", "PUBLIC_CHOICE"),
      "archive",
    );
  });

  it("legacy Revision counts never become currentStageId", () => {
    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        revision: 9,
      },
    });
    assert.notEqual(state.currentStageId, "revision");
    assert.equal(state.currentStageId, "petition");

    const { stages, currentStageId } = buildLifecycleNavigation(
      {
        initiativeId: "initiative-route-cut",
        status: "revision",
        lifecycleProfile: "STANDARD",
      } as never,
      new Map([
        ["initiative", [{ recordId: "i1", title: "i", updatedAt: "2026-01-01T00:00:00.000Z" }]],
        ["discussion", [{ recordId: "d1", title: "d", updatedAt: "2026-01-01T00:00:00.000Z" }]],
        ["analysis", [{ recordId: "a1", title: "a", updatedAt: "2026-01-01T00:00:00.000Z" }]],
        ["proposal", [{ recordId: "p1", title: "p", updatedAt: "2026-01-01T00:00:00.000Z" }]],
        ["revision", [{ recordId: "r1", title: "r", updatedAt: "2026-01-01T00:00:00.000Z" }]],
      ]),
    );
    assert.equal(currentStageId, "petition");
    assert.equal(stages.some((stage) => stage.stageId === "revision"), false);
  });

  it("Revision remains content/history (compat workflow), not a registry route stage", () => {
    assert.equal(isInitiativeLifecycleStageId("revision"), false);
    assert.equal(getInitiativeAuthorWorkflowStageContract("revision")?.classification, "COMPATIBILITY");
  });
});
