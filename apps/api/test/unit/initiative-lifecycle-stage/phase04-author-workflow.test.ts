import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getInitiativeAuthorWorkflowStageContract,
  INITIATIVE_AUTHOR_WORKFLOW_MATRIX,
  resolveInitiativeLifecycleState,
} from "@hu/types";

import {
  assertLifecycleTransitionPostcondition,
  resolveNextStageAfterPublish,
} from "../../../src/shared/initiative-lifecycle-stage/initiative-lifecycle-transition.contract.js";
import {
  ensureLazyWorkingArtifact,
} from "../../../src/shared/lifecycle/lazy-stage-initialization.js";
import { resolvePersistenceMode } from "../../../src/config/production-persistence-contract.js";
import { validateInitiativeRevisionDraftForPublication } from "../../../src/modules/initiative-version-revision/initiative-version-revision.validators.js";
import { validateInitiativePetitionDraftForPublication } from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.validators.js";
import {
  clearDiscussionCompletionsForTests,
  getDiscussionCompletionByInitiativeId,
  upsertDiscussionCompletion,
} from "../../../src/modules/initiative-discussion-lifecycle/initiative-discussion-completion.store.js";
import { buildLifecycleNavigation } from "../../../src/modules/initiatives/public-initiative-experience-lifecycle-nav.js";

