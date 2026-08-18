import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getNextApplicableLifecycleStageId,
  resolveInitiativeLifecycleState,
} from "@hu/types";

import { summarizeLifecycleTransitionPostcondition } from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-transition.contract.js";

describe("Final Certification Fix 01 — profile-aware publication nextStageId", () => {
  it("PUBLIC_CHOICE collective_decision → nextStageId archive", () => {
    const summary = summarizeLifecycleTransitionPostcondition({
      initiativeId: "initiative-pc-1",
      publishedStageId: "collective_decision",
      lifecycleProfile: "PUBLIC_CHOICE",
    });

    assert.equal(summary.nextStageId, "archive");
    assert.equal(
      getNextApplicableLifecycleStageId("collective_decision", "PUBLIC_CHOICE"),
      "archive",
    );
    assert.equal(summary.currentStageId, "archive");
  });

  it("STANDARD collective_decision → nextStageId commitment (unchanged)", () => {
    const summary = summarizeLifecycleTransitionPostcondition({
      initiativeId: "initiative-std-1",
      publishedStageId: "collective_decision",
      lifecycleProfile: "STANDARD",
    });

    assert.equal(summary.nextStageId, "commitment");
    assert.equal(
      getNextApplicableLifecycleStageId("collective_decision", "STANDARD"),
      "commitment",
    );
    assert.equal(summary.currentStageId, "commitment");
  });

  it("missing profile defaults to STANDARD next stage (historical Initiatives)", () => {
    const summary = summarizeLifecycleTransitionPostcondition({
      initiativeId: "initiative-legacy-1",
      publishedStageId: "collective_decision",
      lifecycleProfile: null,
    });

    assert.equal(summary.nextStageId, "commitment");
  });

  it("resolver after PUBLIC_CHOICE collective_decision publication matches nextStageId archive", () => {
    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "PUBLIC_CHOICE",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        collective_decision: 1,
      },
    });

    assert.equal(state.currentStageId, "archive");
    assert.equal(state.nextStageId, null);
    assert.equal(
      summarizeLifecycleTransitionPostcondition({
        initiativeId: "initiative-pc-2",
        publishedStageId: "collective_decision",
        lifecycleProfile: "PUBLIC_CHOICE",
        priorPublishedStageCounts: {
          initiative: 1,
          discussion: 1,
        },
      }).nextStageId,
      "archive",
    );
  });
});
