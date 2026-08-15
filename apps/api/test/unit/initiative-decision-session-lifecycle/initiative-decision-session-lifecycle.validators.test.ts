import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeDecisionSessionDraft } from "@hu/types";

import {
  validateInitiativeDecisionSessionDraftForPublication,
  validateSaveInitiativeDecisionSessionDraftInput,
} from "../../../src/modules/initiative-decision-session-lifecycle/initiative-decision-session-lifecycle.validators.js";

function buildDraft(
  overrides: Partial<InitiativeDecisionSessionDraft> = {},
): InitiativeDecisionSessionDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "steward-1",
    title: "Decision Session: Test",
    decisionQuestion: "Should we proceed?",
    decisionContext: "Based on the published Petition.",
    objectives: ["Prepare Collective Decision"],
    options: ["Approve", "Decline"],
    supportingArguments: ["Petition signatures show interest."],
    risks: ["Resource constraints"],
    dependencies: ["Published Petition"],
    requiredResources: ["Steward facilitation"],
    suggestedTimeline: "Open Collective Decision next week.",
    suggestedParticipants: ["Steward"],
    suggestedResponsibleRoles: ["Steward"],
    unresolvedQuestions: [],
    purpose: "Prepare the Collective Decision.",
    opensAt: "2026-08-10T00:00:00.000Z",
    closesAt: "2026-08-17T00:00:00.000Z",
    petitionId: "petition-1",
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

describe("validateSaveInitiativeDecisionSessionDraftInput", () => {
  it("rejects a missing body", () => {
    assert.throws(() => validateSaveInitiativeDecisionSessionDraftInput(null), /required/i);
  });

  it("accepts an empty body — every field is optional for a partial save", () => {
    const input = validateSaveInitiativeDecisionSessionDraftInput({});
    assert.equal(input.title, undefined);
    assert.equal(input.options, undefined);
  });

  it("rejects a non-string title", () => {
    assert.throws(() => validateSaveInitiativeDecisionSessionDraftInput({ title: 1 }), /title/i);
  });

  it("rejects options that is not an array of strings", () => {
    assert.throws(
      () => validateSaveInitiativeDecisionSessionDraftInput({ options: [1] }),
      /options/i,
    );
  });
});

describe("validateInitiativeDecisionSessionDraftForPublication", () => {
  it("passes for a complete draft with a Petition reference", () => {
    assert.doesNotThrow(() => validateInitiativeDecisionSessionDraftForPublication(buildDraft()));
  });

  it("rejects an empty title", () => {
    assert.throws(
      () => validateInitiativeDecisionSessionDraftForPublication(buildDraft({ title: "  " })),
      /title/i,
    );
  });

  it("rejects an empty decision question", () => {
    assert.throws(
      () =>
        validateInitiativeDecisionSessionDraftForPublication(buildDraft({ decisionQuestion: "" })),
      /question/i,
    );
  });

  it("rejects a draft with no options", () => {
    assert.throws(
      () => validateInitiativeDecisionSessionDraftForPublication(buildDraft({ options: [] })),
      /option/i,
    );
  });

  it("rejects a draft with no Petition reference — the Decision Session's one mandatory source", () => {
    assert.throws(
      () => validateInitiativeDecisionSessionDraftForPublication(buildDraft({ petitionId: null })),
      /Petition/i,
    );
  });
});
