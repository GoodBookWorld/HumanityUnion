/**
 * Pack 02G Task 08E.8c — Revision derive emits structured Web advisories; API detail stays opaque.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativeRevisionChange,
  InitiativeRevisionIntelligenceSnapshot,
} from "@hu/types";

import { deriveRevisionAiAssistantInsights } from "./derive-revision-ai-assistant-insights";

function change(
  overrides: Partial<InitiativeRevisionChange> & Pick<InitiativeRevisionChange, "changeId">,
): InitiativeRevisionChange {
  return {
    section: "description",
    sectionLabel: "Description",
    before: "before",
    after: "after",
    proposalIds: [],
    origin: "author_originated",
    authorOriginatedReason: "",
    explanation: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function eligible(
  overrides: Partial<InitiativeRevisionIntelligenceSnapshot["eligibleProposals"][number]> & {
    proposalId: string;
    status: "published" | "included_in_revision";
  },
): InitiativeRevisionIntelligenceSnapshot["eligibleProposals"][number] {
  return {
    collectionId: "col-1",
    title: "Proposal",
    summary: "Summary",
    reason: "Reason",
    expectedImprovement: "Improvement",
    originalAuthorDisplayNames: [],
    relatedDiscussionReferences: "",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<InitiativeRevisionIntelligenceSnapshot> = {},
): InitiativeRevisionIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    currentTitle: "Title",
    currentDescription: "Description",
    analysisReference: null,
    eligibleProposals: [],
    referencedProposalIds: [],
    missingReferenceProposalIds: [],
    unresolvedProposalIds: [],
    affectedSections: [],
    conflictWarnings: [],
    consistencyChecks: [],
    discussionUrl: "/initiatives/public/initiative-1#discussion",
    isEmpty: true,
    ...overrides,
  };
}

describe("Pack 02G Task 08E.8c — deriveRevisionAiAssistantInsights structured advisories", () => {
  it("empty sources and no-analysis alignment emit exact codes", () => {
    const insights = deriveRevisionAiAssistantInsights(snapshot(), []);
    assert.equal(insights.sourcesSummary.code, "revision.sources.empty");
    assert.equal(insights.analysisAlignment.code, "revision.alignment.no_analysis");
    assert.equal(insights.unresolvedProposalCount, 0);
    assert.equal(insights.conflictWarnings.length, 0);
    assert.equal(insights.consistencyWarnings.length, 0);
    assert.equal(insights.untracedChanges.length, 0);
  });

  it("populated sources emit summary params and preserve unresolved count", () => {
    const insights = deriveRevisionAiAssistantInsights(
      snapshot({
        isEmpty: false,
        eligibleProposals: [
          eligible({ proposalId: "p1", title: "A", status: "published" }),
          eligible({ proposalId: "p2", title: "B", status: "included_in_revision" }),
        ],
        unresolvedProposalIds: ["p1"],
        missingReferenceProposalIds: ["p2"],
        analysisReference: { analysisId: "a1", title: "Water safety analysis" },
      }),
      [],
    );

    assert.equal(insights.sourcesSummary.code, "revision.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      eligibleCount: 2,
      unresolvedCount: 1,
    });
    assert.equal(insights.unresolvedProposalCount, 1);
    assert.deepEqual(insights.missingReferenceProposalIds, ["p2"]);
    assert.equal(insights.analysisAlignment.code, "revision.alignment.with_analysis");
    assert.equal(insights.analysisAlignment.civic?.title, "Water safety analysis");
  });

  it("passes through API conflictWarnings.message without rewriting", () => {
    const apiMessage =
      "2 changes target the Description section — review before publishing to avoid conflicting edits.";
    const insights = deriveRevisionAiAssistantInsights(
      snapshot({
        conflictWarnings: [
          {
            code: "multiple_changes_same_section",
            params: { changeCount: 2 },
            section: "description",
            sectionLabel: "Description",
            changeIds: ["c1", "c2"],
            proposalIds: ["p1"],
            message: apiMessage,
           },
        ],
        consistencyChecks: [
          {
            checkId: "accepted-proposals-traced",
            label: "Accepted proposals traced into a change",
            status: "warning",
            detail: '1 proposal(s) marked "Included in Revision" have no backing change yet.',
            params: { count: 1 },
          },
        ],
      }),
      [],
    );

    assert.equal(insights.conflictWarnings[0]?.message, apiMessage);
    assert.equal(insights.consistencyWarnings.length, 1);
    assert.equal(
      insights.consistencyWarnings[0]?.detail,
      '1 proposal(s) marked "Included in Revision" have no backing change yet.',
    );
  });

  it("untracedChanges preserve isTracedChange predicate and order", () => {
    const insights = deriveRevisionAiAssistantInsights(snapshot(), [
      change({
        changeId: "traced-proposal",
        proposalIds: ["p1"],
        origin: "proposal",
        authorOriginatedReason: null,
      }),
      change({
        changeId: "traced-author",
        origin: "author_originated",
        authorOriginatedReason: "Manual clarification",
      }),
      change({
        changeId: "untraced",
        sectionLabel: "Timeline",
        origin: "author_originated",
        authorOriginatedReason: "  ",
      }),
    ]);

    assert.deepEqual(
      insights.untracedChanges.map((entry) => entry.changeId),
      ["untraced"],
    );
    assert.equal(insights.untracedChanges[0]?.sectionLabel, "Timeline");
  });

  it("does not emit English advisory sentences as derive contract", () => {
    const insights = deriveRevisionAiAssistantInsights(
      snapshot({
        eligibleProposals: [eligible({ proposalId: "p1", title: "A", status: "published" })],
        unresolvedProposalIds: ["p1"],
      }),
      [],
    );
    const serialized = JSON.stringify(insights);
    assert.doesNotMatch(serialized, /published Improvement Proposal\(s\)/);
    assert.doesNotMatch(serialized, /No published Improvement Proposals collected yet/);
    assert.doesNotMatch(serialized, /Aligned with published Collaborative Analysis/);
  });
});
