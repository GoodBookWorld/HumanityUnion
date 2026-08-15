import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativePetitionDraft } from "@hu/types";

import {
  validateInitiativePetitionDraftForPublication,
  validateSaveInitiativePetitionDraftInput,
} from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-lifecycle.validators.js";

function buildDraft(overrides: Partial<InitiativePetitionDraft> = {}): InitiativePetitionDraft {
  return {
    draftId: "petition-draft-fixture",
    initiativeId: "initiative-fixture",
    authorId: "member-fixture",
    title: "Petition: Community Composting Initiative",
    publicSummary: "Adds a dedicated composting station near the entrance.",
    requestStatement: "We call on decision-makers to act on this Initiative.",
    expectedOutcome: "Adoption of the changes described in the Revision.",
    supportingContext: "",
    keyArguments: [],
    revisionId: "revision-fixture",
    revisionVersion: 1,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("validateSaveInitiativePetitionDraftInput", () => {
  it("rejects a missing body", () => {
    assert.throws(() => validateSaveInitiativePetitionDraftInput(undefined), /Request body is required/);
  });

  it("accepts an empty body — every field is optional for a partial save", () => {
    assert.deepEqual(validateSaveInitiativePetitionDraftInput({}), {
      title: undefined,
      publicSummary: undefined,
      requestStatement: undefined,
      expectedOutcome: undefined,
      supportingContext: undefined,
      keyArguments: undefined,
    });
  });

  it("rejects a non-string title", () => {
    assert.throws(
      () => validateSaveInitiativePetitionDraftInput({ title: 42 }),
      /Title must be a string/,
    );
  });

  it("rejects keyArguments that is not an array of strings", () => {
    assert.throws(
      () => validateSaveInitiativePetitionDraftInput({ keyArguments: "not-an-array" }),
      /keyArguments must be an array of strings/,
    );
    assert.throws(
      () => validateSaveInitiativePetitionDraftInput({ keyArguments: [1, 2] }),
      /keyArguments must be an array of strings/,
    );
  });

  it("accepts a fully populated, valid body unchanged", () => {
    const input = {
      title: "New Title",
      publicSummary: "New summary",
      requestStatement: "New request",
      expectedOutcome: "New outcome",
      supportingContext: "New context",
      keyArguments: ["Argument one", "Argument two"],
    };

    assert.deepEqual(validateSaveInitiativePetitionDraftInput(input), input);
  });
});

describe("validateInitiativePetitionDraftForPublication", () => {
  it("passes for a complete draft with a Revision reference", () => {
    assert.doesNotThrow(() => validateInitiativePetitionDraftForPublication(buildDraft()));
  });

  it("rejects an empty title", () => {
    assert.throws(
      () => validateInitiativePetitionDraftForPublication(buildDraft({ title: "   " })),
      /Petition title is required/,
    );
  });

  it("rejects an empty public summary", () => {
    assert.throws(
      () => validateInitiativePetitionDraftForPublication(buildDraft({ publicSummary: "" })),
      /Petition public summary is required/,
    );
  });

  it("rejects an empty request statement", () => {
    assert.throws(
      () => validateInitiativePetitionDraftForPublication(buildDraft({ requestStatement: "" })),
      /Petition request statement is required/,
    );
  });

  it("rejects an empty expected outcome", () => {
    assert.throws(
      () => validateInitiativePetitionDraftForPublication(buildDraft({ expectedOutcome: "" })),
      /Petition expected outcome is required/,
    );
  });

  it("rejects a draft with no Revision reference — the Petition's one mandatory source", () => {
    assert.throws(
      () =>
        validateInitiativePetitionDraftForPublication(
          buildDraft({ revisionId: null, revisionVersion: null }),
        ),
      /must reference a Published Revision/,
    );
  });
});
