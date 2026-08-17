import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Initiative, PublicInitiativeLifecycleRecordItem } from "@hu/types";

import {
  buildLifecycleNavigation,
  resolveCurrentStageIdFromPublicationMetadata,
} from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";

function emptyRecords(): Map<string, PublicInitiativeLifecycleRecordItem[]> {
  return new Map();
}

function withRecords(
  entries: Array<[string, number]>,
): Map<string, PublicInitiativeLifecycleRecordItem[]> {
  const map = emptyRecords();

  for (const [stageId, count] of entries) {
    map.set(
      stageId,
      Array.from({ length: count }, (_, index) => ({
        recordId: `${stageId}-${index}`,
        title: `${stageId} record`,
        updatedAt: "2026-08-09T00:00:00.000Z",
      })),
    );
  }

  return map;
}

const initiative = {
  initiativeId: "initiative-ux02",
  status: "proposal",
} as Initiative;

describe("Lifecycle UX Completion Pack 02 — navigation progress", () => {
  it("does not pin current stage to Initiative.status=proposal", () => {
    const counts = new Map<string, number>([
      ["initiative", 1],
      ["discussion", 1],
      ["analysis", 1],
      ["revision", 1],
    ]);

    assert.equal(resolveCurrentStageIdFromPublicationMetadata(counts), "petition");
  });

  it("labels past published stages Completed and future stages Not Started", () => {
    const { stages, currentStageId } = buildLifecycleNavigation(
      initiative,
      withRecords([
        ["initiative", 1],
        ["discussion", 1],
        ["analysis", 1],
      ]),
    );

    assert.equal(currentStageId, "proposal");
    assert.equal(stages.find((stage) => stage.stageId === "analysis")?.stateLabel, "Completed");
    assert.equal(stages.find((stage) => stage.stageId === "proposal")?.stateLabel, "In Progress");
    assert.equal(stages.find((stage) => stage.stageId === "revision")?.stateLabel, "Not Started");
    assert.equal(
      stages.some((stage) => stage.stateLabel === "Upcoming"),
      false,
    );
  });

  it("marks a published Civic Archive as Archived", () => {
    const { stages, currentStageId } = buildLifecycleNavigation(
      initiative,
      withRecords([
        ["initiative", 1],
        ["discussion", 1],
        ["analysis", 1],
        ["proposal", 1],
        ["revision", 1],
        ["petition", 1],
        ["decision_session", 1],
        ["collective_decision", 1],
        ["commitment", 1],
        ["tracking", 1],
        ["official_response", 1],
        ["public_impact", 1],
        ["archive", 1],
      ]),
    );

    assert.equal(currentStageId, "archive");
    assert.equal(stages.find((stage) => stage.stageId === "archive")?.stateLabel, "Archived");
  });
});
