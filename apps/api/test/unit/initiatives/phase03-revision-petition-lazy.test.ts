import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative } from "@hu/types";

import {
  buildLifecycleNavigation,
  resolveCurrentStageIdFromPublicationMetadata,
} from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";
import { settleOptionalLifecycleLookup } from "../../../src/shared/lifecycle/optional-lifecycle-lookup.js";
import { resolveLifecycleStateAfterStagePublication } from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-transition.contract.js";

/**
 * Phase 03 regression — mirrors forensic initiative-1785948978037 conditions
 * without mutating staging:
 * - Revision published
 * - Petition becomes current/available (LAZY — artifact may be absent)
 * - Missing petition must not be treated as infrastructure failure
 * - Current stage remains petition; selection is separate
 */

describe("Phase 03 — Revision→Petition lazy-open regression", () => {
  it("after Revision publish, resolver current stage is Petition", () => {
    const state = resolveLifecycleStateAfterStagePublication({
      lifecycleProfile: "STANDARD",
      publishedStageId: "revision",
      priorPublishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
      },
    });

    assert.equal(state.currentStageId, "petition");
    assert.ok(state.availableStageIds.includes("petition"));
    assert.equal(state.stageApplicability.petition, "CURRENT");
  });

  it("Experience nav marks Petition in_progress with zero petition records (LAZY)", () => {
    const initiative = {
      initiativeId: "initiative-forensic-fixture",
      status: "proposal",
      lifecyclePhase: "projected",
      lifecycleProfile: "STANDARD",
    } as Initiative;

    const records = new Map([
      ["initiative", [{ recordId: "i1" } as never]],
      ["discussion", [{ recordId: "d1" } as never]],
      ["analysis", [{ recordId: "a1" } as never]],
      ["proposal", [{ recordId: "p1" } as never]],
      ["revision", [{ recordId: "r1" } as never]],
      ["petition", []],
    ]);

    const { stages, currentStageId } = buildLifecycleNavigation(initiative, records);
    assert.equal(currentStageId, "petition");
    const petition = stages.find((stage) => stage.stageId === "petition");
    assert.equal(petition?.state, "in_progress");
    assert.equal(petition?.recordCount, 0);
  });

  it("absent petition artifact is NOT_CREATED_YET (not INFRASTRUCTURE_FAILURE)", async () => {
    const settled = await settleOptionalLifecycleLookup(
      "petition_by_initiative",
      Promise.resolve(null),
      null,
    );
    assert.equal(settled.classification, "NOT_CREATED_YET");
    assert.equal(settled.degraded, false);
  });

  it("selecting Petition does not change canonical currentStage derivation", () => {
    const counts = new Map<string, number>([
      ["initiative", 1],
      ["discussion", 1],
      ["analysis", 1],
      ["proposal", 1],
      ["revision", 1],
    ]);
    const current = resolveCurrentStageIdFromPublicationMetadata(counts, "STANDARD");
    assert.equal(current, "petition");
    // selectedStage is DISPLAY-ONLY — still "petition" current after inspecting analysis
    assert.equal(resolveCurrentStageIdFromPublicationMetadata(counts, "STANDARD"), "petition");
  });
});
