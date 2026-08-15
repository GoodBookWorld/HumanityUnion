import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeRevisionEligibleStructuredProposal,
  InitiativeRevisionIntelligenceSnapshot,
} from "@hu/types";

import {
  generateRevisionChanges,
  toRevisionChange,
} from "../../../src/modules/initiative-version-revision/initiative-revision-draft-builder.js";

/**
 * Initiative Lifecycle — Part E, Section 3/4: Intelligent Revision Builder.
 *
 * `generateRevisionChanges` is a pure function — no Mongo, no network, no
 * external AI provider. These tests exercise it directly against
 * hand-built `InitiativeRevisionIntelligenceSnapshot` fixtures, mirroring
 * Part D's `initiative-proposal-draft-builder.test.ts`.
 */

function buildProposal(
  overrides: Partial<InitiativeRevisionEligibleStructuredProposal> = {},
): InitiativeRevisionEligibleStructuredProposal {
  return {
    proposalId: "initiative-structured-proposal-fixture",
    collectionId: "initiative-improvement-proposals-collection-fixture",
    title: "Add a dedicated composting station",
    summary: "Add a dedicated composting station near the entrance.",
    reason: "Repeated Ally requests during Discussion.",
    expectedImprovement: "Reduces contamination in general waste bins.",
    status: "included_in_revision",
    originalAuthorDisplayNames: ["Ally One"],
    relatedDiscussionReferences: "",
    ...overrides,
  };
}

function buildSnapshot(
  eligibleProposals: InitiativeRevisionEligibleStructuredProposal[],
): InitiativeRevisionIntelligenceSnapshot {
  return {
    initiativeId: "draft-builder-fixture",
    generatedAt: new Date().toISOString(),
    currentTitle: "Community Composting Initiative",
    currentDescription: "We want to reduce food waste across the neighborhood.",
    analysisReference: null,
    eligibleProposals,
    referencedProposalIds: [],
    missingReferenceProposalIds: [],
    unresolvedProposalIds: eligibleProposals
      .filter((proposal) => proposal.status === "published")
      .map((proposal) => proposal.proposalId),
    affectedSections: [],
    conflictWarnings: [],
    consistencyChecks: [],
    discussionUrl: "/initiatives/public/draft-builder-fixture#discussion",
    isEmpty: eligibleProposals.length === 0,
  };
}

describe("generateRevisionChanges (Intelligent Revision Builder)", () => {
  it("returns nothing for an empty snapshot", async () => {
    const suggestions = await generateRevisionChanges({
      snapshot: buildSnapshot([]),
      existingReferencedProposalIds: new Set(),
    });

    assert.deepEqual(suggestions, []);
  });

  it("suggests exactly one change per 'included_in_revision' proposal not already referenced", async () => {
    const proposalA = buildProposal({ proposalId: "proposal-a" });
    const proposalB = buildProposal({
      proposalId: "proposal-b",
      summary: "Improve accessibility of the entrance ramp.",
    });

    const suggestions = await generateRevisionChanges({
      snapshot: buildSnapshot([proposalA, proposalB]),
      existingReferencedProposalIds: new Set(),
    });

    assert.equal(suggestions.length, 2);
    assert.deepEqual(
      suggestions.map((item) => item.proposalIds[0]).sort(),
      ["proposal-a", "proposal-b"],
    );
  });

  it("never suggests a change for a still-'published' (not yet curated) proposal — that is an unresolved proposal, not an auto-suggestion", async () => {
    const unresolved = buildProposal({ proposalId: "proposal-unresolved", status: "published" });

    const suggestions = await generateRevisionChanges({
      snapshot: buildSnapshot([unresolved]),
      existingReferencedProposalIds: new Set(),
    });

    assert.deepEqual(suggestions, []);
  });

  it("is enriching, not overwriting: skips any proposal already referenced by an existing change", async () => {
    const proposalA = buildProposal({ proposalId: "proposal-a" });
    const proposalB = buildProposal({ proposalId: "proposal-b" });

    const suggestions = await generateRevisionChanges({
      snapshot: buildSnapshot([proposalA, proposalB]),
      existingReferencedProposalIds: new Set(["proposal-a"]),
    });

    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0]!.proposalIds[0], "proposal-b");
  });

  it("embeds the real current description verbatim as 'before', and appends the suggested addition to build 'after'", async () => {
    const proposal = buildProposal({});
    const snapshot = buildSnapshot([proposal]);

    const suggestions = await generateRevisionChanges({
      snapshot,
      existingReferencedProposalIds: new Set(),
    });

    assert.equal(suggestions[0]!.before, snapshot.currentDescription);
    assert.match(suggestions[0]!.after, new RegExp(snapshot.currentDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(suggestions[0]!.after, /Add a dedicated composting station near the entrance/);
  });

  it("cites the real Proposal title verbatim in the explanation, for traceability", async () => {
    const proposal = buildProposal({ title: "Improve accessibility of the entrance ramp" });

    const suggestions = await generateRevisionChanges({
      snapshot: buildSnapshot([proposal]),
      existingReferencedProposalIds: new Set(),
    });

    assert.match(suggestions[0]!.explanation, /Improve accessibility of the entrance ramp/);
  });

  it("never invents an origin other than the referenced Proposal — proposalIds is always non-empty for a builder suggestion", async () => {
    const proposal = buildProposal({});

    const suggestions = await generateRevisionChanges({
      snapshot: buildSnapshot([proposal]),
      existingReferencedProposalIds: new Set(),
    });

    assert.equal(suggestions[0]!.proposalIds.length > 0, true);
  });

  it("produces a byte-identical set of suggestions for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot([buildProposal({})]);

    const first = await generateRevisionChanges({ snapshot, existingReferencedProposalIds: new Set() });
    const second = await generateRevisionChanges({ snapshot, existingReferencedProposalIds: new Set() });

    assert.deepEqual(second, first);
  });
});

describe("toRevisionChange", () => {
  it("assigns a stable, unique changeId, and always tags the origin as 'proposal' with no Author-originated reason", async () => {
    const proposal = buildProposal({});
    const [item] = await generateRevisionChanges({
      snapshot: buildSnapshot([proposal]),
      existingReferencedProposalIds: new Set(),
    });

    const now = new Date().toISOString();
    const first = toRevisionChange(item!, now);
    const second = toRevisionChange(item!, now);

    assert.equal(first.origin, "proposal");
    assert.equal(first.authorOriginatedReason, null);
    assert.notEqual(first.changeId, second.changeId, "every conversion assigns its own fresh, stable id");
    assert.deepEqual(first.proposalIds, [proposal.proposalId]);
  });
});
