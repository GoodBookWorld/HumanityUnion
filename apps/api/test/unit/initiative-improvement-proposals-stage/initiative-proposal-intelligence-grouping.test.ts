import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeProposalCandidateRef } from "@hu/types";

import { buildProposalGroupsFromCandidates } from "../../../src/modules/initiative-improvement-proposals-stage/initiative-proposal-intelligence.service.js";

/**
 * Initiative Lifecycle — Part D, Section 2/3: deterministic Automatic
 * Proposal Collection / Proposal Intelligence grouping. `buildGroups` is a
 * pure function (Jaccard keyword-overlap clustering, never AI) — these
 * tests exercise it directly against hand-built candidate fixtures, so
 * they run in every `pnpm test` invocation without any database.
 */

const DISCUSSION_URL = "/initiatives/public/grouping-fixture#discussion";

function candidate(overrides: Partial<InitiativeProposalCandidateRef>): InitiativeProposalCandidateRef {
  return {
    candidateId: "candidate-default",
    commentId: "comment-default",
    excerpt: "Add a dedicated composting station near the entrance.",
    authorDisplayName: "Ally One",
    discussionUrl: DISCUSSION_URL,
    helpfulCount: 0,
    notHelpfulCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildProposalGroupsFromCandidates (deterministic grouping / duplicate detection)", () => {
  it("returns no groups for an empty candidate list", () => {
    const groups = buildProposalGroupsFromCandidates([], DISCUSSION_URL);
    assert.deepEqual(groups, []);
  });

  it("clusters two similarly-worded candidates into one duplicate group", () => {
    const groups = buildProposalGroupsFromCandidates(
      [
        candidate({
          candidateId: "candidate-1",
          commentId: "comment-1",
          excerpt: "Please add a dedicated composting station for the community garden.",
          authorDisplayName: "Ally One",
          helpfulCount: 3,
        }),
        candidate({
          candidateId: "candidate-2",
          commentId: "comment-2",
          excerpt: "We should add a dedicated composting station in the community garden.",
          authorDisplayName: "Ally Two",
          helpfulCount: 2,
        }),
      ],
      DISCUSSION_URL,
    );

    assert.equal(groups.length, 1, "near-identical wording must cluster into a single group");
    assert.equal(groups[0]!.isDuplicateGroup, true);
    assert.equal(groups[0]!.memberCount, 2);
    assert.equal(groups[0]!.totalHelpfulCount, 5, "Evidence: Helpful counts sum across every member");
    assert.deepEqual(
      [...groups[0]!.authorDisplayNames].sort(),
      ["Ally One", "Ally Two"],
      "Authors: every distinct contributing author is listed",
    );
  });

  it("keeps unrelated candidates in separate, non-duplicate groups", () => {
    const groups = buildProposalGroupsFromCandidates(
      [
        candidate({
          candidateId: "candidate-1",
          commentId: "comment-1",
          excerpt: "Please add a dedicated composting station for the community garden.",
        }),
        candidate({
          candidateId: "candidate-2",
          commentId: "comment-2",
          excerpt: "We need more streetlights installed along the walking path at night.",
        }),
      ],
      DISCUSSION_URL,
    );

    assert.equal(groups.length, 2, "unrelated wording must not cluster together");
    assert.equal(groups.every((group) => !group.isDuplicateGroup), true);
    assert.equal(groups.every((group) => group.memberCount === 1), true);
  });

  it("classifies a funding-related group into the Funding category deterministically", () => {
    const groups = buildProposalGroupsFromCandidates(
      [
        candidate({
          candidateId: "candidate-1",
          commentId: "comment-1",
          excerpt: "We need additional funding and budget allocated for this initiative.",
        }),
      ],
      DISCUSSION_URL,
    );

    assert.equal(groups[0]!.category, "Funding");
  });

  it("falls back to the General category when no keyword bucket matches", () => {
    const groups = buildProposalGroupsFromCandidates(
      [
        candidate({
          candidateId: "candidate-1",
          commentId: "comment-1",
          excerpt: "Paint the fence a brighter color please.",
        }),
      ],
      DISCUSSION_URL,
    );

    assert.equal(groups[0]!.category, "General");
  });

  it("produces byte-identical groups for the same candidate list on every call", () => {
    const candidates = [
      candidate({ candidateId: "candidate-1", commentId: "comment-1" }),
      candidate({
        candidateId: "candidate-2",
        commentId: "comment-2",
        excerpt: "We need more streetlights installed along the walking path at night.",
      }),
    ];

    const first = buildProposalGroupsFromCandidates(candidates, DISCUSSION_URL);
    const second = buildProposalGroupsFromCandidates(candidates, DISCUSSION_URL);

    assert.deepEqual(second, first);
  });
});
