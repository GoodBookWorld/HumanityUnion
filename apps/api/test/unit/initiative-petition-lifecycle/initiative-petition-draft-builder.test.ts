import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InitiativePetitionIntelligenceSnapshot } from "@hu/types";

import { generatePetitionDraftContent } from "../../../src/modules/initiative-petition-lifecycle/initiative-petition-draft-builder.js";

/**
 * Initiative Lifecycle — Part F, Section 3 (Petition Draft Builder).
 *
 * `generatePetitionDraftContent` is a pure function — no Mongo, no
 * network, no external AI provider. These tests exercise it directly
 * against hand-built `InitiativePetitionIntelligenceSnapshot` fixtures,
 * mirroring Part E's `initiative-revision-draft-builder.test.ts`.
 */
function buildSnapshot(
  overrides: Partial<InitiativePetitionIntelligenceSnapshot> = {},
): InitiativePetitionIntelligenceSnapshot {
  return {
    initiativeId: "petition-draft-builder-fixture",
    generatedAt: new Date().toISOString(),
    initiativeTitle: "Community Composting Initiative",
    initiativeDescription: "We want to reduce food waste across the neighborhood.",
    revisionReference: null,
    analysisReference: null,
    proposalReferences: [],
    consistencyChecks: [],
    isRevisionAvailable: false,
    isEmpty: true,
    ...overrides,
  };
}

describe("generatePetitionDraftContent (Petition Draft Builder)", () => {
  it("falls back to the Initiative description when no Revision has been published yet", async () => {
    const snapshot = buildSnapshot();

    const content = await generatePetitionDraftContent(snapshot);

    assert.equal(content.publicSummary, snapshot.initiativeDescription);
    assert.match(content.expectedOutcome, /once a Revision has been published/);
  });

  it("titles the Petition from the Initiative title", async () => {
    const snapshot = buildSnapshot();

    const content = await generatePetitionDraftContent(snapshot);

    assert.equal(content.title, "Petition: Community Composting Initiative");
  });

  it("builds the Public Summary and Expected Outcome from the published Revision, never invented text", async () => {
    const snapshot = buildSnapshot({
      revisionReference: {
        revisionId: "revision-fixture",
        version: 2,
        revisionSummary: "Added a dedicated composting station near the entrance.",
        publishedAt: new Date().toISOString(),
        title: "Community Composting Initiative",
        description: "We want to reduce food waste across the neighborhood.",
      },
      isRevisionAvailable: true,
      isEmpty: false,
    });

    const content = await generatePetitionDraftContent(snapshot);

    assert.equal(content.publicSummary, snapshot.revisionReference!.revisionSummary);
    assert.match(content.expectedOutcome, /Revision v2/);
    assert.match(content.expectedOutcome, /Added a dedicated composting station near the entrance/);
    assert.match(content.requestStatement, /Community Composting Initiative/);
  });

  it("cites every Proposal reference verbatim in Key Arguments, one per Proposal", async () => {
    const snapshot = buildSnapshot({
      proposalReferences: [
        {
          proposalId: "proposal-a",
          title: "Add a composting station",
          summary: "Reduces contamination in general waste bins.",
          status: "accepted",
        },
        {
          proposalId: "proposal-b",
          title: "Improve entrance accessibility",
          summary: "Widens the ramp for wheelchair access.",
          status: "partially_accepted",
        },
      ],
    });

    const content = await generatePetitionDraftContent(snapshot);

    assert.equal(content.keyArguments.length, 2);
    assert.match(content.keyArguments[0]!, /Add a composting station/);
    assert.match(content.keyArguments[1]!, /Improve entrance accessibility/);
  });

  it("includes the Collaborative Analysis summary in Supporting Context when available", async () => {
    const snapshot = buildSnapshot({
      analysisReference: {
        analysisId: "analysis-fixture",
        title: "Composting Feasibility Analysis",
        summary: "Community feedback strongly favors dedicated composting infrastructure.",
        initiativeVersion: 1,
      },
    });

    const content = await generatePetitionDraftContent(snapshot);

    assert.match(content.supportingContext, /Composting Feasibility Analysis|strongly favors dedicated composting/);
  });

  it("produces byte-identical output for the same snapshot on every call (deterministic)", async () => {
    const snapshot = buildSnapshot({
      revisionReference: {
        revisionId: "revision-fixture",
        version: 1,
        revisionSummary: "Initial published revision summary.",
        publishedAt: new Date().toISOString(),
        title: "Community Composting Initiative",
        description: "We want to reduce food waste across the neighborhood.",
      },
    });

    const first = await generatePetitionDraftContent(snapshot);
    const second = await generatePetitionDraftContent(snapshot);

    assert.deepEqual(second, first);
  });

  it("never invents a Key Argument out of thin air when no sources exist", async () => {
    const content = await generatePetitionDraftContent(buildSnapshot());

    assert.deepEqual(content.keyArguments, []);
  });
});
