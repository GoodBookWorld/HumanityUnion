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
    stage("petition", "not_started"),
    stage("decision_session", "not_started"),
  ];

  it("allows completed and in-progress stages", () => {
    assert.equal(isLifecycleStageSelectable(stages, "analysis"), true);
    assert.equal(isLifecycleStageSelectable(stages, "proposal"), true);
  });

  it("allows only the immediate next Not Started stage", () => {
    assert.equal(isLifecycleStageSelectable(stages, "petition"), true);
    assert.equal(isLifecycleStageSelectable(stages, "decision_session"), false);
  });

  it("does not treat Revision as a selectable lifecycle stage", () => {
    assert.equal(isLifecycleStageSelectable(stages, "revision"), false);
  });

  it("blocks not_applicable stages", () => {
    assert.equal(
      isLifecycleStageSelectable([...stages, stage("archive", "not_applicable")], "archive"),
      false,
    );
  });

  it("Phase 03 — skips NOT_APPLICABLE when choosing the next unlocked stage", () => {
    const publicChoice = [
      stage("initiative", "completed"),
      stage("discussion", "in_progress"),
      stage("analysis", "not_applicable"),
      stage("petition", "not_applicable"),
      stage("collective_decision", "not_started"),
      stage("archive", "not_started"),
    ];
    assert.equal(isLifecycleStageSelectable(publicChoice, "collective_decision"), true);
    assert.equal(isLifecycleStageSelectable(publicChoice, "archive"), false);
    assert.equal(isLifecycleStageSelectable(publicChoice, "analysis"), false);
  });
});
