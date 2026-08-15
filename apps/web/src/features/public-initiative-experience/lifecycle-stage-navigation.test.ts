import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicInitiativeLifecycleStageNavItem } from "@hu/types";

import { isLifecycleStageSelectable } from "./lifecycle-stage-navigation";

function stage(
  stageId: string,
  state: PublicInitiativeLifecycleStageNavItem["state"],
): PublicInitiativeLifecycleStageNavItem {
  return {
    stageId,
    label: stageId,
    hash: stageId,
    state,
    stateLabel: state,
    recordCount: state === "completed" || state === "published" || state === "archived" ? 1 : 0,
  };
}

describe("isLifecycleStageSelectable", () => {
  const stages = [
    stage("initiative", "completed"),
    stage("analysis", "completed"),
    stage("proposal", "in_progress"),
    stage("revision", "not_started"),
    stage("petition", "not_started"),
  ];

  it("allows completed and in-progress stages", () => {
    assert.equal(isLifecycleStageSelectable(stages, "analysis"), true);
    assert.equal(isLifecycleStageSelectable(stages, "proposal"), true);
  });

  it("allows only the immediate next Not Started stage", () => {
    assert.equal(isLifecycleStageSelectable(stages, "revision"), true);
    assert.equal(isLifecycleStageSelectable(stages, "petition"), false);
  });

  it("blocks not_applicable stages", () => {
    assert.equal(
      isLifecycleStageSelectable([...stages, stage("archive", "not_applicable")], "archive"),
      false,
    );
  });
});
