import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeStructuredProposal, InitiativeStructuredProposalStatus } from "@hu/types";

import {
  assertProposalStatusTransitionAllowed,
  validateInitiativeStructuredProposalForPublication,
} from "../../../src/modules/initiative-improvement-proposals-stage/initiative-improvement-proposals-stage.validators.js";

/**
 * Initiative Lifecycle — Part D, Section 6/7 (Proposal Editor / Proposal
 * Traceability). These pure validator functions enforce the permanent
 * platform rule that a proposal's status lifecycle is asymmetric around
 * publication: freely toggled pre-publication, curation-only after.
 */

function buildProposal(overrides: Partial<InitiativeStructuredProposal> = {}): InitiativeStructuredProposal {
  return {
    proposalId: "initiative-structured-proposal-fixture",
    title: "Add a dedicated composting station",
    summary: "Summary",
    description: "Description",
    reason: "Reason",
    expectedImprovement: "Expected improvement",
    supportingSources: "",
    relatedDiscussionReferences: "",
    originalAuthorDisplayNames: ["Ally One"],
    sourceCommentIds: ["comment-1"],
    groupId: "group-1",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("assertProposalStatusTransitionAllowed", () => {
  describe("pre-publication (collection status 'draft')", () => {
    it("allows draft -> ready", () => {
      const proposal = buildProposal({ status: "draft" });
      assert.doesNotThrow(() => assertProposalStatusTransitionAllowed(proposal, "draft", "ready"));
    });

    it("allows ready -> draft", () => {
      const proposal = buildProposal({ status: "ready" });
      assert.doesNotThrow(() => assertProposalStatusTransitionAllowed(proposal, "draft", "draft"));
    });

    it("rejects setting 'published' directly (only the collection-level Publish action may do this)", () => {
      const proposal = buildProposal({ status: "ready" });
      assert.throws(() => assertProposalStatusTransitionAllowed(proposal, "draft", "published"));
    });

    it("rejects setting a post-publication curation status before publishing", () => {
      const proposal = buildProposal({ status: "ready" });
      assert.throws(() =>
        assertProposalStatusTransitionAllowed(proposal, "draft", "included_in_revision"),
      );
    });
  });

  describe("post-publication (collection status 'published')", () => {
    const curationStatuses: InitiativeStructuredProposalStatus[] = [
      "included_in_revision",
      "keep_for_later",
      "not_applicable",
    ];

    for (const nextStatus of curationStatuses) {
      it(`allows published -> ${nextStatus} (Author-only curation decision)`, () => {
        const proposal = buildProposal({ status: "published" });
        assert.doesNotThrow(() => assertProposalStatusTransitionAllowed(proposal, "published", nextStatus));
      });
    }

    it("allows moving between two curation statuses", () => {
      const proposal = buildProposal({ status: "included_in_revision" });
      assert.doesNotThrow(() =>
        assertProposalStatusTransitionAllowed(proposal, "published", "keep_for_later"),
      );
    });

    it("never allows reverting a published proposal back to 'draft'", () => {
      const proposal = buildProposal({ status: "published" });
      assert.throws(() => assertProposalStatusTransitionAllowed(proposal, "published", "draft"));
    });

    it("never allows reverting a published proposal back to 'ready'", () => {
      const proposal = buildProposal({ status: "published" });
      assert.throws(() => assertProposalStatusTransitionAllowed(proposal, "published", "ready"));
    });

    it("never allows setting 'published' again by hand", () => {
      const proposal = buildProposal({ status: "included_in_revision" });
      assert.throws(() => assertProposalStatusTransitionAllowed(proposal, "published", "published"));
    });
  });

  describe("archived collection", () => {
    it("rejects every status change once the collection is archived", () => {
      const proposal = buildProposal({ status: "published" });
      assert.throws(() =>
        assertProposalStatusTransitionAllowed(proposal, "archived", "included_in_revision"),
      );
    });
  });
});

describe("validateInitiativeStructuredProposalForPublication", () => {
  it("accepts a fully-populated proposal", () => {
    assert.doesNotThrow(() => validateInitiativeStructuredProposalForPublication(buildProposal()));
  });

  it("rejects a proposal missing a required field, naming both the field and the proposal", () => {
    const proposal = buildProposal({ title: "My Proposal", expectedImprovement: "" });
    assert.throws(
      () => validateInitiativeStructuredProposalForPublication(proposal),
      /Expected Improvement is required to publish "My Proposal"/,
    );
  });

  it("rejects a whitespace-only required field", () => {
    const proposal = buildProposal({ reason: "   " });
    assert.throws(() => validateInitiativeStructuredProposalForPublication(proposal), /Reason is required/);
  });
});
