/**
 * Pack 02G Task 08E.8a — Analysis derive emits structured advisories (not English prose).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativeAnalysisSourceSnapshot } from "@hu/types";

import { deriveAiAssistantInsights } from "./derive-ai-assistant-insights";

function snapshot(
  overrides: Partial<InitiativeAnalysisSourceSnapshot> = {},
): InitiativeAnalysisSourceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    discussionStatistics: { commentCount: 0, helpfulCount: 0, notHelpfulCount: 0 },
    mostDiscussedTopics: [],
    openQuestions: [],
    repeatedArguments: [],
    repeatedConcerns: [],
    proposalCandidates: [],
    activeAlliesCount: 0,
    readyToCollaborateCount: 0,
    discussionUrl: "/initiatives/public/initiative-1#discussion",
    isEmpty: true,
    ...overrides,
  };
}

describe("Pack 02G Task 08E.8a — deriveAiAssistantInsights structured advisories", () => {
  it("empty discussion yields sources.empty and all four missing-evidence codes in order", () => {
    const insights = deriveAiAssistantInsights(snapshot());
    assert.equal(insights.sourcesSummary.code, "analysis.sources.empty");
    assert.deepEqual(
      insights.missingEvidence.map((item) => item.code),
      [
        "analysis.missing_helpful_sources",
        "analysis.missing_not_helpful_sources",
        "analysis.missing_proposal_candidates",
        "analysis.missing_open_questions",
      ],
    );
    assert.equal(insights.proposalCoverage.percentage, 0);
    assert.equal(insights.proposalCoverage.commentCount, 0);
    assert.equal(insights.proposalCoverage.proposalCount, 0);
  });

  it("populated sources emit sources.summary with count params; coverage math unchanged", () => {
    const insights = deriveAiAssistantInsights(
      snapshot({
        isEmpty: false,
        discussionStatistics: { commentCount: 10, helpfulCount: 3, notHelpfulCount: 1 },
        repeatedArguments: [
          {
            commentId: "c1",
            excerpt: "Water safety matters for transit hubs",
            authorDisplayName: "A",
            discussionUrl: "#c1",
            helpfulCount: 4,
          },
        ],
        repeatedConcerns: [
          {
            commentId: "c2",
            excerpt: "Cost of water filters is too high",
            authorDisplayName: "B",
            discussionUrl: "#c2",
            notHelpfulCount: 2,
          },
        ],
        proposalCandidates: [
          {
            commentId: "c3",
            excerpt: "Fund public filters",
            authorDisplayName: "C",
            discussionUrl: "#c3",
            candidateId: "cand-1",
          },
        ],
        openQuestions: [
          {
            commentId: "c4",
            excerpt: "Who maintains filters?",
            authorDisplayName: "D",
            discussionUrl: "#c4",
          },
        ],
        activeAlliesCount: 2,
        readyToCollaborateCount: 1,
      }),
    );

    assert.equal(insights.sourcesSummary.code, "analysis.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      commentCount: 10,
      proposalCount: 1,
      activeAlliesCount: 2,
      readyToCollaborateCount: 1,
    });
    assert.equal(insights.missingEvidence.length, 0);
    assert.equal(insights.proposalCoverage.proposalCount, 1);
    assert.equal(insights.proposalCoverage.commentCount, 10);
    assert.equal(insights.proposalCoverage.percentage, 10);
    assert.equal(insights.repeatedArguments[0]?.excerpt, "Water safety matters for transit hubs");
    assert.equal(insights.unansweredQuestions[0]?.excerpt, "Who maintains filters?");
  });

  it("contradiction keeps civic topic on advisory and preserves argument/concern refs", () => {
    const insights = deriveAiAssistantInsights(
      snapshot({
        isEmpty: false,
        discussionStatistics: { commentCount: 4, helpfulCount: 2, notHelpfulCount: 2 },
        mostDiscussedTopics: [{ topic: "water safety", mentionCount: 5 }],
        repeatedArguments: [
          {
            commentId: "a1",
            excerpt: "We need water safety near schools",
            authorDisplayName: "A",
            discussionUrl: "#a1",
            helpfulCount: 3,
          },
        ],
        repeatedConcerns: [
          {
            commentId: "n1",
            excerpt: "water safety funding is unclear",
            authorDisplayName: "B",
            discussionUrl: "#n1",
            notHelpfulCount: 2,
          },
        ],
        proposalCandidates: [
          {
            commentId: "p1",
            excerpt: "Install filters",
            authorDisplayName: "C",
            discussionUrl: "#p1",
            candidateId: "cand-1",
          },
        ],
        openQuestions: [
          {
            commentId: "q1",
            excerpt: "Timeline?",
            authorDisplayName: "D",
            discussionUrl: "#q1",
          },
        ],
      }),
    );

    assert.equal(insights.possibleContradictions.length, 1);
    const row = insights.possibleContradictions[0]!;
    assert.equal(row.advisory.code, "analysis.text_overlap_contradiction");
    assert.equal(row.advisory.civic?.subject, "water safety");
    assert.equal(row.argument.commentId, "a1");
    assert.equal(row.concern.commentId, "n1");
  });

  it("emits no English advisory sentence literals", () => {
    const source = deriveAiAssistantInsights.toString();
    // Function body is not available via toString for imports; assert on module file via return values.
    const insights = deriveAiAssistantInsights(snapshot());
    for (const item of [insights.sourcesSummary, ...insights.missingEvidence]) {
      assert.match(item.code, /^analysis\./);
      assert.equal(typeof item.code, "string");
    }
    assert.doesNotMatch(JSON.stringify(insights.sourcesSummary), /No sources collected yet/);
    assert.doesNotMatch(JSON.stringify(insights.missingEvidence), /Helpful-marked/);
  });
});
