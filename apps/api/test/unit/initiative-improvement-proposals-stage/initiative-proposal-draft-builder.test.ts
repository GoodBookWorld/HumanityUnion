import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeProposalGroup, InitiativeProposalIntelligenceSnapshot } from "@hu/types";

import {
  generateImprovementProposalDrafts,
  toStructuredProposal,
} from "../../../src/modules/initiative-improvement-proposals-stage/initiative-proposal-draft-builder.js";

/**
 * Initiative Lifecycle — Part D, Section 2/4: Deterministic Draft Builder.
 *
 * `generateImprovementProposalDrafts` is a pure function — no Mongo, no
 * network, no external AI provider. These tests exercise it directly
 * against hand-built `InitiativeProposalIntelligenceSnapshot` fixtures.
 */

const DISCUSSION_URL = "/initiatives/public/draft-builder-fixture#discussion";

function buildGroup(overrides: Partial<InitiativeProposalGroup>): InitiativeProposalGroup {
  return {
    groupId: "proposal-group-1",
    representativeExcerpt: "Add a dedicated composting station.",
    category: "General",
    memberCandidateIds: ["candidate-1"],
    memberCount: 1,
    authorDisplayNames: ["Ally One"],
    totalHelpfulCount: 0,
    isDuplicateGroup: false,
    discussionUrl: DISCUSSION_URL,
    ...overrides,
  };
}

function buildSnapshot(groups: InitiativeProposalGroup[]): InitiativeProposalIntelligenceSnapshot {
  return {
    initiativeId: "draft-builder-fixture",
    generatedAt: new Date().toISOString(),
    candidates: groups.flatMap((group) =>
      group.memberCandidateIds.map((candidateId, index) => ({
        candidateId,
        commentId: `comment-${candidateId}`,
        excerpt: index === 0 ? group.representativeExcerpt : `${group.representativeExcerpt} (also)`,
        authorDisplayName: group.authorDisplayNames[index % group.authorDisplayNames.length] ?? "Ally",
        discussionUrl: DISCUSSION_URL,
        helpfulCount: 0,
        notHelpfulCount: 0,
        createdAt: new Date().toISOString(),
      })),
    ),
    groups,
    duplicateGroupCount: groups.filter((group) => group.isDuplicateGroup).length,
    openProposalQuestions: [],
    totalCandidateCount: groups.reduce((sum, group) => sum + group.memberCount, 0),
    analysisReference: null,
    discussionUrl: DISCUSSION_URL,
    isEmpty: groups.length === 0,
  };
}

describe("generateImprovementProposalDrafts (Deterministic Draft Builder)", () => {
  it("returns nothing for an empty snapshot", async () => {
    const drafts = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([]),
      existingGroupIds: new Set(),
    });

    assert.deepEqual(drafts, []);
  });

  it("generates exactly one draft item per group when no proposal already backs it", async () => {
    const groupA = buildGroup({ groupId: "group-a", memberCandidateIds: ["candidate-a"] });
    const groupB = buildGroup({
      groupId: "group-b",
      representativeExcerpt: "Improve accessibility of the entrance ramp.",
      memberCandidateIds: ["candidate-b"],
    });

    const drafts = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([groupA, groupB]),
      existingGroupIds: new Set(),
    });

    assert.equal(drafts.length, 2);
    assert.deepEqual(
      drafts.map((draft) => draft.groupId).sort(),
      ["group-a", "group-b"],
    );
  });

  it("is enriching, not overwriting: skips any group that already has a backing proposal", async () => {
    const groupA = buildGroup({ groupId: "group-a", memberCandidateIds: ["candidate-a"] });
    const groupB = buildGroup({
      groupId: "group-b",
      representativeExcerpt: "Improve accessibility of the entrance ramp.",
      memberCandidateIds: ["candidate-b"],
    });

    const drafts = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([groupA, groupB]),
      existingGroupIds: new Set(["group-a"]),
    });

    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]!.groupId, "group-b");
  });

  it("embeds the real representative excerpt verbatim in the summary and title", async () => {
    const group = buildGroup({ representativeExcerpt: "Add a dedicated composting station near the entrance." });

    const drafts = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([group]),
      existingGroupIds: new Set(),
    });

    assert.equal(drafts[0]!.summary, "Add a dedicated composting station near the entrance.");
    assert.match(drafts[0]!.title, /Add a dedicated composting station near the entrance/);
  });

  it("labels a duplicate group's reason honestly, citing 'repetition suggests shared concern'", async () => {
    const group = buildGroup({
      isDuplicateGroup: true,
      memberCount: 3,
      memberCandidateIds: ["candidate-1", "candidate-2", "candidate-3"],
      authorDisplayNames: ["Ally One", "Ally Two", "Ally Three"],
    });

    const drafts = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([group]),
      existingGroupIds: new Set(),
    });

    assert.match(drafts[0]!.reason, /repetition suggests shared concern/);
    assert.match(drafts[0]!.reason, /3 participants/);
  });

  it("cites the real Helpful-count evidence verbatim in supportingSources", async () => {
    const group = buildGroup({ totalHelpfulCount: 7, memberCount: 2, memberCandidateIds: ["candidate-1", "candidate-2"] });

    const drafts = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([group]),
      existingGroupIds: new Set(),
    });

    assert.match(drafts[0]!.supportingSources, /7 Helpful reaction/);
  });

  it("never invents an accepted/rejected/priority field — only advisory drafting fields exist", async () => {
    const group = buildGroup({});

    const drafts = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([group]),
      existingGroupIds: new Set(),
    });

    const draftKeys = Object.keys(drafts[0]!);
    for (const forbiddenKey of ["accepted", "rejected", "priority", "importance", "status"]) {
      assert.equal(draftKeys.includes(forbiddenKey), false, `draft must never include '${forbiddenKey}'`);
    }
  });

  it("produces a byte-identical set of drafts for the same snapshot on every call", async () => {
    const snapshot = buildSnapshot([buildGroup({})]);

    const first = await generateImprovementProposalDrafts({ snapshot, existingGroupIds: new Set() });
    const second = await generateImprovementProposalDrafts({ snapshot, existingGroupIds: new Set() });

    assert.deepEqual(second, first);
  });
});

describe("toStructuredProposal", () => {
  it("assigns a stable, unique proposalId and starts every proposal as 'draft'", async () => {
    const group = buildGroup({});
    const [item] = await generateImprovementProposalDrafts({
      snapshot: buildSnapshot([group]),
      existingGroupIds: new Set(),
    });

    const now = new Date().toISOString();
    const first = toStructuredProposal(item!, now);
    const second = toStructuredProposal(item!, now);

    assert.equal(first.status, "draft");
    assert.notEqual(first.proposalId, second.proposalId, "every conversion assigns its own fresh, stable id");
    assert.equal(first.groupId, group.groupId);
  });
});
