/**
 * Pack 02G Task 08E.8c — Petition derive emits structured Web advisories; API detail stays opaque.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  InitiativePetitionDraft,
  InitiativePetitionIntelligenceSnapshot,
} from "@hu/types";

import { derivePetitionAiAssistantInsights } from "./derive-petition-ai-assistant-insights";

function snapshot(
  overrides: Partial<InitiativePetitionIntelligenceSnapshot> = {},
): InitiativePetitionIntelligenceSnapshot {
  return {
    initiativeId: "initiative-1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    initiativeTitle: "Initiative",
    initiativeDescription: "Description",
    revisionReference: null,
    analysisReference: null,
    proposalReferences: [],
    consistencyChecks: [],
    isRevisionAvailable: false,
    isEmpty: true,
    ...overrides,
  };
}

function draft(
  overrides: Partial<InitiativePetitionDraft> = {},
): InitiativePetitionDraft {
  return {
    draftId: "draft-1",
    initiativeId: "initiative-1",
    authorId: "member-1",
    title: "Petition title",
    publicSummary: "Public summary",
    requestStatement: "We ask the city to fund public water filters at transit hubs now",
    expectedOutcome: "Safer water access",
    supportingContext: "Community reports",
    keyArguments: ["Public health"],
    revisionId: "rev-1",
    revisionVersion: 1,
    analysisId: null,
    analysisVersion: null,
    proposalIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Pack 02G Task 08E.8c — derivePetitionAiAssistantInsights structured advisories", () => {
  it("empty sources and no-analysis alignment emit exact codes", () => {
    const insights = derivePetitionAiAssistantInsights(snapshot(), null);
    assert.equal(insights.sourcesSummary.code, "petition.sources.empty");
    assert.equal(insights.analysisAlignment.code, "petition.alignment.no_analysis");
    assert.equal(insights.clarityWarnings.length, 0);
    assert.equal(insights.missingContextWarnings.length, 0);
  });

  it("populated sources emit version/proposalCount params", () => {
    const insights = derivePetitionAiAssistantInsights(
      snapshot({
        isEmpty: false,
        isRevisionAvailable: true,
        revisionReference: {
          revisionId: "rev-1",
          version: 3,
          revisionSummary: "Summary",
          publishedAt: "2026-01-01T00:00:00.000Z",
          title: "Rev title",
          description: "Rev description",
        },
        proposalReferences: [
          {
            proposalId: "p1",
            title: "Filters",
            summary: "S",
            status: "accepted",
          },
        ],
        analysisReference: {
          analysisId: "a1",
          title: "Analysis title XYZ",
          summary: "S",
          initiativeVersion: 1,
        },
      }),
      draft(),
    );

    assert.equal(insights.sourcesSummary.code, "petition.sources.summary");
    assert.deepEqual(insights.sourcesSummary.params, {
      version: 3,
      proposalCount: 1,
    });
    assert.equal(insights.analysisAlignment.code, "petition.alignment.with_analysis");
    assert.equal(insights.analysisAlignment.civic?.title, "Analysis title XYZ");
    assert.equal(insights.clarityWarnings.length, 0);
    assert.equal(insights.missingContextWarnings.length, 0);
  });

  it("clarity and context advisories preserve predicates, codes, field IDs, and order", () => {
    const insights = derivePetitionAiAssistantInsights(
      snapshot(),
      draft({
        title: "  ",
        requestStatement: "too short",
        expectedOutcome: "",
        supportingContext: "",
        keyArguments: ["", "  "],
      }),
    );

    assert.deepEqual(
      insights.clarityWarnings.map((item) => ({
        code: item.code,
        fieldIds: item.civic?.petitionFieldIds,
      })),
      [
        { code: "petition.clarity.title_empty", fieldIds: ["title"] },
        { code: "petition.clarity.request_statement_short", fieldIds: ["requestStatement"] },
        { code: "petition.clarity.expected_outcome_empty", fieldIds: ["expectedOutcome"] },
      ],
    );
    assert.deepEqual(
      insights.missingContextWarnings.map((item) => ({
        code: item.code,
        fieldIds: item.civic?.petitionFieldIds,
      })),
      [
        {
          code: "petition.context.supporting_context_empty",
          fieldIds: ["supportingContext"],
        },
        { code: "petition.context.key_arguments_empty", fieldIds: ["keyArguments"] },
      ],
    );
  });

  it("passes through API consistency warning detail without rewriting", () => {
    const detail = "No Published Collaborative Analysis found. Supporting context may be incomplete.";
    const insights = derivePetitionAiAssistantInsights(
      snapshot({
        consistencyChecks: [
          {
            checkId: "analysis-available",
            label: "Collaborative Analysis",
            status: "warning",
            detail,
            params: {},
          },
          {
            checkId: "revision-available",
            label: "Published Revision",
            status: "ok",
            detail: "Petition will reference Revision v1.",
            params: {},
          },
        ],
      }),
      null,
    );

    assert.equal(insights.consistencyWarnings.length, 1);
    assert.equal(insights.consistencyWarnings[0]?.detail, detail);
  });

  it("does not emit English advisory sentences as derive contract", () => {
    const insights = derivePetitionAiAssistantInsights(
      snapshot(),
      draft({ title: "", requestStatement: "x", expectedOutcome: "", supportingContext: "", keyArguments: [] }),
    );
    const serialized = JSON.stringify(insights);
    assert.doesNotMatch(serialized, /Petition Title is empty/);
    assert.doesNotMatch(serialized, /Request Statement is very short/);
    assert.doesNotMatch(serialized, /No published Revision collected yet/);
    assert.doesNotMatch(serialized, /accepted Proposal\(s\)/);
  });
});
