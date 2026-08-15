import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeRevisionChange } from "@hu/types";

import {
  validateAddAuthorOriginatedRevisionChangeInput,
  validateInitiativeRevisionChangesForPublication,
  validateSaveInitiativeRevisionChangeInput,
} from "../../../src/modules/initiative-version-revision/initiative-version-revision.validators.js";

/**
 * Initiative Lifecycle — Part E, Section 5: Canonical Traceability.
 *
 * "Every Revision change must reference one or more Proposal IDs OR be
 * explicitly marked as an Author-originated change [with] a reason and
 * explanation." These pure validators are the single enforcement point for
 * that permanent platform rule.
 */

function buildChange(overrides: Partial<InitiativeRevisionChange> = {}): InitiativeRevisionChange {
  const now = new Date().toISOString();
  return {
    changeId: "initiative-revision-change-fixture",
    section: "description",
    sectionLabel: "Description",
    before: "Before text.",
    after: "After text.",
    origin: "proposal",
    proposalIds: ["initiative-structured-proposal-fixture"],
    authorOriginatedReason: null,
    explanation: "Incorporates Improvement Proposal feedback.",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("validateInitiativeRevisionChangesForPublication", () => {
  it("accepts an empty changes array (pre-Part-E free-text-only revisions remain publishable)", () => {
    assert.doesNotThrow(() => validateInitiativeRevisionChangesForPublication([]));
  });

  it("accepts a Proposal-based change with at least one Proposal ID", () => {
    const change = buildChange({ origin: "proposal", proposalIds: ["proposal-1"] });
    assert.doesNotThrow(() => validateInitiativeRevisionChangesForPublication([change]));
  });

  it("rejects a Proposal-based change with zero Proposal IDs, naming the section", () => {
    const change = buildChange({ origin: "proposal", proposalIds: [], sectionLabel: "Description" });
    assert.throws(
      () => validateInitiativeRevisionChangesForPublication([change]),
      /Change "Description" is marked as Proposal-based but references no Proposal ID/,
    );
  });

  it("accepts an Author-originated change with a non-empty reason", () => {
    const change = buildChange({
      origin: "author_originated",
      proposalIds: [],
      authorOriginatedReason: "Clarifies ambiguous wording flagged during Discussion.",
    });
    assert.doesNotThrow(() => validateInitiativeRevisionChangesForPublication([change]));
  });

  it("rejects an Author-originated change with a null reason", () => {
    const change = buildChange({
      origin: "author_originated",
      proposalIds: [],
      authorOriginatedReason: null,
      sectionLabel: "Title",
    });
    assert.throws(
      () => validateInitiativeRevisionChangesForPublication([change]),
      /Author-originated change "Title" requires a reason/,
    );
  });

  it("rejects an Author-originated change with a whitespace-only reason", () => {
    const change = buildChange({
      origin: "author_originated",
      proposalIds: [],
      authorOriginatedReason: "   ",
    });
    assert.throws(() => validateInitiativeRevisionChangesForPublication([change]), /requires a reason/);
  });

  it("checks every change in the list, not just the first", () => {
    const traced = buildChange({ changeId: "change-1", origin: "proposal", proposalIds: ["proposal-1"] });
    const untraced = buildChange({
      changeId: "change-2",
      origin: "author_originated",
      proposalIds: [],
      authorOriginatedReason: null,
    });

    assert.throws(() => validateInitiativeRevisionChangesForPublication([traced, untraced]));
  });
});

describe("validateAddAuthorOriginatedRevisionChangeInput", () => {
  it("accepts a fully-populated Author-originated change request", () => {
    const input = validateAddAuthorOriginatedRevisionChangeInput({
      section: "description",
      after: "Improved description text.",
      reason: "Improves clarity.",
      explanation: "Reworded for readability after Author review.",
    });

    assert.equal(input.section, "description");
    assert.equal(input.after, "Improved description text.");
    assert.equal(input.authorOriginatedReason, "Improves clarity.");
    assert.equal(input.explanation, "Reworded for readability after Author review.");
  });

  it("rejects an invalid section", () => {
    assert.throws(() =>
      validateAddAuthorOriginatedRevisionChangeInput({
        section: "not-a-real-section",
        after: "Text",
        reason: "Reason",
        explanation: "Explanation",
      }),
    );
  });

  it("rejects a missing reason (Author-originated changes always require one)", () => {
    assert.throws(() =>
      validateAddAuthorOriginatedRevisionChangeInput({
        section: "custom",
        after: "Text",
        explanation: "Explanation",
      }),
    );
  });

  it("rejects a missing explanation", () => {
    assert.throws(() =>
      validateAddAuthorOriginatedRevisionChangeInput({
        section: "custom",
        after: "Text",
        reason: "Reason",
      }),
    );
  });

  it("defaults 'before' to an empty string when omitted", () => {
    const input = validateAddAuthorOriginatedRevisionChangeInput({
      section: "custom",
      after: "Text",
      reason: "Reason",
      explanation: "Explanation",
    });

    assert.equal(input.before, "");
  });
});

describe("validateSaveInitiativeRevisionChangeInput", () => {
  it("accepts a partial update touching only 'after'", () => {
    const input = validateSaveInitiativeRevisionChangeInput({ after: "Revised text." });
    assert.equal(input.after, "Revised text.");
    assert.equal(input.explanation, undefined);
  });

  it("accepts an update to the Author-originated reason via 'reason'", () => {
    const input = validateSaveInitiativeRevisionChangeInput({ reason: "Updated justification." });
    assert.equal(input.authorOriginatedReason, "Updated justification.");
  });

  it("returns all-undefined fields for an empty body (no-op update is valid)", () => {
    const input = validateSaveInitiativeRevisionChangeInput({});
    assert.equal(input.before, undefined);
    assert.equal(input.after, undefined);
    assert.equal(input.explanation, undefined);
    assert.equal(input.authorOriginatedReason, undefined);
  });
});
