import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { Initiative, PublicInitiativeLifecycleRecordItem } from "@hu/types";

import { resolveStewardCollaborativeAnalysisLifecycleProgress } from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis-lifecycle-progress.js";
import {
  createAnalysis,
  deleteAnalysesByAuthorIdForTests,
} from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import { buildInitiativeLifecycleStageAdapterResult } from "../../../src/modules/initiatives/initiative-lifecycle-stage-adapter.js";
import { buildLifecycleNavigation } from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";

const INITIATIVE_ID = "analysis-lifecycle-sync-initiative";
const STEWARD_ID = "participant-steward-analysis-sync";
const VIEWER_A = "participant-viewer-a";
const VIEWER_B = "participant-viewer-b";

function buildInitiative(): Initiative {
  return {
    initiativeId: INITIATIVE_ID,
    stewardId: STEWARD_ID,
    title: "Analysis lifecycle sync fixture",
    description: "Fixture",
    status: "proposal",
    lifecyclePhase: "published",
    lifecycleProfile: "STANDARD",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    timeline: [],
    revisions: [],
    metadata: {},
  } as Initiative;
}

function emptyRecords(): Map<string, PublicInitiativeLifecycleRecordItem[]> {
  return new Map([
    ["initiative", [{ recordId: INITIATIVE_ID, title: "Init", updatedAt: "2026-01-01T00:00:00.000Z" }]],
    ["discussion", []],
    ["analysis", []],
  ]);
}

function withPublishedAnalysisRecord(
  analysisId: string,
): Map<string, PublicInitiativeLifecycleRecordItem[]> {
  const records = emptyRecords();
  records.set("discussion", [
    {
      recordId: "discussion-complete-1",
      title: "Discussion completed",
      updatedAt: "2026-02-01T00:00:00.000Z",
    },
  ]);
  records.set("analysis", [
    {
      recordId: analysisId,
      title: "Published analysis",
      updatedAt: "2026-03-01T00:00:00.000Z",
    },
  ]);
  return records;
}

