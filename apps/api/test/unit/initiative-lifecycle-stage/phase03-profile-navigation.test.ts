import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE,
  STANDARD_LIFECYCLE_STAGE_ROUTE,
  resolveInitiativeLifecycleState,
} from "@hu/types";

describe("Phase 03 — profile-aware navigation from Phase 02 resolver", () => {
  it("STANDARD navigation remains full registry route", () => {
    assert.ok(STANDARD_LIFECYCLE_STAGE_ROUTE.includes("analysis"));
    assert.ok(STANDARD_LIFECYCLE_STAGE_ROUTE.includes("petition"));
    assert.equal(STANDARD_LIFECYCLE_STAGE_ROUTE[0], "initiative");
    assert.equal(STANDARD_LIFECYCLE_STAGE_ROUTE[1], "discussion");
  });

  it("PUBLIC_CHOICE navigation contains exactly applicable canonical stages", () => {
    assert.deepEqual([...PUBLIC_CHOICE_LIFECYCLE_STAGE_ROUTE], [
      "initiative",
      "discussion",
      "collective_decision",
      "archive",
    ]);

    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "PUBLIC_CHOICE",
      publishedStageCounts: { initiative: 1 },
    });
    assert.equal(state.currentStageId, "discussion");
    assert.ok(state.notApplicableStageIds.includes("analysis"));
    assert.ok(state.notApplicableStageIds.includes("petition"));
    assert.equal(state.stageApplicability.analysis, "NOT_APPLICABLE");
  });

  it("optional lookup degradation does not change current stage derivation", () => {
    const before = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        revision: 1,
      },
    });
    // Absent petition artifact (count 0) — current remains petition.
    assert.equal(before.currentStageId, "petition");
    const afterSoftFail = resolveInitiativeLifecycleState({
      lifecycleProfile: "STANDARD",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        revision: 1,
        // petition still absent
      },
    });
    assert.equal(afterSoftFail.currentStageId, "petition");
  });
});
