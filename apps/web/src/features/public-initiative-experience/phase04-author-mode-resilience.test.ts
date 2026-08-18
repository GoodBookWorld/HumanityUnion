import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLifecycleGuideReadModel,
  resolveShellAuthorModeEligible,
} from "./initiative-lifecycle-shell.js";
import { isInitiativeLifecycleAuthorWorkspaceStage } from "@hu/types";

describe("Lifecycle Finalization Phase 04 — Author Mode resilience", () => {
  it("keeps Author Mode when stewardship is true even if optional stage projections failed", () => {
    const guide = buildLifecycleGuideReadModel({
      experience: {
        viewerIsSteward: true,
        currentStageId: "petition",
        lifecycleProfile: "STANDARD",
        lifecycleStages: [
          { stageId: "petition", state: "in_progress", hash: "petition", label: "Petition", stateLabel: "In Progress", recordCount: 0 },
        ],
        optionalStageDiagnostics: {
          petition: { health: "unavailable", reasonCode: "infrastructure_failure" },
        },
      } as never,
      selectedStageId: "petition",
      viewerIsSteward: true,
    });

    assert.equal(guide.viewerIsSteward, true);
    assert.equal(
      resolveShellAuthorModeEligible({
        viewerIsSteward: guide.viewerIsSteward,
        selectedStageId: "petition",
        isAuthorWorkspaceStage: isInitiativeLifecycleAuthorWorkspaceStage,
      }),
      true,
    );
  });

  it("does not grant Author Mode from Allies alone", () => {
    assert.equal(
      resolveShellAuthorModeEligible({
        viewerIsSteward: false,
        selectedStageId: "petition",
        isAuthorWorkspaceStage: isInitiativeLifecycleAuthorWorkspaceStage,
      }),
      false,
    );
  });
});