describe("Lifecycle Finalization Phase 04 — Author workflow contract", () => {
  it("documents every STANDARD registry stage in the Author workflow matrix", () => {
    const stageIds = INITIATIVE_AUTHOR_WORKFLOW_MATRIX.map((entry) => entry.stageId);
    assert.ok(stageIds.includes("discussion"));
    assert.ok(stageIds.includes("revision"));
    assert.ok(stageIds.includes("petition"));
    assert.ok(stageIds.includes("archive"));
    assert.equal(getInitiativeAuthorWorkflowStageContract("discussion")?.supportsPublishOrComplete, true);
    assert.equal(getInitiativeAuthorWorkflowStageContract("discussion")?.requiresPersistedDraft, false);
  });

  it("lazy working-artifact helper is idempotent and does not invent duplicates", () => {
    let creates = 0;
    const first = ensureLazyWorkingArtifact({
      getExisting: () => null,
      create: () => {
        creates += 1;
        return { id: "draft-1" };
      },
    });
    const second = ensureLazyWorkingArtifact({
      getExisting: () => first,
      create: () => {
        creates += 1;
        return { id: "draft-2" };
      },
    });
    assert.equal(first.id, "draft-1");
    assert.equal(second.id, "draft-1");
    assert.equal(creates, 1);
  });

  it("proposal→Petition transition postcondition holds for STANDARD (Revision not on route)", () => {
    assert.equal(resolveNextStageAfterPublish("proposal", "STANDARD"), "petition");
    assert.equal(resolveNextStageAfterPublish("revision", "STANDARD"), null);
    const state = assertLifecycleTransitionPostcondition({
      publishedStageId: "proposal",
      lifecycleProfile: "STANDARD",
      nextStageId: "petition",
      priorPublishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
      },
    });
    assert.equal(state.currentStageId, "petition");
  });

  it("Petition publish unlocks Decision Session for STANDARD", () => {
    const state = assertLifecycleTransitionPostcondition({
      publishedStageId: "petition",
      lifecycleProfile: "STANDARD",
      nextStageId: "decision_session",
      priorPublishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        revision: 1,
      },
    });
    assert.equal(state.currentStageId, "decision_session");
  });

  it("Archive terminal publish has null next stage", () => {
    assert.equal(resolveNextStageAfterPublish("archive", "STANDARD"), null);
    const state = assertLifecycleTransitionPostcondition({
      publishedStageId: "archive",
      lifecycleProfile: "STANDARD",
      nextStageId: null,
      priorPublishedStageCounts: {
        initiative: 1,
        discussion: 1,
        analysis: 1,
        proposal: 1,
        revision: 1,
        petition: 1,
        decision_session: 1,
        collective_decision: 1,
        commitment: 1,
        tracking: 1,
        official_response: 1,
        public_impact: 1,
      },
    });
    assert.equal(state.nextStageId, null);
  });

  it("PUBLIC_CHOICE skips STANDARD stages as NOT_APPLICABLE without requiring artifacts", () => {
    const state = resolveInitiativeLifecycleState({
      lifecycleProfile: "PUBLIC_CHOICE",
      publishedStageCounts: {
        initiative: 1,
        discussion: 1,
      },
    });
    assert.equal(state.currentStageId, "collective_decision");
    assert.ok(state.notApplicableStageIds.includes("analysis"));
    assert.ok(state.notApplicableStageIds.includes("petition"));
  });

  it("selecting completed earlier stages does not regress resolver current", () => {
    const records = new Map([
      ["initiative", [{ recordId: "i1" } as never]],
      ["discussion", [{ recordId: "d1" } as never]],
      ["analysis", [{ recordId: "a1" } as never]],
      ["proposal", [{ recordId: "p1" } as never]],
      ["revision", [{ recordId: "r1" } as never]],
    ]);
    const { currentStageId, stages } = buildLifecycleNavigation(
      {
        initiativeId: "initiative-1",
        status: "revision",
        lifecyclePhase: "projected",
        lifecycleProfile: "STANDARD",
      } as never,
      records,
    );
    assert.equal(currentStageId, "petition");
    assert.notEqual(currentStageId, "revision");
    const analysis = stages.find((stage) => stage.stageId === "analysis");
    assert.equal(analysis?.state, "completed");
    assert.equal(stages.some((stage) => stage.stageId === "revision"), false);
    // DISPLAY-ONLY selection of analysis must not change currentStageId authority.
    assert.equal(currentStageId, "petition");
  });

  it("Revision publish validation requires revisionSummary and allows empty communitySlug", () => {
    assert.throws(
      () =>
        validateInitiativeRevisionDraftForPublication({
          title: "T",
          description: "D",
          revisionSummary: " ",
          metadata: { activityArea: "Technology", communitySlug: "" },
        } as never),
      /Revision summary/i,
    );
    assert.doesNotThrow(() =>
      validateInitiativeRevisionDraftForPublication({
        title: "T",
        description: "D",
        revisionSummary: "Clarified scope.",
        metadata: { activityArea: "Technology", communitySlug: "" },
      } as never),
    );
  });

  it("Petition publish validation requires authored fields + revision reference", () => {
    assert.throws(
      () =>
        validateInitiativePetitionDraftForPublication({
          title: "",
          publicSummary: "s",
          requestStatement: "r",
          expectedOutcome: "e",
          revisionId: "rev-1",
          revisionVersion: 2,
        } as never),
      /title/i,
    );
    assert.throws(
      () =>
        validateInitiativePetitionDraftForPublication({
          title: "Petition",
          publicSummary: "s",
          requestStatement: "r",
          expectedOutcome: "e",
          revisionId: null,
          revisionVersion: null,
        } as never),
      /Revision/i,
    );
  });

  it("Discussion completion marker upsert is idempotent and does not duplicate", () => {
    clearDiscussionCompletionsForTests();
    const first = upsertDiscussionCompletion({
      completionId: "completion-1",
      initiativeId: "initiative-discussion-1",
      completedByParticipantId: "participant-1",
      completedAt: "2026-08-16T00:00:00.000Z",
    });
    const second = upsertDiscussionCompletion({
      completionId: "completion-2",
      initiativeId: "initiative-discussion-1",
      completedByParticipantId: "participant-1",
      completedAt: "2026-08-16T01:00:00.000Z",
    });
    assert.equal(first.completionId, "completion-1");
    assert.equal(second.completionId, "completion-1");
    assert.equal(getDiscussionCompletionByInitiativeId("initiative-discussion-1")?.completionId, "completion-1");
    clearDiscussionCompletionsForTests();
  });

  it("Improvement Proposals stage persistence defaults to durable file outside production", () => {
    const previous = process.env.INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE;
    delete process.env.INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE;
    try {
      assert.equal(
        resolvePersistenceMode("INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE", "file"),
        "file",
      );
    } finally {
      if (previous === undefined) {
        delete process.env.INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE;
      } else {
        process.env.INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE = previous;
      }
    }
  });
});
