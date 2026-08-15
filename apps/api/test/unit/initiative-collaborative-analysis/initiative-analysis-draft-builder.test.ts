import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeAnalysisSourceSnapshot } from "@hu/types";

import { generateAnalysisDraft } from "../../../src/modules/initiative-collaborative-analysis/initiative-analysis-draft-builder.js";

/**
 * Initiative Lifecycle — Part B, Section 4/16: Deterministic Draft Builder.
 *
 * `generateAnalysisDraft` is a pure function — no Mongo, no network, no
 * external AI provider. These tests exercise it directly against
 * hand-built `InitiativeAnalysisSourceSnapshot` fixtures, so they run in
 * every `pnpm test` invocation without any database.
 */

const EMPTY_SNAPSHOT: InitiativeAnalysisSourceSnapshot = {
  initiativeId: "draft-builder-empty",
  generatedAt: new Date().toISOString(),
  discussionStatistics: { commentCount: 0, helpfulCount: 0, notHelpfulCount: 0 },
  mostDiscussedTopics: [],
  openQuestions: [],
  repeatedArguments: [],
  repeatedConcerns: [],
  proposalCandidates: [],
  activeAlliesCount: 0,
  readyToCollaborateCount: 0,
  discussionUrl: "/initiatives/public/draft-builder-empty#discussion",
  isEmpty: true,
};

const POPULATED_SNAPSHOT: InitiativeAnalysisSourceSnapshot = {
  initiativeId: "draft-builder-populated",
  generatedAt: new Date().toISOString(),
  discussionStatistics: { commentCount: 5, helpfulCount: 3, notHelpfulCount: 1 },
  mostDiscussedTopics: [{ topic: "composting", mentionCount: 3 }],
  openQuestions: [
    {
      commentId: "comment-q1",
      excerpt: "Have we budgeted for winter maintenance?",
      authorDisplayName: "Ally One",
      discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
    },
  ],
  repeatedArguments: [
    {
      commentId: "comment-a1",
      excerpt: "This plan improves community access.",
      authorDisplayName: "Ally Two",
      discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
      helpfulCount: 3,
    },
  ],
  repeatedConcerns: [
    {
      commentId: "comment-c1",
      excerpt: "Maintenance funding may run short.",
      authorDisplayName: "Ally Three",
      discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
      notHelpfulCount: 1,
    },
  ],
  proposalCandidates: [
    {
      commentId: "comment-p1",
      excerpt: "Add a dedicated composting station.",
      authorDisplayName: "Ally Four",
      discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
      candidateId: "candidate-1",
    },
  ],
  activeAlliesCount: 4,
  readyToCollaborateCount: 2,
  discussionUrl: "/initiatives/public/draft-builder-populated#discussion",
  isEmpty: false,
};

describe("generateAnalysisDraft (Deterministic Draft Builder)", () => {
  describe("empty Source Snapshot", () => {
    it("embeds the real Initiative title in the generated title", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Empty Initiative",
        snapshot: EMPTY_SNAPSHOT,
      });
      assert.equal(draft.title, "Collaborative Analysis: Empty Initiative");
    });

    it("uses honest 'no activity yet' fallbacks for every section, inventing nothing", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Empty Initiative",
        snapshot: EMPTY_SNAPSHOT,
      });

      assert.match(draft.summary, /No Discussion activity/);
      assert.match(draft.supportingEvidence, /No discussion comments have received Helpful reactions/);
      assert.match(draft.risks, /No discussion comments have been identified as concerns/);
      assert.match(draft.openQuestions, /No open questions identified/);
      assert.match(draft.suggestedImprovements, /No repeated discussion themes/);
      assert.match(draft.references, /No proposal-marked discussion contributions/);
    });
  });

  describe("populated Source Snapshot", () => {
    it("reports every collected metric verbatim in the summary, with no invented numbers", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });

      assert.match(draft.summary, /5 discussion comments/);
      assert.match(draft.summary, /3 marked Helpful/);
      assert.match(draft.summary, /1 marked Not Helpful/);
      assert.match(draft.summary, /1 proposal-marked contribution/);
      assert.match(draft.summary, /4 Active Allies/);
      assert.match(draft.summary, /2 participants ready to collaborate/);
    });

    it("cites the real repeated argument verbatim in supportingEvidence", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });

      assert.match(draft.supportingEvidence, /This plan improves community access\./);
      assert.match(draft.supportingEvidence, /Ally Two/);
      assert.match(draft.supportingEvidence, /3 Helpful/);
    });

    it("cites the real repeated concern verbatim in risks", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });

      assert.match(draft.risks, /Maintenance funding may run short\./);
      assert.match(draft.risks, /1 Not Helpful/);
    });

    it("cites the real open question verbatim", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });

      assert.match(draft.openQuestions, /Have we budgeted for winter maintenance\?/);
    });

    it("cites the real most-discussed topic verbatim in suggestedImprovements", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });

      assert.match(draft.suggestedImprovements, /composting/);
      assert.match(draft.suggestedImprovements, /mentioned 3 times/);
    });

    it("cites the real proposal candidate verbatim in references", async () => {
      const draft = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });

      assert.match(draft.references, /Add a dedicated composting station\./);
    });
  });

  describe("determinism", () => {
    it("produces a byte-identical draft for the same snapshot on every call", async () => {
      const first = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });
      const second = await generateAnalysisDraft({
        initiativeTitle: "Community Garden",
        snapshot: POPULATED_SNAPSHOT,
      });

      assert.deepEqual(second, first);
    });
  });
});
