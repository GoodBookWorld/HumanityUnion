import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicInitiativeExperienceProjection, PublicInitiativeLifecycleStageNavItem } from "@hu/types";

import {
  buildInitiativeExperienceHref,
  buildInitiativeExperienceManageHref,
} from "../initiative-owner-studio/initiative-experience-routes";
import { buildLifecycleGuideReadModel, selectLifecycleNavStagesForDisplay } from "./initiative-lifecycle-shell";
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

describe("Initiative Lifecycle Step 02 — Author freedom + Step 01 parity", () => {
  it("Workspace/Header parity from Step 01 remains intact", () => {
    assert.equal(buildInitiativeExperienceHref("i1"), "/initiatives/public/i1");
    assert.equal(buildInitiativeExperienceManageHref("i1"), "/initiatives/public/i1#manage");
  });

  it("PUBLIC_CHOICE nav display is Initiative / Discussion / Collective Decision (no Civic Archive)", () => {
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
    assert.deepEqual(
      selectLifecycleNavStagesForDisplay(publicChoice, "PUBLIC_CHOICE").map((s) => s.stageId),
      ["initiative", "discussion", "collective_decision"],
    );
  });

  it("selected / recommended / current remain distinct roles for Authors", () => {
    const stages = [
      stage("initiative", "completed"),
      stage("petition", "published"),
      stage("decision_session", "not_started"),
      stage("archive", "not_started"),
    ];
    const experience = {
      currentStageId: "decision_session",
      recommendedStageId: "decision_session",
      lifecycleStages: stages,
      lifecycleProfile: "STANDARD",
      viewerIsSteward: true,
    } as PublicInitiativeExperienceProjection;

    const guide = buildLifecycleGuideReadModel({
      experience,
      selectedStageId: "archive",
      viewerIsSteward: true,
    });

    assert.equal(guide.selectedStageId, "archive");
    assert.equal(guide.recommendedStageId, "decision_session");
    assert.equal(guide.currentStageId, "decision_session");
    assert.equal(isLifecycleStageSelectable(stages, "archive", { viewerIsSteward: true }), true);
  });
});
