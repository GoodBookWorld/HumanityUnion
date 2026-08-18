import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicInitiativeExperienceProjection, PublicInitiativeLifecycleStageNavItem } from "@hu/types";
import { isInitiativeLifecycleAuthorWorkspaceStage } from "@hu/types";

import { isLifecycleStageSelectable } from "./lifecycle-stage-navigation";
import {
  buildLifecycleGuideReadModel,
  publicSafeOptionalSectionMessage,
  requiresDecisionSessionBeforeCollectiveDecision,
  requiresPublicImpactBeforeCivicArchive,
  resolveLifecycleShellHash,
  resolveShellAuthorModeEligible,
  selectLifecycleNavStagesForDisplay,
} from "./initiative-lifecycle-shell";

function stage(
  stageId: string,
  state: PublicInitiativeLifecycleStageNavItem["state"],
  hash = stageId,
): PublicInitiativeLifecycleStageNavItem {
  return {
    stageId,
    label: stageId,
    hash,
    state,
    stateLabel: state,
    recordCount: state === "completed" || state === "published" || state === "archived" ? 1 : 0,
  };
}

describe("Phase 03 — lifecycle shell helpers", () => {
  const standardStages = [
    stage("initiative", "completed"),
    stage("discussion", "completed"),
    stage("analysis", "completed"),
    stage("proposal", "in_progress"),
    stage("revision", "not_started"),
    stage("petition", "not_started"),
  ];

  const publicChoiceStages = [
    stage("initiative", "completed"),
    stage("discussion", "in_progress"),
    stage("analysis", "not_applicable"),
    stage("proposal", "not_applicable"),
    stage("revision", "not_applicable"),
    stage("petition", "not_applicable"),
    stage("decision_session", "not_applicable"),
    stage("collective_decision", "not_started"),
    stage("commitment", "not_applicable"),
    stage("tracking", "not_applicable"),
    stage("official_response", "not_applicable"),
    stage("public_impact", "not_applicable"),
    stage("archive", "not_started"),
  ];

  it("omits NOT_APPLICABLE stages from PUBLIC_CHOICE nav display", () => {
    const displayed = selectLifecycleNavStagesForDisplay(publicChoiceStages);
    assert.deepEqual(
      displayed.map((item) => item.stageId),
      ["initiative", "discussion", "collective_decision", "archive"],
    );
  });

  it("STANDARD nav display keeps full applicable route stages", () => {
    const displayed = selectLifecycleNavStagesForDisplay(standardStages);
    assert.equal(displayed.length, standardStages.length);
  });

  it("selected stage does not alter current stage in Guide read model", () => {
    const experience = {
      currentStageId: "proposal",
      lifecycleStages: standardStages,
      lifecycleProfile: "STANDARD",
      viewerIsSteward: true,
      optionalStageDiagnostics: undefined,
    } as PublicInitiativeExperienceProjection;

    const guide = buildLifecycleGuideReadModel({
      experience,
      selectedStageId: "analysis",
    });
    assert.equal(guide.currentStageId, "proposal");
    assert.equal(guide.selectedStageId, "analysis");
    assert.notEqual(guide.currentStageId, guide.selectedStageId);
  });

  it("Author Mode eligibility uses stewardship, not Allies", () => {
    assert.equal(
      resolveShellAuthorModeEligible({
        viewerIsSteward: true,
        selectedStageId: "analysis",
        isAuthorWorkspaceStage: isInitiativeLifecycleAuthorWorkspaceStage,
      }),
      true,
    );
    assert.equal(
      resolveShellAuthorModeEligible({
        viewerIsSteward: false,
        selectedStageId: "analysis",
        isAuthorWorkspaceStage: isInitiativeLifecycleAuthorWorkspaceStage,
      }),
      false,
    );
  });

  it("invalid hash falls back to overview", () => {
    const resolution = resolveLifecycleShellHash("#not-a-stage", standardStages);
    assert.equal(resolution.kind, "fallback_overview");
    if (resolution.kind === "fallback_overview") {
      assert.equal(resolution.reason, "invalid");
    }
  });

  it("locked future stage hash falls back (does not open)", () => {
    const resolution = resolveLifecycleShellHash("#petition", standardStages);
    assert.equal(resolution.kind, "fallback_overview");
    if (resolution.kind === "fallback_overview") {
      assert.equal(resolution.reason, "locked");
    }
  });

  it("direct valid stage link opens selectable stage", () => {
    const resolution = resolveLifecycleShellHash("#collaborative-analysis", standardStages);
    assert.equal(resolution.kind, "lifecycle_stage");
    if (resolution.kind === "lifecycle_stage") {
      assert.equal(resolution.stageId, "analysis");
      assert.equal(resolution.selectable, true);
    }
  });

  it("#discussion opens Discussion Center tab (not a second Discussion workspace)", () => {
    const resolution = resolveLifecycleShellHash("#discussion", publicChoiceStages);
    assert.equal(resolution.kind, "discussion_tab");
  });

  it("not-applicable stage hash falls back without false missing error", () => {
    const resolution = resolveLifecycleShellHash("#petition", publicChoiceStages);
    assert.equal(resolution.kind, "fallback_overview");
    if (resolution.kind === "fallback_overview") {
      assert.equal(resolution.reason, "not_applicable");
    }
  });

  it("optional diagnostic message is public-safe and local", () => {
    assert.equal(
      publicSafeOptionalSectionMessage(
        { petition: { health: "unavailable", reasonCode: "infrastructure_failure" } },
        "petition",
      ),
      "Petition information is temporarily unavailable.",
    );
    assert.equal(
      publicSafeOptionalSectionMessage({ petition: { health: "absent", reasonCode: "not_created_yet" } }, "petition"),
      null,
    );
  });

  it("completed prior stage remains selectable for review", () => {
    assert.equal(isLifecycleStageSelectable(standardStages, "analysis"), true);
    assert.equal(isLifecycleStageSelectable(standardStages, "initiative"), true);
  });

  it("STANDARD Archive remains gated by Public Impact prerequisite", () => {
    assert.equal(requiresPublicImpactBeforeCivicArchive("STANDARD"), true);
    assert.equal(requiresPublicImpactBeforeCivicArchive(null), true);
  });

  it("PUBLIC_CHOICE Archive does not require Public Impact after Collective Decision", () => {
    assert.equal(requiresPublicImpactBeforeCivicArchive("PUBLIC_CHOICE"), false);
  });

  it("STANDARD Collective Decision remains gated by Decision Session prerequisite", () => {
    assert.equal(requiresDecisionSessionBeforeCollectiveDecision("STANDARD"), true);
    assert.equal(requiresDecisionSessionBeforeCollectiveDecision(null), true);
  });

  it("PUBLIC_CHOICE Collective Decision does not require Decision Session", () => {
    assert.equal(requiresDecisionSessionBeforeCollectiveDecision("PUBLIC_CHOICE"), false);
  });

  it("PUBLIC_CHOICE guide selectedStage does not alter currentStage after Collective Decision", () => {
    const stages = [
      stage("initiative", "completed"),
      stage("discussion", "completed"),
      stage("collective_decision", "completed"),
      stage("archive", "in_progress"),
      stage("public_impact", "not_applicable"),
    ];
    const experience = {
      currentStageId: "archive",
      lifecycleStages: stages,
      lifecycleProfile: "PUBLIC_CHOICE",
      viewerIsSteward: true,
    } as PublicInitiativeExperienceProjection;

    const guide = buildLifecycleGuideReadModel({
      experience,
      selectedStageId: "collective_decision",
    });
    assert.equal(guide.currentStageId, "archive");
    assert.equal(guide.selectedStageId, "collective_decision");
    assert.notEqual(guide.currentStageId, guide.selectedStageId);
    assert.equal(requiresPublicImpactBeforeCivicArchive(guide.lifecycleProfile), false);
  });
});
