import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeImplementationTrackingCandidate,
  InitiativeImplementationTrackingLifecycleDraft,
} from "@hu/types";

import {
  validateInitiativeImplementationTrackingLifecycleDraftForPublication,
  validateSaveInitiativeImplementationTrackingLifecycleDraftInput,
} from "../../../src/modules/initiative-implementation-tracking-lifecycle/initiative-implementation-tracking-lifecycle.validators.js";

function buildCandidate(
  overrides: Partial<InitiativeImplementationTrackingCandidate> = {},
): InitiativeImplementationTrackingCandidate {
  return {
    candidateId: "tracking-candidate-0",
    commitmentId: "commitment-1",
    title: "Pilot in two districts first",
    description: "Ally will pilot the compost hub.",
    approvedAction: "Pilot in two districts first",
    responsibleParticipantId: "ally-1",
    currentStatus: "Preparation",
    progress: 0,
    plannedStartDate: null,
    targetDate: "2026-12-01",
    startedDate: null,
    completedDate: null,
    dependencies: [],
    obstacles: ["Insufficient municipal budget"],
    evidenceReferences: [],
    notes: "",
    ...overrides,
  };
}

function buildDraft(
  overrides: Partial<InitiativeImplementationTrackingLifecycleDraft> = {},
): InitiativeImplementationTrackingLifecycleDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "steward-1",
    title: "Implementation Tracking: Test",
    summary: "The city will fund neighborhood compost hubs.",
    packageId: "commitment-package-1",
    candidates: [buildCandidate()],
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateSaveInitiativeImplementationTrackingLifecycleDraftInput", () => {
  it("rejects a missing body", () => {
    assert.throws(
      () => validateSaveInitiativeImplementationTrackingLifecycleDraftInput(null),
      /required/i,
    );
  });

  it("accepts an empty body — every field is optional for a partial save", () => {
    const input = validateSaveInitiativeImplementationTrackingLifecycleDraftInput({});
    assert.equal(input.title, undefined);
    assert.equal(input.candidates, undefined);
  });

  it("rejects a non-string title", () => {
    assert.throws(
      () => validateSaveInitiativeImplementationTrackingLifecycleDraftInput({ title: 1 }),
      /title/i,
    );
  });

  it("rejects candidates that is not an array", () => {
    assert.throws(
      () => validateSaveInitiativeImplementationTrackingLifecycleDraftInput({ candidates: "nope" }),
      /candidates/i,
    );
  });

  it("rejects a candidate missing a required field", () => {
    assert.throws(
      () =>
        validateSaveInitiativeImplementationTrackingLifecycleDraftInput({
          candidates: [{ candidateId: "tracking-candidate-0", commitmentId: "" }],
        }),
      /title/i,
    );
  });

  it("rejects a candidate with progress outside 0-100", () => {
    assert.throws(
      () =>
        validateSaveInitiativeImplementationTrackingLifecycleDraftInput({
          candidates: [buildCandidate({ progress: 150 })],
        }),
      /progress/i,
    );
  });

  it("accepts a candidate with a null targetDate", () => {
    const input = validateSaveInitiativeImplementationTrackingLifecycleDraftInput({
      candidates: [buildCandidate({ targetDate: null })],
    });
    assert.equal(input.candidates?.[0]?.targetDate, null);
  });

  it("accepts a candidate with progress at the boundaries", () => {
    const input = validateSaveInitiativeImplementationTrackingLifecycleDraftInput({
      candidates: [buildCandidate({ progress: 100 })],
    });
    assert.equal(input.candidates?.[0]?.progress, 100);
  });
});

describe("validateInitiativeImplementationTrackingLifecycleDraftForPublication", () => {
  it("passes for a complete draft with a Commitment Package reference and at least one candidate", () => {
    assert.doesNotThrow(() =>
      validateInitiativeImplementationTrackingLifecycleDraftForPublication(buildDraft()),
    );
  });

  it("rejects an empty title", () => {
    assert.throws(
      () =>
        validateInitiativeImplementationTrackingLifecycleDraftForPublication(
          buildDraft({ title: "  " }),
        ),
      /title/i,
    );
  });

  it("allows publishing without a Commitment Package (zero-commitment Author path)", () => {
    assert.doesNotThrow(() =>
      validateInitiativeImplementationTrackingLifecycleDraftForPublication(
        buildDraft({
          packageId: null,
          candidates: [buildCandidate({ commitmentId: "", responsibleParticipantId: "" })],
        }),
      ),
    );
  });

  it("rejects a draft with no candidates", () => {
    assert.throws(
      () =>
        validateInitiativeImplementationTrackingLifecycleDraftForPublication(
          buildDraft({ candidates: [] }),
        ),
      /milestone/i,
    );
  });

  it("allows a candidate with an empty commitmentId (Author-originated milestone)", () => {
    assert.doesNotThrow(() =>
      validateInitiativeImplementationTrackingLifecycleDraftForPublication(
        buildDraft({ candidates: [buildCandidate({ commitmentId: "" })] }),
      ),
    );
  });
});
