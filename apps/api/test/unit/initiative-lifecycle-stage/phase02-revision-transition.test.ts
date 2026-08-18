import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateInitiativeRevisionDraftForPublication } from "../../../src/modules/initiative-version-revision/initiative-version-revision.validators.js";
import {
  assertLifecycleTransitionPostcondition,
  LIFECYCLE_NEXT_STAGE_CREATION_STRATEGY,
  resolveLifecycleStateAfterStagePublication,
  resolveNextStageAfterPublish,
  summarizeLifecycleTransitionPostcondition,
} from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-transition.contract.js";

describe("Lifecycle Finalization Phase 02 — revision + transition contracts", () => {
  it("accepts revision publish without communitySlug when authored fields are present", () => {
    assert.doesNotThrow(() =>
      validateInitiativeRevisionDraftForPublication({
        title: "Revised title",
        description: "Revised description",
        revisionSummary: "Clarified regional scope.",
        metadata: {
          activityArea: "Technology",
          communitySlug: "",
        },
      } as never),
    );
  });

  it("rejects revision publish when revisionSummary is missing", () => {
    assert.throws(
      () =>
        validateInitiativeRevisionDraftForPublication({
          title: "Revised title",
          description: "Revised description",
          revisionSummary: "   ",
          metadata: {
            activityArea: "Technology",
            communitySlug: "any",
          },
        } as never),
      /Revision summary/i,
    );
  });

  it("documents LAZY next-stage creation strategy (not eager)", () => {
    assert.equal(LIFECYCLE_NEXT_STAGE_CREATION_STRATEGY, "LAZY");
  });

  it("STANDARD Discussion publication → Collaborative Analysis available (resolver postcondition)", () => {
    const state = assertLifecycleTransitionPostcondition({
      publishedStageId: "discussion",
      lifecycleProfile: "STANDARD",
      nextStageId: "analysis",
      priorPublishedStageCounts: { initiative: 1 },
    });
    assert.equal(state.currentStageId, "analysis");
    assert.equal(state.nextStageId, "proposal");
    assert.ok(state.completedStageIds.includes("discussion"));
    assert.ok(state.availableStageIds.includes("analysis"));
    assert.equal(state.stageApplicability.analysis, "CURRENT");
    assert.equal(state.stageApplicability.proposal, "LOCKED");
  });

  it("PUBLIC_CHOICE Discussion publication → Collective Decision available (resolver postcondition)", () => {
    const state = assertLifecycleTransitionPostcondition({
      publishedStageId: "discussion",
      lifecycleProfile: "PUBLIC_CHOICE",
      nextStageId: "collective_decision",
      priorPublishedStageCounts: { initiative: 1 },
    });
    assert.equal(state.currentStageId, "collective_decision");
    assert.equal(state.nextStageId, "archive");
    assert.ok(state.completedStageIds.includes("discussion"));
    assert.ok(state.availableStageIds.includes("collective_decision"));
    assert.equal(state.stageApplicability.analysis, "NOT_APPLICABLE");
  });

  it("STANDARD proposal publication → Petition available (Revision not a route stage)", () => {
    assert.equal(resolveNextStageAfterPublish("proposal", "STANDARD"), "petition");
    const state = resolveLifecycleStateAfterStagePublication({
      lifecycleProfile: "STANDARD",
      publishedStageId: "proposal",
      priorPublishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
      },
    });
    assert.equal(state.currentStageId, "petition");
    assert.equal(state.nextStageId, "decision_session");
    assert.ok(state.completedStageIds.includes("proposal"));
    assert.ok(state.availableStageIds.includes("petition"));
    assert.equal(state.stageApplicability.petition, "CURRENT");
    assert.equal(state.stageApplicability.decision_session, "LOCKED");
    assert.notEqual(state.currentStageId, "revision");
  });

  it("legacy Revision publication counts do not set currentStageId to revision", () => {
    const state = resolveLifecycleStateAfterStagePublication({
      lifecycleProfile: "STANDARD",
      publishedStageId: "revision",
      priorPublishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
      },
    });
    assert.notEqual(state.currentStageId, "revision");
    assert.equal(state.currentStageId, "petition");
    assert.equal(resolveNextStageAfterPublish("revision", "STANDARD"), null);
  });

  it("resolves next stage after publish for STANDARD and PUBLIC_CHOICE", () => {
    assert.equal(resolveNextStageAfterPublish("analysis", "STANDARD"), "proposal");
    assert.equal(
      resolveNextStageAfterPublish("collective_decision", "PUBLIC_CHOICE"),
      "archive",
    );
    assert.equal(resolveNextStageAfterPublish("archive", "STANDARD"), null);
  });

  it("summarizes transition postcondition for observability", () => {
    const summary = summarizeLifecycleTransitionPostcondition({
      initiativeId: "initiative-1",
      publishedStageId: "discussion",
      lifecycleProfile: "STANDARD",
      priorPublishedStageCounts: { initiative: 1 },
    });
    assert.equal(summary.nextStageId, "analysis");
    assert.equal(summary.currentStageId, "analysis");
    assert.match(summary.message, /analysis/i);
  });
});
