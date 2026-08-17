import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLifecycleNavigation,
  resolveCurrentStageIdFromPublicationMetadata,
} from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";

describe("Lifecycle Finalization Phase 02 — experience navigation + soft progress", () => {
  it("derives current stage from published artifacts, not Initiative.status", () => {
    const counts = new Map<string, number>([
      ["initiative", 1],
      ["discussion", 1],
      ["analysis", 1],
      ["proposal", 0],
    ]);
    assert.equal(resolveCurrentStageIdFromPublicationMetadata(counts, "STANDARD"), "proposal");
  });

  it("PUBLIC_CHOICE progresses initiative → discussion", () => {
    const counts = new Map<string, number>([["initiative", 1]]);
    assert.equal(
      resolveCurrentStageIdFromPublicationMetadata(counts, "PUBLIC_CHOICE"),
      "discussion",
    );
  });

  it("PUBLIC_CHOICE discussion complete → collective_decision", () => {
    const counts = new Map<string, number>([
      ["initiative", 1],
      ["discussion", 1],
    ]);
    assert.equal(
      resolveCurrentStageIdFromPublicationMetadata(counts, "PUBLIC_CHOICE"),
      "collective_decision",
    );
  });

  it("marks profile-skipped stages not_applicable without treating them as missing", () => {
    const records = new Map([
      ["initiative", [{ recordId: "i1" } as never]],
      ["discussion", []],
      ["collective_decision", []],
      ["archive", []],
    ]);
    const { stages, currentStageId } = buildLifecycleNavigation(
      {
        initiativeId: "initiative-1",
        status: "proposal",
        lifecyclePhase: "projected",
        lifecycleProfile: "PUBLIC_CHOICE",
      } as never,
      records,
    );

    assert.equal(currentStageId, "discussion");
    const analysis = stages.find((stage) => stage.stageId === "analysis");
    assert.equal(analysis?.state, "not_applicable");
    const petition = stages.find((stage) => stage.stageId === "petition");
    assert.equal(petition?.state, "not_applicable");
    const discussion = stages.find((stage) => stage.stageId === "discussion");
    assert.equal(discussion?.state, "in_progress");
  });
});
