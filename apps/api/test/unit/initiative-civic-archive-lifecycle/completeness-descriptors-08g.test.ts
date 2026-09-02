import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInitiativeCivicArchiveCompleteness } from "../../../src/modules/initiative-civic-archive-lifecycle/initiative-civic-archive-intelligence.service.js";
import { getArchiveDocumentPdfCopy } from "../../../src/modules/initiative-civic-archive-lifecycle/archive-document-copy.js";

describe("Pack 02G Task 08G — buildCompleteness descriptors", () => {
  it("emits summaryDescriptors alongside identical English summary join", () => {
    const completeness = buildInitiativeCivicArchiveCompleteness({
      timeline: [
        {
          stageId: "analysis",
          label: "Collaborative Analysis",
          status: "published",
          publishedAt: "2026-08-01T00:00:00.000Z",
          version: 1,
          sectionAnchor: "collaborative_analysis",
        },
        {
          stageId: "tracking",
          label: "Implementation Tracking",
          status: "partial",
          publishedAt: "2026-08-08T00:00:00.000Z",
          version: null,
          sectionAnchor: "implementation_tracking",
        },
      ],
      unresolvedTrackingCount: 2,
      unfinishedCommitmentCount: 1,
      missingEvidenceCount: 0,
      officialResponseCount: 0,
      publicImpactAvailable: false,
      hasTraceabilityAnchors: true,
      requirePublicImpact: true,
    });

    assert.deepEqual(
      completeness.summaryDescriptors.map((d) => d.code),
      [
        "stages_published",
        "public_impact_missing",
        "tracking_unresolved",
        "commitments_unfinished",
      ],
    );
    assert.deepEqual(completeness.summaryDescriptors[0]?.params, { count: 2 });
    assert.deepEqual(completeness.summaryDescriptors[2]?.params, { count: 2 });
    assert.deepEqual(completeness.summaryDescriptors[3]?.params, { count: 1 });

    assert.equal(
      completeness.summary,
      "2 Lifecycle stage(s) have published records. No published Public Impact Report yet. 2 Tracking Record(s) remain unresolved. 1 Commitment(s) are unfinished.",
    );
  });

  it("archive PDF copy resolves uk disclaimer without next-intl", () => {
    const copy = getArchiveDocumentPdfCopy("uk");
    assert.match(copy.disclaimer, /Humanity Union/);
    assert.doesNotMatch(
      copy.disclaimer,
      /This document records civic participation/,
    );
    assert.equal(copy.sectionTitles.archive_overview, "Огляд архіву");
  });
});
