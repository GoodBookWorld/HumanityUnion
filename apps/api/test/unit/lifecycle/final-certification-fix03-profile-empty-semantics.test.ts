import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveCivicArchiveSourceEmptyState } from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-source-empty.js";
import { generateCivicArchiveDraftContent } from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-builder.js";
import { resolveCollectiveDecisionSourceEmptyState } from "../../../src/modules/initiative-collective-decision-lifecycle/initiative-collective-decision-source-empty.js";

describe("Final Certification Fix 03 — Archive isEmpty profile semantics", () => {
  it("STANDARD Archive isEmpty when Public Impact is absent", () => {
    const state = resolveCivicArchiveSourceEmptyState({
      hasInitiative: true,
      publicImpactAvailable: false,
      lifecycleProfile: "STANDARD",
    });
    assert.equal(state.requirePublicImpact, true);
    assert.equal(state.isEmpty, true);
  });

  it("PUBLIC_CHOICE Archive is not empty without Public Impact", () => {
    const state = resolveCivicArchiveSourceEmptyState({
      hasInitiative: true,
      publicImpactAvailable: false,
      lifecycleProfile: "PUBLIC_CHOICE",
    });
    assert.equal(state.requirePublicImpact, false);
    assert.equal(state.isEmpty, false);
  });

  it("missing profile defaults to STANDARD Public Impact empty gate", () => {
    const state = resolveCivicArchiveSourceEmptyState({
      hasInitiative: true,
      publicImpactAvailable: false,
      lifecycleProfile: null,
    });
    assert.equal(state.requirePublicImpact, true);
    assert.equal(state.isEmpty, true);
  });

  it("PUBLIC_CHOICE Archive draft summary does not mark Public Impact unavailable", () => {
    const content = generateCivicArchiveDraftContent(
      {
        initiativeId: "fix03-builder-pc",
        generatedAt: "2026-08-01T00:00:00.000Z",
        initiativeTitle: "PC Archive",
        initiativeDescription: "desc",
        publicImpactReportReference: null,
        analysisReference: null,
        proposalReferences: [],
        revisionReference: null,
        petitionReference: null,
        decisionSessionReference: null,
        decisionReference: {
          recordId: "decision-1",
          label: "CD",
          summary: "Outcome",
          publishedAt: "2026-08-01T00:00:00.000Z",
          version: 1,
        },
        commitmentPackageReference: null,
        trackingPackageReference: null,
        officialResponsePackageReference: null,
        consistencyChecks: [],
        completeness: {
          summary:
            "Public Impact is not required on Public Choice — Collective Decision completion is sufficient.",
          stagesFound: ["collective_decision"],
          stagesPublished: ["collective_decision"],
          missingOptionalStages: [],
          unresolvedTrackingCount: 0,
          unfinishedCommitmentCount: 0,
          missingEvidenceCount: 0,
          officialResponseCount: 0,
          publicImpactAvailable: false,
          traceabilityComplete: true,
        },
        participationStatistics: {
          signatureCount: 0,
          supportCount: 0,
          reactionCount: 0,
          activeAllyCount: 0,
        },
        timeline: [],
        isPublicImpactReportAvailable: false,
        isEmpty: false,
      },
      "PUBLIC_CHOICE",
    );

    assert.match(content.finalSummary, /Public Impact not required on Public Choice/);
    assert.doesNotMatch(content.finalSummary, /Public Impact unavailable/);
  });
});

describe("Final Certification Fix 03 — Collective Decision isEmpty profile semantics", () => {
  it("STANDARD Collective Decision isEmpty without Decision Session", () => {
    const state = resolveCollectiveDecisionSourceEmptyState({
      hasInitiative: true,
      decisionSessionAvailable: false,
      lifecycleProfile: "STANDARD",
    });
    assert.equal(state.requireDecisionSession, true);
    assert.equal(state.isEmpty, true);
  });

  it("PUBLIC_CHOICE Collective Decision is not empty without Decision Session", () => {
    const state = resolveCollectiveDecisionSourceEmptyState({
      hasInitiative: true,
      decisionSessionAvailable: false,
      lifecycleProfile: "PUBLIC_CHOICE",
    });
    assert.equal(state.requireDecisionSession, false);
    assert.equal(state.isEmpty, false);
  });
});
