/**
 * Reset 03E.3 — localization structural integrity (API; no live ops).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";

import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalPrinciplePresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import {
  buildMediaPlpCandidate,
  publishMediaPlpEntity,
} from "../../../src/modules/language/published-localized-presentation/media/index.js";
import {
  evaluateLocalizationStructuralIntegrity,
  LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
  listRequiredLocalizationSourcePaths,
  mergeLocalizedLayersByProvenance,
  publishAtomicMemory,
  resetMediaPlpResolveCacheForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolvePublishedPresentation,
  validatePublishedBuildResult,
} from "../../../src/modules/language/published-localized-presentation/index.js";

afterEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpResolveCacheForTests();
});

const editorialCanonical = asMediaPlpPresentationNode(
  buildCanonicalEditorialPresentation({
    overview: {
      title: "Overview title EN",
      summary: "Overview summary EN",
      points: [{ id: "p1", heading: "H1", body: "B1" }],
    },
    faq: [{ id: "faq-1", question: "Q?", answer: "A", sortOrder: 1 }],
  }),
);

describe("Reset 03E.3 — localization structural integrity", () => {
  it("lists required source paths excluding technical ids", () => {
    const paths = listRequiredLocalizationSourcePaths(editorialCanonical);
    assert.ok(paths.includes("overviewTitle"));
    assert.ok(paths.includes("faq[0].question"));
    assert.ok(!paths.some((p) => p.endsWith(".id")));
  });

  it("builder omitting a rendered path from presentation → structural fail", () => {
    const values: Record<string, string> = {
      overviewTitle: "Огляд",
      overviewSummary: "Резюме",
      "overviewPoints[0].id": "p1",
      "overviewPoints[0].heading": "З",
      "overviewPoints[0].body": "Т",
      "faq[0].id": "faq-1",
      "faq[0].question": "П?",
      // faq[0].answer intentionally omitted from build → stays canonical empty/missing after merge?
    };
    const built = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: "v1",
      canonicalPresentation: editorialCanonical,
      layers: [{ source: "MACHINE", values }],
      includeDeterministicMachine: false,
    });
    assert.equal(built.validation.status, "NOT_READY");
    assert.ok(
      built.validation.reasonCodes.includes("LOCALIZATION_STRUCTURAL_INTEGRITY_FAILED") ||
        built.validation.reasonCodes.includes("PARTIAL_AUTO_NODES") ||
        built.validation.reasonCodes.includes("LOCALIZATION_CONTENT_INTEGRITY_FAILED"),
    );
  });

  it("valid structure + content → LSI.1 PASSED on publish", async () => {
    const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);
    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: editorialCanonical,
      includeDeterministicMachine: true,
    });
    assert.equal(published.ok, true);
    if (!published.ok) return;
    assert.equal(
      published.record.structuralIntegrity?.version,
      LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
    );
    assert.equal(published.record.structuralIntegrity?.status, "PASSED");
    assert.equal(published.record.contentIntegrity?.status, "PASSED");

    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
  });

  it("legacy PLP.2 without structuralIntegrity → resolver CANONICAL_FALLBACK", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: editorialCanonical,
      layers: [
        {
          source: "MACHINE",
          values: Object.fromEntries(
            listRequiredLocalizationSourcePaths(editorialCanonical).map((p) => [
              p,
              `[uk] ${p}`,
            ]),
          ),
        },
      ],
    });
    // Also need id paths for merge completeness on arrays
    const withIds = mergeLocalizedLayersByProvenance({
      canonicalPresentation: editorialCanonical,
      layers: [
        {
          source: "MACHINE",
          values: {
            overviewTitle: "[uk] Overview title EN",
            overviewSummary: "[uk] Overview summary EN",
            "overviewPoints[0].id": "p1",
            "overviewPoints[0].heading": "[uk] H1",
            "overviewPoints[0].body": "[uk] B1",
            "faq[0].id": "faq-1",
            "faq[0].question": "[uk] Q?",
            "faq[0].answer": "[uk] A",
          },
        },
      ],
    });
    const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);
    const contentIntegrity = {
      version: "CLI.1" as const,
      status: "PASSED" as const,
      TRANSLATABLE_NODE_COUNT: 6,
      LOCALIZED_VALUE_NODE_COUNT: 6,
      CANONICAL_IDENTICAL_NODE_COUNT: 0,
      EMPTY_OR_MISSING_NODE_COUNT: 0,
      PROTECTED_CANONICAL_NODE_COUNT: 0,
      reasonCodes: [] as const,
      evaluatedAt: "2026-01-01T00:00:00.000Z",
    };
    publishAtomicMemory({
      candidate: {
        snapshotId: "no-lsi",
        identity: {
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
          locale: "uk",
          canonicalVersion: version,
          localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        },
        state: "BUILDING",
        contentRevision: 1,
        presentation: withIds.presentation,
        provenance: withIds.provenance,
        contentIntegrity,
        // structuralIntegrity omitted
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "LOCALIZATION_STRUCTURAL_INTEGRITY_MISSING");
    void merged;
  });

  it("principle tree includes whyItMatters in AUTO source paths", () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPrinciplePresentation({
        id: "editorial-transparency",
        title: "T",
        description: "D",
        whyItMatters: "Why EN",
        sortOrder: 1,
      }),
    );
    const paths = listRequiredLocalizationSourcePaths(tree);
    assert.ok(paths.includes("whyItMatters"));
    const structural = evaluateLocalizationStructuralIntegrity({
      locale: "uk",
      canonicalPresentation: tree,
      localizedPresentation: {
        title: "Т",
        description: "Д",
        whyItMatters: "Чому",
      },
    });
    assert.equal(structural.status, "PASSED");
  });

  it("schema version remains PLP.2 (LSI.1 is independent)", () => {
    assert.equal(PUBLISHED_LOCALIZATION_SCHEMA_VERSION, "PLP.2");
    assert.equal(LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION, "LSI.1");
  });

  it("validate rejects when presentation lacks build path shape", () => {
    const validation = validatePublishedBuildResult({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: "v1",
      buildTargetCanonicalVersion: "v1",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: editorialCanonical,
      localizedCandidate: {
        overviewTitle: "Огляд",
        overviewSummary: "Резюме",
        // missing points/faq structure
      },
      provenance: [
        {
          path: "overviewTitle",
          source: "MACHINE",
          appliedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          path: "overviewSummary",
          source: "MACHINE",
          appliedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(validation.status, "NOT_READY");
  });
});
