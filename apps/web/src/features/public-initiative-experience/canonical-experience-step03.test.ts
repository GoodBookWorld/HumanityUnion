import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { isLifecycleStageSelectable } from "./lifecycle-stage-navigation";
import { buildInitiativeExperienceHref } from "../initiative-owner-studio/initiative-experience-routes";

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe("Initiative Lifecycle Step 03/04 — shell gate removal + parity", () => {
  it("L — obsolete requires* cross-stage shell helpers are deleted", () => {
    const source = readFileSync(path.join(HERE, "initiative-lifecycle-shell.ts"), "utf8");
    assert.equal(source.includes("requiresDecisionSessionBeforeCollectiveDecision"), false);
    assert.equal(source.includes("requiresPublicImpactBeforeCivicArchive"), false);
  });

  it("M — non-steward selectability is not broadened by Step 03", () => {
    const stages = [
      {
        stageId: "initiative",
        label: "Initiative",
        hash: "initiative",
        state: "completed" as const,
        stateLabel: "Completed",
        recordCount: 1,
      },
      {
        stageId: "petition",
        label: "Petition",
        hash: "petition",
        state: "published" as const,
        stateLabel: "Published",
        recordCount: 1,
      },
      {
        stageId: "decision_session",
        label: "Decision Session",
        hash: "decision-session",
        state: "not_started" as const,
        stateLabel: "Not Started",
        recordCount: 0,
      },
      {
        stageId: "archive",
        label: "Civic Archive",
        hash: "civic-archive",
        state: "not_started" as const,
        stateLabel: "Not Started",
        recordCount: 0,
      },
    ];

    assert.equal(isLifecycleStageSelectable(stages, "decision_session", { viewerIsSteward: false }), true);
    assert.equal(isLifecycleStageSelectable(stages, "archive", { viewerIsSteward: false }), false);
    assert.equal(isLifecycleStageSelectable(stages, "archive", { viewerIsSteward: true }), true);
  });

  it("Step 01 Workspace/Header parity remains intact", () => {
    assert.equal(buildInitiativeExperienceHref("x"), "/initiatives/public/x");
  });
});
