import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getInitiativeLifecycleStageDefinition,
  getNextInitiativeLifecycleStageId,
  getPreviousInitiativeLifecycleStageId,
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY,
  isInitiativeLifecycleAuthorWorkspaceStage,
  isInitiativeLifecycleStageId,
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES,
} from "@hu/types";

describe("Initiative Lifecycle Part A — canonical stage registry", () => {
  it("has exactly 12 stages, in the same order as PUBLIC_INITIATIVE_EXPERIENCE_STAGES", () => {
    assert.equal(INITIATIVE_LIFECYCLE_STAGE_REGISTRY.length, 12);
    assert.equal(INITIATIVE_LIFECYCLE_STAGE_REGISTRY.length, PUBLIC_INITIATIVE_EXPERIENCE_STAGES.length);

    INITIATIVE_LIFECYCLE_STAGE_REGISTRY.forEach((stage, index) => {
      const publicStage = PUBLIC_INITIATIVE_EXPERIENCE_STAGES[index];
      assert.equal(stage.stageId, publicStage?.stageId, `stageId mismatch at index ${index}`);
      assert.equal(stage.label, publicStage?.label, `label mismatch at index ${index}`);
      assert.equal(stage.hash, publicStage?.hash, `hash mismatch at index ${index}`);
      assert.equal(stage.order, index);
    });
  });

  it("reuses the exact existing stageId set — never renames a load-bearing id", () => {
    const registryIds = INITIATIVE_LIFECYCLE_STAGE_REGISTRY.map((stage) => stage.stageId);
    const publicIds = PUBLIC_INITIATIVE_EXPERIENCE_STAGES.map((stage) => stage.stageId);
    assert.deepEqual(registryIds, publicIds);
  });

  it("getInitiativeLifecycleStageDefinition resolves a known stage and rejects an unknown one", () => {
    const analysis = getInitiativeLifecycleStageDefinition("analysis");
    assert.ok(analysis);
    assert.equal(analysis?.label, "Collaborative Analysis");

    assert.equal(getInitiativeLifecycleStageDefinition("not-a-real-stage"), null);
  });

  it("isInitiativeLifecycleStageId narrows correctly", () => {
    assert.equal(isInitiativeLifecycleStageId("archive"), true);
    assert.equal(isInitiativeLifecycleStageId("not-a-real-stage"), false);
    assert.equal(isInitiativeLifecycleStageId(42), false);
  });

  it("getNextInitiativeLifecycleStageId / getPreviousInitiativeLifecycleStageId walk the canonical order", () => {
    assert.equal(getNextInitiativeLifecycleStageId("initiative"), "analysis");
    assert.equal(getNextInitiativeLifecycleStageId("archive"), null);
    assert.equal(getPreviousInitiativeLifecycleStageId("analysis"), "initiative");
    assert.equal(getPreviousInitiativeLifecycleStageId("initiative"), null);
  });

  it("isInitiativeLifecycleAuthorWorkspaceStage is false only for 'initiative', true from 'analysis' onward", () => {
    assert.equal(isInitiativeLifecycleAuthorWorkspaceStage("initiative"), false);
    assert.equal(isInitiativeLifecycleAuthorWorkspaceStage("analysis"), true);
    assert.equal(isInitiativeLifecycleAuthorWorkspaceStage("archive"), true);
    assert.equal(isInitiativeLifecycleAuthorWorkspaceStage("not-a-real-stage"), false);

    for (const stage of INITIATIVE_LIFECYCLE_STAGE_REGISTRY) {
      const expected = stage.stageId !== "initiative";
      assert.equal(
        isInitiativeLifecycleAuthorWorkspaceStage(stage.stageId),
        expected,
        `mismatch for ${stage.stageId}`,
      );
    }
  });
});
