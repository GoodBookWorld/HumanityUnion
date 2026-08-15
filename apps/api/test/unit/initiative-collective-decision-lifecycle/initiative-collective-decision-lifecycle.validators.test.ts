import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeCollectiveDecisionLifecycleDraft } from "@hu/types";

import {
  validateInitiativeCollectiveDecisionLifecycleDraftForPublication,
  validateSaveInitiativeCollectiveDecisionLifecycleDraftInput,
} from "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-lifecycle.validators.js";

function buildDraft(
  overrides: Partial<InitiativeCollectiveDecisionLifecycleDraft> = {},
): InitiativeCollectiveDecisionLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "steward-1",
    title: "Collective Decision: Test",
    decisionSummary: "Should we proceed?",
    approvedActions: ["Pilot in two districts first"],
    rejectedAlternatives: ["Fund citywide rollout"],
    responsibleRoles: ["Sustainability Office"],
    implementationPriorities: ["Expand compost access"],
    implementationTimeline: "Q4 2026 rollout",
    decisionRationale: "Based on the published Decision Session.",
    decisionRisks: ["Insufficient municipal budget"],
    successCriteria: ["Success when: Expand compost access"],
    requiredResources: ["Compost bins"],
    supportingReferences: ["session-1"],
    participationScope: "community",
    closesAt: "2099-08-17T00:00:00.000Z",
    decisionSessionId: "session-1",
    decisionSessionVersion: 1,
    petitionId: "petition-1",
    petitionVersion: 1,
    revisionId: "revision-1",
    revisionVersion: 2,
    analysisId: "analysis-1",
    analysisVersion: 1,
    proposalIds: ["proposal-1"],
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateSaveInitiativeCollectiveDecisionLifecycleDraftInput", () => {
  it("rejects a missing body", () => {
    assert.throws(
      () => validateSaveInitiativeCollectiveDecisionLifecycleDraftInput(null),
      /required/i,
    );
  });

  it("accepts an empty body — every field is optional for a partial save", () => {
    const input = validateSaveInitiativeCollectiveDecisionLifecycleDraftInput({});
    assert.equal(input.title, undefined);
    assert.equal(input.approvedActions, undefined);
  });

  it("rejects a non-string title", () => {
    assert.throws(
      () => validateSaveInitiativeCollectiveDecisionLifecycleDraftInput({ title: 1 }),
      /title/i,
    );
  });

  it("rejects approvedActions that is not an array of strings", () => {
    assert.throws(
      () => validateSaveInitiativeCollectiveDecisionLifecycleDraftInput({ approvedActions: [1] }),
      /approvedActions/i,
    );
  });

  it("rejects an invalid participationScope", () => {
    assert.throws(
      () =>
        validateSaveInitiativeCollectiveDecisionLifecycleDraftInput({
          participationScope: "planet",
        }),
      /participationScope/i,
    );
  });
});

describe("validateInitiativeCollectiveDecisionLifecycleDraftForPublication", () => {
  it("passes for a complete draft with a Decision Session reference and future closing date", () => {
    assert.doesNotThrow(() =>
      validateInitiativeCollectiveDecisionLifecycleDraftForPublication(buildDraft()),
    );
  });

  it("rejects an empty title", () => {
    assert.throws(
      () =>
        validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
          buildDraft({ title: "  " }),
        ),
      /title/i,
    );
  });

  it("rejects an empty decision summary", () => {
    assert.throws(
      () =>
        validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
          buildDraft({ decisionSummary: "" }),
        ),
      /summary/i,
    );
  });

  it("rejects a draft with no approved actions", () => {
    assert.throws(
      () =>
        validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
          buildDraft({ approvedActions: [] }),
        ),
      /approved action/i,
    );
  });

  it("rejects a draft with no Decision Session reference — the Collective Decision's one mandatory source", () => {
    assert.throws(
      () =>
        validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
          buildDraft({ decisionSessionId: null }),
        ),
      /Decision Session/i,
    );
  });

  it("rejects a missing closing date", () => {
    assert.throws(
      () =>
        validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
          buildDraft({ closesAt: "" }),
        ),
      /closing date/i,
    );
  });

  it("rejects a closing date in the past", () => {
    assert.throws(
      () =>
        validateInitiativeCollectiveDecisionLifecycleDraftForPublication(
          buildDraft({ closesAt: "2020-01-01T00:00:00.000Z" }),
        ),
      /future/i,
    );
  });
});
