import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicInitiativeExperienceProjection, PublicInitiativeLifecycleStageNavItem } from "@hu/types";
import { isInitiativeLifecycleAuthorWorkspaceStage } from "@hu/types";

import { isLifecycleStageSelectable } from "./lifecycle-stage-navigation";
import {
  buildLifecycleGuideReadModel,
  publicSafeOptionalSectionMessage,
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
    stage("petition", "not_started"),
  ];

  const publicChoiceStages = [
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

  it("omits NOT_APPLICABLE stages and Civic Archive from PUBLIC_CHOICE nav display", () => {
    const displayed = selectLifecycleNavStagesForDisplay(publicChoiceStages, "PUBLIC_CHOICE");
    assert.deepEqual(
      displayed.map((item) => item.stageId),
      ["initiative", "discussion", "collective_decision"],
    );
  });

  it("STANDARD nav display keeps full applicable route stages including archive", () => {
    const displayed = selectLifecycleNavStagesForDisplay(standardStages, "STANDARD");
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

  it("#revision is not lifecycle navigation (content/history only)", () => {
    const resolution = resolveLifecycleShellHash("#revision", standardStages);
    assert.equal(resolution.kind, "fallback_overview");
    if (resolution.kind === "fallback_overview") {
      assert.equal(resolution.reason, "invalid");
    }
  });

  it("locked future stage hash falls back for non-steward (does not open)", () => {
    const resolution = resolveLifecycleShellHash(
      "#decision-session",
      [...standardStages, stage("decision_session", "not_started", "decision-session")],
      { viewerIsSteward: false },
    );
    assert.equal(resolution.kind, "fallback_overview");
    if (resolution.kind === "fallback_overview") {
      assert.equal(resolution.reason, "locked");
    }
  });

  it("Step 02 — Author hash opens far applicable stages without progression lock", () => {
    const stages = [
      ...standardStages,
      stage("decision_session", "not_started", "decision-session"),
      stage("archive", "not_started", "civic-archive"),
    ];
    const resolution = resolveLifecycleShellHash("#civic-archive", stages, {
      viewerIsSteward: true,
    });
    assert.equal(resolution.kind, "lifecycle_stage");
    if (resolution.kind === "lifecycle_stage") {
      assert.equal(resolution.stageId, "archive");
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

  it("#comment-{id} opens Discussion Center and focuses that comment", () => {
    const resolution = resolveLifecycleShellHash("#comment-cmt-source-9", publicChoiceStages);
    assert.equal(resolution.kind, "discussion_tab");
    if (resolution.kind === "discussion_tab") {
      assert.equal(resolution.focusCommentId, "cmt-source-9");
    }
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
      "petition",
    );
    assert.equal(
      publicSafeOptionalSectionMessage(
        { civicArchive: { health: "unavailable", reasonCode: "infrastructure_failure" } },
        "civicArchive",
      ),
      "civicArchive",
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

  it("Step 02 — Author guide lists all applicable stages as available; recommended ≠ selected lock", () => {
    const stages = [
      stage("initiative", "completed"),
      stage("discussion", "completed"),
      stage("analysis", "completed"),
      stage("proposal", "in_progress"),
      stage("petition", "not_started"),
      stage("decision_session", "not_started"),
      stage("archive", "not_started"),
    ];
    const experience = {
      currentStageId: "proposal",
      recommendedStageId: "proposal",
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
    assert.equal(guide.recommendedStageId, "proposal");
    assert.equal(guide.currentStageId, "proposal");
    assert.notEqual(guide.selectedStageId, guide.recommendedStageId);
    assert.equal(guide.availableStageIds.includes("archive"), true);
    assert.equal(guide.availableStageIds.includes("decision_session"), true);
    assert.equal(guide.lockedStageIds.length, 0);
  });

  it("Step 02 — non-steward guide still locks far Not Started stages", () => {
    const stages = [
      stage("initiative", "completed"),
      stage("proposal", "in_progress"),
      stage("petition", "not_started"),
      stage("decision_session", "not_started"),
    ];
    const experience = {
      currentStageId: "proposal",
      lifecycleStages: stages,
      lifecycleProfile: "STANDARD",
      viewerIsSteward: false,
    } as PublicInitiativeExperienceProjection;

    const guide = buildLifecycleGuideReadModel({
      experience,
      selectedStageId: "proposal",
      viewerIsSteward: false,
    });

    assert.equal(guide.availableStageIds.includes("petition"), true);
    assert.equal(guide.availableStageIds.includes("decision_session"), false);
    assert.equal(guide.lockedStageIds.includes("decision_session"), true);
  });

  it("Step 04 — obsolete cross-stage requires* helpers are removed from the shell", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const shellPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "initiative-lifecycle-shell.ts");
    const source = fs.readFileSync(shellPath, "utf8");
    assert.equal(source.includes("requiresPublicImpactBeforeCivicArchive"), false);
    assert.equal(source.includes("requiresDecisionSessionBeforeCollectiveDecision"), false);
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
    assert.equal(guide.currentStageId, "collective_decision");
    assert.equal(guide.selectedStageId, "collective_decision");
  });
});
