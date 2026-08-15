import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeImplementationCommitmentCandidate,
  InitiativeImplementationCommitmentLifecycleDraft,
} from "@hu/types";

import {
  validateInitiativeImplementationCommitmentLifecycleDraftForPublication,
  validateSaveInitiativeImplementationCommitmentLifecycleDraftInput,
} from "../../../src/modules/initiative-implementation-commitment-lifecycle/initiative-implementation-commitment-lifecycle.validators.js";

function buildCandidate(
  overrides: Partial<InitiativeImplementationCommitmentCandidate> = {},
): InitiativeImplementationCommitmentCandidate {
  return {
    candidateId: "candidate-0",
    approvedAction: "Pilot in two districts first",
    description: "Implement: Pilot in two districts first",
    suggestedResponsibleRole: "Sustainability Office",
    suggestedTimeline: "Q4 2026 rollout",
    priority: "High",
    requiredResources: ["Compost bins"],
    relatedRisks: ["Insufficient municipal budget"],
    references: ["session-1", "Collective Decision decision-1", "Action 1"],
    proposedParticipantId: null,
    status: "draft",
    ...overrides,
  };
}

function buildDraft(
  overrides: Partial<InitiativeImplementationCommitmentLifecycleDraft> = {},
): InitiativeImplementationCommitmentLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "steward-1",
    title: "Implementation Commitments: Test",
    summary: "The city will fund neighborhood compost hubs.",
    decisionId: "decision-1",
    candidates: [buildCandidate()],
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateSaveInitiativeImplementationCommitmentLifecycleDraftInput", () => {
  it("rejects a missing body", () => {
    assert.throws(
      () => validateSaveInitiativeImplementationCommitmentLifecycleDraftInput(null),
      /required/i,
    );
  });

  it("accepts an empty body — every field is optional for a partial save", () => {
    const input = validateSaveInitiativeImplementationCommitmentLifecycleDraftInput({});
    assert.equal(input.title, undefined);
    assert.equal(input.candidates, undefined);
  });

  it("rejects a non-string title", () => {
    assert.throws(
      () => validateSaveInitiativeImplementationCommitmentLifecycleDraftInput({ title: 1 }),
      /title/i,
    );
  });

  it("rejects candidates that is not an array", () => {
    assert.throws(
      () =>
        validateSaveInitiativeImplementationCommitmentLifecycleDraftInput({ candidates: "nope" }),
      /candidates/i,
    );
  });

  it("rejects a candidate missing a required field", () => {
    assert.throws(
      () =>
        validateSaveInitiativeImplementationCommitmentLifecycleDraftInput({
          candidates: [{ candidateId: "candidate-0" }],
        }),
      /approvedAction/i,
    );
  });

  it("accepts a candidate with a null proposedParticipantId", () => {
    const input = validateSaveInitiativeImplementationCommitmentLifecycleDraftInput({
      candidates: [buildCandidate({ proposedParticipantId: null })],
    });
    assert.equal(input.candidates?.[0]?.proposedParticipantId, null);
  });

  it("accepts a candidate with a proposed Participant ID", () => {
    const input = validateSaveInitiativeImplementationCommitmentLifecycleDraftInput({
      candidates: [buildCandidate({ proposedParticipantId: "ally-1" })],
    });
    assert.equal(input.candidates?.[0]?.proposedParticipantId, "ally-1");
  });
});

describe("validateInitiativeImplementationCommitmentLifecycleDraftForPublication", () => {
  it("passes for a complete draft with a Collective Decision reference and at least one candidate", () => {
    assert.doesNotThrow(() =>
      validateInitiativeImplementationCommitmentLifecycleDraftForPublication(buildDraft()),
    );
  });

  it("rejects an empty title", () => {
    assert.throws(
      () =>
        validateInitiativeImplementationCommitmentLifecycleDraftForPublication(
          buildDraft({ title: "  " }),
        ),
      /title/i,
    );
  });

  it("rejects a missing decisionId — the stage's one mandatory source", () => {
    assert.throws(
      () =>
        validateInitiativeImplementationCommitmentLifecycleDraftForPublication(
          buildDraft({ decisionId: null }),
        ),
      /Collective Decision/i,
    );
  });

  it("rejects a draft with no candidates", () => {
    assert.throws(
      () =>
        validateInitiativeImplementationCommitmentLifecycleDraftForPublication(
          buildDraft({ candidates: [] }),
        ),
      /candidate/i,
    );
  });

  it("rejects a candidate with an empty approvedAction", () => {
    assert.throws(
      () =>
        validateInitiativeImplementationCommitmentLifecycleDraftForPublication(
          buildDraft({ candidates: [buildCandidate({ approvedAction: "  " })] }),
        ),
      /Approved Action/i,
    );
  });
});