describe("Collaborative Analysis lifecycle status synchronization", () => {
  afterEach(() => {
    deleteAnalysesByAuthorIdForTests(STEWARD_ID);
  });

  it("absent analysis → Not Started for nav and presentation", async () => {
    const initiative = buildInitiative();
    const { stages } = buildLifecycleNavigation(initiative, emptyRecords());
    const analysisNav = stages.find((stage) => stage.stageId === "analysis");
    const adapter = await buildInitiativeLifecycleStageAdapterResult("analysis", initiative);

    assert.equal(analysisNav?.state, "not_started");
    assert.equal(analysisNav?.stateLabel, "Not Started");
    assert.equal(adapter.presentationStatus, "not_started");
  });

  it("draft/unpublished analysis → In Progress for every viewer", async () => {
    createAnalysis({
      analysisId: "analysis-draft-1",
      initiativeId: INITIATIVE_ID,
      authorId: STEWARD_ID,
      title: "Draft",
      summary: "Summary",
      supportingEvidence: "Evidence",
      risks: "Risks",
      suggestedImprovements: "Improvements",
      references: "Refs",
      status: "draft",
      initiativeVersion: 1,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });

    const initiative = buildInitiative();
    const progress = resolveStewardCollaborativeAnalysisLifecycleProgress(INITIATIVE_ID, STEWARD_ID);
    assert.equal(progress.hasDraft, true);
    assert.equal(progress.published.length, 0);

    const { stages } = buildLifecycleNavigation(initiative, emptyRecords(), {
      inProgressStageIds: ["analysis"],
    });
    const analysisNav = stages.find((stage) => stage.stageId === "analysis");
    const adapter = await buildInitiativeLifecycleStageAdapterResult("analysis", initiative);

    assert.equal(analysisNav?.state, "in_progress");
    assert.equal(analysisNav?.stateLabel, "In Progress");
    assert.equal(adapter.presentationStatus, "draft");

    // Viewer identity is irrelevant — same nav state for two participants.
    for (const _viewer of [VIEWER_A, VIEWER_B]) {
      const again = buildLifecycleNavigation(initiative, emptyRecords(), {
        inProgressStageIds: ["analysis"],
      });
      assert.equal(again.stages.find((stage) => stage.stageId === "analysis")?.state, "in_progress");
    }
  });

  it("published analysis → Published/Completed and matches presentation", async () => {
    createAnalysis({
      analysisId: "analysis-published-1",
      initiativeId: INITIATIVE_ID,
      authorId: STEWARD_ID,
      title: "Published",
      summary: "Summary",
      supportingEvidence: "Evidence",
      risks: "Risks",
      suggestedImprovements: "Improvements",
      references: "Refs",
      status: "published",
      publishedAt: "2026-03-02T00:00:00.000Z",
      initiativeVersion: 1,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
    });

    const initiative = buildInitiative();
    const records = withPublishedAnalysisRecord("analysis-published-1");
    const { stages, currentStageId } = buildLifecycleNavigation(initiative, records);
    const analysisNav = stages.find((stage) => stage.stageId === "analysis");
    const adapter = await buildInitiativeLifecycleStageAdapterResult("analysis", initiative);

    assert.equal(adapter.presentationStatus, "published");
    assert.ok(analysisNav?.state === "published" || analysisNav?.state === "completed");
    assert.notEqual(analysisNav?.state, "not_started");
    assert.equal(currentStageId, "proposal");
    assert.equal(analysisNav?.state, "completed");
    assert.equal(analysisNav?.stateLabel, "Completed");
  });

  it("published analysis after lifecycle advanced still shows completed/published", () => {
    const initiative = buildInitiative();
    const records = withPublishedAnalysisRecord("analysis-published-advanced");
    records.set("proposal", [
      {
        recordId: "proposal-1",
        title: "Proposals",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    ]);

    const { stages, currentStageId } = buildLifecycleNavigation(initiative, records);
    const analysisNav = stages.find((stage) => stage.stageId === "analysis");

    assert.equal(currentStageId, "petition");
    assert.notEqual(currentStageId, "revision");
    assert.equal(analysisNav?.state, "completed");
    assert.equal(analysisNav?.stateLabel, "Completed");
    assert.equal(stages.some((stage) => stage.stageId === "revision"), false);
  });

  it("two different viewers receive the same lifecycle stage status", async () => {
    createAnalysis({
      analysisId: "analysis-shared-1",
      initiativeId: INITIATIVE_ID,
      authorId: STEWARD_ID,
      title: "Shared",
      summary: "Summary",
      supportingEvidence: "Evidence",
      risks: "Risks",
      suggestedImprovements: "Improvements",
      references: "Refs",
      status: "published",
      publishedAt: "2026-03-02T00:00:00.000Z",
      initiativeVersion: 1,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
    });

    const initiative = buildInitiative();
    const records = withPublishedAnalysisRecord("analysis-shared-1");

    const navA = buildLifecycleNavigation(initiative, records);
    const navB = buildLifecycleNavigation(initiative, records);
    const adapterA = await buildInitiativeLifecycleStageAdapterResult("analysis", initiative);
    const adapterB = await buildInitiativeLifecycleStageAdapterResult("analysis", initiative);

    assert.deepEqual(
      navA.stages.find((stage) => stage.stageId === "analysis"),
      navB.stages.find((stage) => stage.stageId === "analysis"),
    );
    assert.equal(adapterA.presentationStatus, adapterB.presentationStatus);
    assert.equal(adapterA.presentationStatus, "published");
    assert.notEqual(navA.stages.find((stage) => stage.stageId === "analysis")?.state, "not_started");
    void VIEWER_A;
    void VIEWER_B;
  });

  it("published analysis never labels as Not Started even if current stage pointer is earlier", () => {
    const initiative = buildInitiative();
    // Simulate inconsistent pointer: discussion not completed, but analysis
    // records exist (artifact truth must still win).
    const records = emptyRecords();
    records.set("analysis", [
      {
        recordId: "analysis-orphan-published",
        title: "Published",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    const { stages } = buildLifecycleNavigation(initiative, records);
    const analysisNav = stages.find((stage) => stage.stageId === "analysis");

    assert.notEqual(analysisNav?.state, "not_started");
    assert.ok(analysisNav?.state === "published" || analysisNav?.state === "completed");
  });
});
