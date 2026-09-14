/**
 * Pack 02G Task 08E.8b — Proposal derive emits structured advisories (not English prose).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeProposalGroup,
  InitiativeProposalIntelligenceSnapshot,
  InitiativeStructuredProposal,
} from "@hu/types";

import { deriveProposalAiAssistantInsights } from "./derive-proposal-ai-assistant-insights";

function group(
  overrides: Partial<InitiativeProposalGroup> & Pick<InitiativeProposalGroup, "groupId">,
): InitiativeProposalGroup {
  return {
    representativeExcerpt: "Fund public filters",
    category: "Funding",
    memberCandidateIds: ["cand-1"],
    memberCount: 1,
    authorDisplayNames: ["A"],
    totalHelpfulCount: 1,
    isDuplicateGroup: false,
    discussionUrl: "#g",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<InitiativeProposalIntelligenceSnapshot> = {},
): InitiativeProposalIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    candidates: [],
    groups: [],
    duplicateGroupCount: 0,
    openProposalQuestions: [],
    totalCandidateCount: 0,
    analysisReference: null,
    discussionUrl: "/initiatives/public/initiative-1#discussion",
    isEmpty: true,
    ...overrides,
  };
}

function proposal(
  overrides: Partial<InitiativeStructuredProposal> &
    Pick<InitiativeStructuredProposal, "proposalId">,
): InitiativeStructuredProposal {
  return {
    title: "",
    summary: "",
    description: "",
    reason: "",
    expectedImprovement: "",
    supportingSources: "",
    relatedDiscussionReferences: "",
    originalAuthorDisplayNames: [],
    sourceCommentIds: [],
    groupId: null,
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Pack 02G Task 08E.8b — deriveProposalAiAssistantInsights structured advisories", () => {
  it("empty sources emit proposal.sources.empty", () => {
    const insights = deriveProposalAiAssistantInsights(snapshot(), []);
    assert.equal(insights.sourcesSummary.code, "proposal.sources.empty");
    assert.equal(insights.duplicateGroups.length, 0);
    assert.equal(insights.ungroupedCandidateGroups.length, 0);
    assert.equal(insights.incompleteProposals.length, 0);
    assert.equal(insights.openProposalQuestionCount, 0);
    assert.equal(insights.suggestedTreatments.length, 0);
    assert.equal(insights.neverPublishesAutomatically, true);
  });

  it("populated sources emit summary params with exact counts", () => {
    const insights = deriveProposalAiAssistantInsights(
      snapshot({
        isEmpty: false,
        totalCandidateCount: 3,
        duplicateGroupCount: 1,
        groups: [
          group({ groupId: "g1", memberCount: 2, isDuplicateGroup: true }),
          group({ groupId: "g2", representativeExcerpt: "Timeline" }),
        ],
        openProposalQuestions: [
          {
            candidateId: "q1",
            commentId: "c1",
            excerpt: "Who pays?",
            authorDisplayName: "A",
            discussionUrl: "#c1",
            helpfulCount: 0,
            notHelpfulCount: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
      [],
    );

    assert.equal(insights.sourcesSummary.code, "proposal.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      candidateCount: 3,
      groupCount: 2,
      duplicateGroupCount: 1,
    });
    assert.equal(insights.duplicateGroups.length, 1);
    assert.equal(insights.ungroupedCandidateGroups.length, 2);
    assert.equal(insights.openProposalQuestionCount, 1);
  });

  it("missingFields are canonical IDs preserving detection order", () => {
    const draft = proposal({ proposalId: "p1", title: "  ", summary: "Has summary" });
    const insights = deriveProposalAiAssistantInsights(snapshot(), [draft]);
    assert.equal(insights.incompleteProposals.length, 1);
    assert.deepEqual(insights.incompleteProposals[0]?.missingFields, [
      "title",
      "description",
      "reason",
      "expectedImprovement",
    ]);
    assert.doesNotMatch(insights.incompleteProposals[0]!.missingFields.join("|"), /Title|Summary/);
  });

  it("ungrouped vs drafted groups preserve groupId backing predicate", () => {
    const insights = deriveProposalAiAssistantInsights(
      snapshot({
        totalCandidateCount: 2,
        groups: [group({ groupId: "g1" }), group({ groupId: "g2" })],
      }),
      [proposal({ proposalId: "p1", groupId: "g1", title: "T", summary: "S", description: "D", reason: "R".repeat(25), expectedImprovement: "E".repeat(45) })],
    );
    assert.deepEqual(
      insights.ungroupedCandidateGroups.map((g) => g.groupId),
      ["g2"],
    );
  });

  it("treatment suggestions preserve codes and rationale descriptors", () => {
    const incomplete = proposal({ proposalId: "p-incomplete" });
    const accept = proposal({
      proposalId: "p-accept",
      title: "Install filters",
      summary: "Public filters",
      description: "Install at transit hubs",
      reason: "Community needs safer water access now",
      expectedImprovement: "Fewer waterborne incidents near transit hubs yearly",
    });
    // Complete required fields, but below accept thresholds → partially_accept.
    const partial = proposal({
      proposalId: "p-partial",
      title: "Signage",
      summary: "Add signs",
      description: "Wayfinding",
      reason: "People get lost",
      expectedImprovement: "Better navigation",
    });

    const insights = deriveProposalAiAssistantInsights(snapshot(), [
      incomplete,
      accept,
      partial,
    ]);

    assert.deepEqual(
      insights.suggestedTreatments.map((entry) => ({
        id: entry.proposalId,
        suggestion: entry.suggestion,
        code: entry.rationale.code,
      })),
      [
        {
          id: "p-incomplete",
          suggestion: "review",
          code: "proposal.treatment.rationale.review_incomplete",
        },
        {
          id: "p-accept",
          suggestion: "accept",
          code: "proposal.treatment.rationale.accept_clear",
        },
        {
          id: "p-partial",
          suggestion: "partially_accept",
          code: "proposal.treatment.rationale.partially_accept_limited",
        },
      ],
    );

    assert.deepEqual(insights.suggestedTreatments[0]?.rationale.civic?.fieldIds, [
      "title",
      "summary",
      "description",
      "reason",
      "expectedImprovement",
    ]);
    assert.equal(insights.suggestedTreatments[1]?.title, "Install filters");
  });

  it("decline rationale code remains in derive contract (legacy fall-through)", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, join } = await import("node:path");
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "derive-proposal-ai-assistant-insights.ts"),
      "utf8",
    );
    assert.match(source, /proposal\.treatment\.rationale\.decline_limited/);
    assert.match(source, /suggestion:\s*"decline"/);
  });

  it("decided statuses are excluded from suggested treatments", () => {
    const insights = deriveProposalAiAssistantInsights(snapshot(), [
      proposal({
        proposalId: "p-done",
        status: "included_in_revision",
        title: "Done",
        summary: "S",
        description: "D",
        reason: "Community needs safer water access now",
        expectedImprovement: "Fewer waterborne incidents near transit hubs yearly",
      }),
    ]);
    assert.equal(insights.suggestedTreatments.length, 0);
  });

  it("does not emit English advisory sentences or next-intl", () => {
    const insights = deriveProposalAiAssistantInsights(
      snapshot({ totalCandidateCount: 1, groups: [group({ groupId: "g1" })] }),
      [proposal({ proposalId: "p1" })],
    );
    const serialized = JSON.stringify(insights);
    assert.doesNotMatch(serialized, /No proposal-marked comments collected yet/);
    assert.doesNotMatch(serialized, /Complete missing fields before deciding/);
    assert.doesNotMatch(serialized, /Clear reason and expected improvement/);
    assert.doesNotMatch(serialized, /proposal-marked comment\(s\)/);
    assert.doesNotMatch(serialized, /"Title"/);
  });
});
