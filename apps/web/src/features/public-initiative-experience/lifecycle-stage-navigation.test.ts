import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicInitiativeLifecycleStageNavItem } from "@hu/types";

import {
  isLifecycleStageSelectable,
  resolveRecommendedLifecycleStageId,
} from "./lifecycle-stage-navigation";

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

describe("isLifecycleStageSelectable — participant next-only", () => {
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

  it("allows only the immediate next Not Started stage for non-stewards", () => {
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

describe("isLifecycleStageSelectable — Author stage freedom (Step 02)", () => {
  const steward = { viewerIsSteward: true } as const;

  const standardStoppedAtPetition = [
    stage("initiative", "completed"),
    stage("discussion", "completed"),
    stage("analysis", "published"),
    stage("proposal", "completed"),
    stage("petition", "published"),
    stage("decision_session", "not_started"),
    stage("collective_decision", "not_started"),
    stage("commitment", "not_started"),
    stage("tracking", "not_started"),
    stage("official_response", "not_started"),
    stage("public_impact", "not_started"),
    stage("archive", "not_started"),
  ];

  it("Author can open every applicable STANDARD stage regardless of status", () => {
    for (const item of standardStoppedAtPetition) {
      assert.equal(
        isLifecycleStageSelectable(standardStoppedAtPetition, item.stageId, steward),
        true,
        `${item.stageId} must be selectable for Author`,
      );
    }
  });

  it("Published/Not Started status does not affect Author selectability", () => {
    assert.equal(
      isLifecycleStageSelectable(standardStoppedAtPetition, "archive", steward),
      true,
    );
    assert.equal(
      isLifecycleStageSelectable(standardStoppedAtPetition, "petition", steward),
      true,
    );
  });

  it("Author cannot open profile-not-applicable stages", () => {
    const withNa = [...standardStoppedAtPetition, stage("legacy_skip", "not_applicable")];
    assert.equal(isLifecycleStageSelectable(withNa, "legacy_skip", steward), false);
  });

  it("PUBLIC_CHOICE Author can open only applicable stages", () => {
    const publicChoice = [
      stage("initiative", "completed"),
      stage("discussion", "in_progress"),
      stage("analysis", "not_applicable"),
      stage("proposal", "not_applicable"),
      stage("petition", "not_applicable"),
      stage("decision_session", "not_applicable"),
      stage("collective_decision", "not_started"),
      stage("commitment", "not_applicable"),
      stage("tracking", "not_applicable"),
      stage("official_response", "not_applicable"),
      stage("public_impact", "not_applicable"),
      stage("archive", "not_started"),
    ];

    assert.equal(isLifecycleStageSelectable(publicChoice, "initiative", steward), true);
    assert.equal(isLifecycleStageSelectable(publicChoice, "discussion", steward), true);
    assert.equal(isLifecycleStageSelectable(publicChoice, "collective_decision", steward), true);
    assert.equal(isLifecycleStageSelectable(publicChoice, "archive", steward), true);
    assert.equal(isLifecycleStageSelectable(publicChoice, "analysis", steward), false);
    assert.equal(isLifecycleStageSelectable(publicChoice, "petition", steward), false);
  });

  it("non-steward remains locked past the next unfinished stage", () => {
    assert.equal(
      isLifecycleStageSelectable(standardStoppedAtPetition, "decision_session", {
        viewerIsSteward: false,
      }),
      true,
    );
    assert.equal(
      isLifecycleStageSelectable(standardStoppedAtPetition, "collective_decision", {
        viewerIsSteward: false,
      }),
      false,
    );
    assert.equal(
      isLifecycleStageSelectable(standardStoppedAtPetition, "archive", {
        viewerIsSteward: false,
      }),
      false,
    );
  });

  it("recommendedStageId is guidance-only and does not equal Author lock", () => {
    const recommended = resolveRecommendedLifecycleStageId(standardStoppedAtPetition);
    assert.equal(recommended, "decision_session");
    assert.equal(
      isLifecycleStageSelectable(standardStoppedAtPetition, "archive", steward),
      true,
    );
  });
});
