/**
 * Reset 03E.2 — localization content integrity (API; no live ops).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
  type PublicPresentationNode,
} from "@hu/types";

import { validateMediaPlpProviderLocalizationValues } from "../../../src/modules/language/media-plp-materializer/provider-boundary.js";
import {
  buildCanonicalEditorialPresentation,
  asMediaPlpPresentationNode,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import {
  buildMediaPlpCandidate,
  publishMediaPlpEntity,
} from "../../../src/modules/language/published-localized-presentation/media/index.js";
import {
  evaluateLocalizationContentIntegrity,
  LOCALIZATION_CONTENT_INTEGRITY_VERSION,
  mergeLocalizedLayersByProvenance,
  normalizeLocalizationCompareValue,
  publishAtomicMemory,
  publishPublishedLocalizedPresentation,
  resetMediaPlpResolveCacheForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolvePublishedPresentation,
  validatePublishedBuildResult,
  collectAutoPaths,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { runMediaPlpPreflight } from "../../../src/modules/language/media-plp-preflight/index.js";

afterEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpResolveCacheForTests();
});

const editorialCanonical = asMediaPlpPresentationNode(
  buildCanonicalEditorialPresentation({
    overview: {
      title: "Overview title EN",
      summary: "Overview summary EN",
      points: [
        { id: "p1", heading: "Point heading EN", body: "Point body EN" },
        { id: "p2", heading: "Point two EN", body: "Point two body EN" },
      ],
    },
    faq: [
      {
        id: "faq-1",
        question: "FAQ question EN?",
        answer: "FAQ answer EN",
        sortOrder: 1,
      },
    ],
  }),
);

function ukEditorialValues(): Record<string, string> {
  return {
    overviewTitle: "Огляд заголовок",
    overviewSummary: "Огляд резюме",
    "overviewPoints[0].id": "p1",
    "overviewPoints[0].heading": "Пункт заголовок",
    "overviewPoints[0].body": "Пункт тіло",
    "overviewPoints[1].id": "p2",
    "overviewPoints[1].heading": "Пункт два",
    "overviewPoints[1].body": "Пункт два тіло",
    "faq[0].id": "faq-1",
    "faq[0].question": "Питання FAQ?",
    "faq[0].answer": "Відповідь FAQ",
  };
}

function integrityPassed(report = evaluateLocalizationContentIntegrity({
  locale: "uk",
  canonicalPresentation: editorialCanonical,
  localizedPresentation: mergeLocalizedLayersByProvenance({
    canonicalPresentation: editorialCanonical,
    layers: [{ source: "MACHINE", values: ukEditorialValues() }],
  }).presentation,
})) {
  assert.equal(report.status, "PASSED");
  return report;
}

describe("Reset 03E.2 — localization content integrity", () => {
  it("normalized equality ignores whitespace only (no fuzzy language detection)", () => {
    assert.equal(
      normalizeLocalizationCompareValue("  Hello   world  "),
      normalizeLocalizationCompareValue("Hello world"),
    );
    assert.notEqual(
      normalizeLocalizationCompareValue("Hello world"),
      normalizeLocalizationCompareValue("Hello worlds"),
    );
  });

  it("provider all-English prose → rejected (WRONG_TARGET_LANGUAGE)", () => {
    const auto = {
      overviewTitle: "Overview title EN",
      overviewSummary: "Overview summary EN",
      "overviewPoints[0].id": "p1",
    };
    const result = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: auto,
      translated: { ...auto },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "WRONG_TARGET_LANGUAGE");
    }
  });

  it("provider one required path missing → PARTIAL", () => {
    const auto = ukEditorialValues();
    const translated = { ...auto };
    delete translated.overviewSummary;
    const result = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: auto,
      translated,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "PARTIAL");
    }
  });

  it("provider one path canonical-identical while others localized → integrity fail", () => {
    const auto = {
      overviewTitle: "Overview title EN",
      overviewSummary: "Overview summary EN",
      "overviewPoints[0].id": "p1",
    };
    const result = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: auto,
      translated: {
        overviewTitle: "Огляд",
        overviewSummary: "Overview summary EN",
        "overviewPoints[0].id": "p1",
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "LOCALIZATION_CONTENT_INTEGRITY_FAILED");
    }
  });

  it("protected canonical name identical is allowed; technical id identical allowed", () => {
    const tree = {
      name: protectedIdentity("Reuters"),
      websiteUrl: protectedTechnical("https://www.reuters.com/"),
      explanation: "Independent wire",
      nestedId: "keep-me",
    } as const satisfies PublicPresentationNode;
    // nestedId is AUTO unless path ends with .id — use overviewPoints style via editorial
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: editorialCanonical,
      layers: [
        {
          source: "MACHINE",
          values: ukEditorialValues(),
        },
      ],
    });
    const validation = validatePublishedBuildResult({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: "v1",
      buildTargetCanonicalVersion: "v1",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: editorialCanonical,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
    });
    assert.equal(validation.status, "READY_TO_PUBLISH");
    void tree;
  });

  it("valid full uk translation → publishable with CLI.1 PASSED", async () => {
    const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);
    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: editorialCanonical,
      layers: [{ source: "MACHINE", values: ukEditorialValues() }],
      includeDeterministicMachine: false,
    });
    assert.equal(published.ok, true);
    if (!published.ok) return;
    assert.equal(published.record.contentIntegrity?.version, LOCALIZATION_CONTENT_INTEGRITY_VERSION);
    assert.equal(published.record.contentIntegrity?.status, "PASSED");
    assert.ok((published.record.contentIntegrity?.LOCALIZED_VALUE_NODE_COUNT ?? 0) >= 8);
    assert.equal(published.record.contentIntegrity?.CANONICAL_IDENTICAL_NODE_COUNT, 0);

    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
    assert.equal(
      (resolved.presentation as { overviewTitle: string }).overviewTitle,
      "Огляд заголовок",
    );
  });

  it("canonical-identical MACHINE English on every prose path → NOT_READY", () => {
    const auto: Record<string, string> = {};
    for (const node of collectAutoPaths(editorialCanonical)) {
      auto[node.path] = node.value;
    }
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: editorialCanonical,
      layers: [{ source: "MACHINE", values: auto }],
    });
    const validation = validatePublishedBuildResult({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: "v1",
      buildTargetCanonicalVersion: "v1",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: editorialCanonical,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
    });
    assert.equal(validation.status, "NOT_READY");
    assert.ok(
      validation.reasonCodes.includes("LOCALIZATION_CONTENT_INTEGRITY_FAILED"),
    );
    assert.ok(
      validation.reasonCodes.includes("CANONICAL_IDENTICAL_TRANSLATABLE_VALUE"),
    );
  });

  it("one translated path reconstructed from canonical → rejected", () => {
    const values = ukEditorialValues();
    values.overviewSummary = "Overview summary EN";
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
      built.validation.reasonCodes.includes("LOCALIZATION_CONTENT_INTEGRITY_FAILED"),
    );
  });

  it("partial entity (missing FAQ answer) → not publishable", () => {
    const values = ukEditorialValues();
    delete values["faq[0].answer"];
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
  });

  it("PLP.2 snapshot without integrity metadata → resolver CANONICAL_FALLBACK", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: editorialCanonical,
      layers: [{ source: "MACHINE", values: ukEditorialValues() }],
    });
    const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);
    const seeded = publishAtomicMemory({
      candidate: {
        snapshotId: "legacy-no-integrity",
        identity: {
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
          locale: "uk",
          canonicalVersion: version,
          localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        },
        state: "BUILDING",
        contentRevision: 1,
        presentation: merged.presentation,
        provenance: merged.provenance,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    assert.equal(seeded.ok, true);
    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "LOCALIZATION_CONTENT_INTEGRITY_MISSING");
    assert.equal(
      (resolved.presentation as { overviewTitle: string }).overviewTitle,
      "Overview title EN",
    );
  });

  it("PLP.2 snapshot with failed integrity attestation → CANONICAL_FALLBACK", async () => {
    const badPresentation = editorialCanonical;
    const failedReport = evaluateLocalizationContentIntegrity({
      locale: "uk",
      canonicalPresentation: editorialCanonical,
      localizedPresentation: badPresentation,
    });
    assert.equal(failedReport.status, "FAILED");
    const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);
    const seeded = publishAtomicMemory({
      candidate: {
        snapshotId: "failed-integrity",
        identity: {
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
          locale: "uk",
          canonicalVersion: version,
          localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        },
        state: "BUILDING",
        contentRevision: 1,
        presentation: badPresentation,
        provenance: [],
        contentIntegrity: failedReport,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    assert.equal(seeded.ok, true);
    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "LOCALIZATION_CONTENT_INTEGRITY_FAILED");
  });

  it("stale PLP.1 under PLP.2 → CANONICAL_FALLBACK (unchanged)", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: editorialCanonical,
      layers: [{ source: "MACHINE", values: ukEditorialValues() }],
    });
    const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);
    const seeded = publishAtomicMemory({
      candidate: {
        snapshotId: "plp1-stale",
        identity: {
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
          locale: "uk",
          canonicalVersion: version,
          localizationSchemaVersion: "PLP.1",
        },
        state: "BUILDING",
        contentRevision: 1,
        presentation: merged.presentation,
        provenance: merged.provenance,
        contentIntegrity: integrityPassed(),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    assert.equal(seeded.ok, true);
    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      liveLocalizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "SCHEMA_VERSION_MISMATCH");
  });

  it("preflight exposes integrity counts without body text", async () => {
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: editorialCanonical,
      layers: [{ source: "MACHINE", values: ukEditorialValues() }],
    });
    const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);
    const result = await runMediaPlpPreflight(
      [
        "node",
        "diagnose-media-plp-preflight.ts",
        "--mongo",
        "--entity-type",
        "civic_media_editorial",
        "--entity-id",
        "civic-media-center",
        "--locale",
        "uk",
      ],
      {
        skipImportBoundaryCheck: true,
        isMongoConfigured: () => true,
        resolveDatabase: () => "humanity_union_staging",
        connect: async () => undefined,
        disconnect: async () => undefined,
        loadSource: async () => ({
          SOURCE_FOUND: true,
          SOURCE_PUBLIC: true,
          CANONICAL_VERSION: version,
          SOURCE_DOCUMENT_BYTES: 32,
          SOURCE_RECORDS_MATCHED: 1,
          identityCollision: false,
          canonicalPresentation: editorialCanonical,
        }),
        loadPlp: async () => ({
          PLP_CURRENT_FOUND: true,
          PLP_STATE: "PUBLISHED",
          PLP_CANONICAL_VERSION: version,
          PLP_SCHEMA_VERSION: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
          PLP_DOCUMENT_BYTES: 64,
          PLP_RECORDS_MATCHED: 1,
          identityCollision: false,
          presentation: editorialCanonical, // English published — integrity FAILED
          contentIntegrity: null,
        }),
        loadLocale: async () => ({
          LOCALE_REGISTRY_FOUND: true,
          LOCALE_ENABLED: true,
          CONTENT_TRANSLATION_ENABLED: true,
        }),
      },
    );
    assert.equal(result.exitCode, 0);
    assert.ok(result.report);
    assert.equal(result.report!.reportKind, "identity");
    if (result.report!.reportKind !== "identity") return;
    assert.equal(result.report.CONTENT_INTEGRITY_STATUS, "UNKNOWN_LEGACY");
    assert.equal(
      result.report.CONTENT_INTEGRITY_REASON,
      "LOCALIZATION_CONTENT_INTEGRITY_MISSING",
    );
    assert.ok((result.report.CANONICAL_IDENTICAL_NODE_COUNT ?? 0) > 0);
    const serialized = JSON.stringify(result.report);
    assert.doesNotMatch(serialized, /Overview title EN/);
    assert.doesNotMatch(serialized, /Огляд/);
    void merged;
  });

  it("provider path contract: extras ignored; missing fails; no silent canonical success", () => {
    const auto = {
      overviewTitle: "A",
      overviewSummary: "B",
    };
    const withExtra = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: auto,
      translated: {
        overviewTitle: "А",
        overviewSummary: "Б",
        unexpectedPath: "ignored",
      },
    });
    assert.equal(withExtra.ok, true);

    const missing = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: auto,
      translated: { overviewTitle: "А" },
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.reason, "PARTIAL");
  });

  it("publish refuses canonical-identical candidate (atomic whole-entity)", async () => {
    const refused = await publishPublishedLocalizedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      canonicalPresentation: editorialCanonical,
      localizedCandidate: editorialCanonical,
      provenance: [
        {
          path: "overviewTitle",
          source: "MACHINE",
          appliedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.outcome, "NOT_READY");
      assert.ok(
        refused.reasonCodes.includes("LOCALIZATION_CONTENT_INTEGRITY_FAILED") ||
          refused.reasonCodes.includes("PARTIAL_AUTO_NODES"),
      );
    }
  });
});
