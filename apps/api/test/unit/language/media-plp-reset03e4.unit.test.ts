/**
 * Reset 03E.4 — PLP rebuild eligibility parity (no live ops).
 *
 * Invariant: read eligibility and rebuild eligibility are complements of the
 * same published-presentation usability contract.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";

import { runMediaPlpMaterializer } from "../../../src/modules/language/media-plp-materializer/index.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import {
  buildMediaPlpCandidate,
  publishMediaPlpEntity,
} from "../../../src/modules/language/published-localized-presentation/media/index.js";
import {
  classifyUsableLocalizedPresentation,
  findPublishedSnapshotByIdMemory,
  LOCALIZATION_CONTENT_INTEGRITY_VERSION,
  LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
  mergeLocalizedLayersByProvenance,
  publishAtomicMemory,
  resetMediaPlpResolveCacheForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolvePublishedPresentation,
  setPublishedLocalizationPersistenceModeForTests,
  translationValuesPassLocalizationIntegrity,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import type { MediaPlpMaterializerDeps } from "../../../src/modules/language/media-plp-materializer/run-materializer.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";

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

const version = fingerprintMediaPlpCanonicalVersion(editorialCanonical);

function ukEditorialValues(): Record<string, string> {
  return {
    overviewTitle: "Огляд заголовок",
    overviewSummary: "Огляд резюме",
    "overviewPoints[0].id": "p1",
    "overviewPoints[0].heading": "Пункт",
    "overviewPoints[0].body": "Тіло",
    "faq[0].id": "faq-1",
    "faq[0].question": "Питання?",
    "faq[0].answer": "Відповідь",
  };
}

function localizedEditorialPresentation() {
  return mergeLocalizedLayersByProvenance({
    canonicalPresentation: editorialCanonical,
    layers: [{ source: "MACHINE", values: ukEditorialValues() }],
  }).presentation;
}

function seedLegacyPublishedWithoutIntegrity(input?: {
  readonly state?: "PUBLISHED" | "BUILDING" | "FAILED";
  readonly canonicalVersion?: string;
  readonly schema?: string;
  readonly contentIntegrity?: Parameters<typeof publishAtomicMemory>[0]["candidate"]["contentIntegrity"];
  readonly structuralIntegrity?: Parameters<typeof publishAtomicMemory>[0]["candidate"]["structuralIntegrity"];
  readonly presentation?: ReturnType<typeof localizedEditorialPresentation>;
  readonly snapshotId?: string;
  readonly contentRevision?: number;
}) {
  const presentation = input?.presentation ?? localizedEditorialPresentation();
  publishAtomicMemory({
    candidate: {
      snapshotId: input?.snapshotId ?? "legacy-no-integrity",
      identity: {
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
        locale: "uk",
        canonicalVersion: input?.canonicalVersion ?? version,
        localizationSchemaVersion:
          (input?.schema as typeof PUBLISHED_LOCALIZATION_SCHEMA_VERSION) ??
          PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      },
      state: input?.state ?? "BUILDING",
      contentRevision: input?.contentRevision ?? 1,
      presentation,
      provenance: [],
      contentIntegrity: input?.contentIntegrity,
      structuralIntegrity: input?.structuralIntegrity,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
}

function materializerDeps(input?: {
  readonly translationComplete?: boolean;
  readonly translationValues?: Record<string, string>;
}): MediaPlpMaterializerDeps {
  const autoPaths = collectAutoPaths(editorialCanonical);
  return {
    skipImportBoundaryCheck: true,
    skipMongoPersistenceRequire: true,
    isMongoConfigured: () => true,
    resolveDatabase: () => "humanity_union_staging",
    platformMode: "staging",
    connect: async () => undefined,
    disconnect: async () => undefined,
    resolveSource: async () => ({
      SOURCE_FOUND: true,
      SOURCE_PUBLIC: true,
      CANONICAL_VERSION: version,
      canonicalPresentation: editorialCanonical,
      autoPaths,
      identityCollision: false,
    }),
    // Real inspect against memory store — exercises shared classifier.
    loadLocale: async () => ({
      LOCALE_REGISTRY_FOUND: true,
      LOCALE_ENABLED: true,
      CONTENT_TRANSLATION_ENABLED: true,
    }),
    lookupTranslation: async () => ({
      EXISTING_TRANSLATION_STATE: input?.translationComplete ? "COMPLETE" : "MISSING",
      EXISTING_TRANSLATION_COMPLETE: Boolean(input?.translationComplete),
      values: input?.translationValues ?? (input?.translationComplete ? ukEditorialValues() : {}),
    }),
    verifyDurability: async () => ({
      ok: true as const,
      PLP_DURABILITY_VERIFIED: true as const,
    }),
    importProvider: async () => ({
      providerId: "deterministic",
      async translate(request) {
        const parsed = JSON.parse(request.text) as Record<string, string>;
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
          out[k] = `[uk] ${v}`;
        }
        return {
          translatedText: JSON.stringify(out),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      },
    }),
    providerTransport: "fake_local",
  };
}

describe("Reset 03E.4 — PLP rebuild eligibility parity", () => {
  it("staging-state regression: PUBLISHED+version+schema without CLI/LSI → fallback + rebuild", async () => {
    setPublishedLocalizationPersistenceModeForTests("memory");
    seedLegacyPublishedWithoutIntegrity();

    const resolved = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "LOCALIZATION_CONTENT_INTEGRITY_MISSING");

    const dry = await runMediaPlpMaterializer(
      [
        "node",
        "materialize",
        "--mongo",
        "--entity-type",
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "--entity-id",
        MEDIA_PLP_EDITORIAL_ENTITY_ID,
        "--locale",
        "uk",
      ],
      materializerDeps(),
    );
    assert.equal(dry.exitCode, 0);
    assert.ok(dry.report);
    assert.equal(dry.report!.EXISTING_PLP_USABILITY, "REBUILD_REQUIRED");
    assert.equal(dry.report!.EXISTING_PLP_USABILITY_REASON, "CONTENT_INTEGRITY_MISSING");
    assert.equal(dry.report!.REBUILD_REQUIRED, true);
    assert.notEqual(dry.report!.LOCALIZATION_SOURCE, "UNCHANGED_PLP");
    assert.equal(dry.report!.WOULD_CALL_PROVIDER, true);
    assert.equal(dry.report!.WOULD_PUBLISH_PLP, true);
    assert.equal(dry.report!.PROVIDER_CALL_COUNT, 0);
    assert.equal(dry.report!.PLP_WRITES, 0);
  });

  it("validity parity matrix — every unusable read maps to rebuild, never UNCHANGED_PLP", async () => {
    setPublishedLocalizationPersistenceModeForTests("memory");

    const cases: Array<{
      readonly name: string;
      readonly seed: () => void;
      readonly resolveReason: string;
      readonly usabilityReason: string;
    }> = [
      {
        name: "CLI missing",
        seed: () => seedLegacyPublishedWithoutIntegrity(),
        resolveReason: "LOCALIZATION_CONTENT_INTEGRITY_MISSING",
        usabilityReason: "CONTENT_INTEGRITY_MISSING",
      },
      {
        name: "CLI failed",
        seed: () =>
          seedLegacyPublishedWithoutIntegrity({
            contentIntegrity: {
              version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
              status: "FAILED",
              TRANSLATABLE_NODE_COUNT: 1,
              LOCALIZED_VALUE_NODE_COUNT: 0,
              CANONICAL_IDENTICAL_NODE_COUNT: 1,
              EMPTY_OR_MISSING_NODE_COUNT: 0,
              PROTECTED_CANONICAL_NODE_COUNT: 0,
              reasonCodes: ["CANONICAL_IDENTICAL_TRANSLATABLE_VALUE"],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
            structuralIntegrity: {
              version: LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
              status: "PASSED",
              CANONICAL_SOURCE_PATHS: 6,
              BUILD_INPUT_PATHS: 6,
              LOCALIZED_OUTPUT_PATHS: 6,
              STRUCTURAL_MISMATCH_COUNT: 0,
              reasonCodes: [],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        resolveReason: "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
        usabilityReason: "CONTENT_INTEGRITY_FAILED",
      },
      {
        name: "LSI missing",
        seed: () =>
          seedLegacyPublishedWithoutIntegrity({
            contentIntegrity: {
              version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
              status: "PASSED",
              TRANSLATABLE_NODE_COUNT: 6,
              LOCALIZED_VALUE_NODE_COUNT: 6,
              CANONICAL_IDENTICAL_NODE_COUNT: 0,
              EMPTY_OR_MISSING_NODE_COUNT: 0,
              PROTECTED_CANONICAL_NODE_COUNT: 0,
              reasonCodes: [],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        resolveReason: "LOCALIZATION_STRUCTURAL_INTEGRITY_MISSING",
        usabilityReason: "STRUCTURAL_INTEGRITY_MISSING",
      },
      {
        name: "LSI failed",
        seed: () =>
          seedLegacyPublishedWithoutIntegrity({
            contentIntegrity: {
              version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
              status: "PASSED",
              TRANSLATABLE_NODE_COUNT: 6,
              LOCALIZED_VALUE_NODE_COUNT: 6,
              CANONICAL_IDENTICAL_NODE_COUNT: 0,
              EMPTY_OR_MISSING_NODE_COUNT: 0,
              PROTECTED_CANONICAL_NODE_COUNT: 0,
              reasonCodes: [],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
            structuralIntegrity: {
              version: LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
              status: "FAILED",
              CANONICAL_SOURCE_PATHS: 6,
              BUILD_INPUT_PATHS: 6,
              LOCALIZED_OUTPUT_PATHS: 0,
              STRUCTURAL_MISMATCH_COUNT: 6,
              reasonCodes: ["BUILD_WITHOUT_OUTPUT"],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        resolveReason: "LOCALIZATION_STRUCTURAL_INTEGRITY_FAILED",
        usabilityReason: "STRUCTURAL_INTEGRITY_FAILED",
      },
      {
        name: "stale canonical",
        seed: () =>
          seedLegacyPublishedWithoutIntegrity({
            canonicalVersion: "v-stale",
            contentIntegrity: {
              version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
              status: "PASSED",
              TRANSLATABLE_NODE_COUNT: 6,
              LOCALIZED_VALUE_NODE_COUNT: 6,
              CANONICAL_IDENTICAL_NODE_COUNT: 0,
              EMPTY_OR_MISSING_NODE_COUNT: 0,
              PROTECTED_CANONICAL_NODE_COUNT: 0,
              reasonCodes: [],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
            structuralIntegrity: {
              version: LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
              status: "PASSED",
              CANONICAL_SOURCE_PATHS: 6,
              BUILD_INPUT_PATHS: 6,
              LOCALIZED_OUTPUT_PATHS: 6,
              STRUCTURAL_MISMATCH_COUNT: 0,
              reasonCodes: [],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        resolveReason: "CANONICAL_VERSION_MISMATCH",
        usabilityReason: "CANONICAL_VERSION_MISMATCH",
      },
      {
        name: "stale schema",
        seed: () =>
          seedLegacyPublishedWithoutIntegrity({
            schema: "PLP.1",
            contentIntegrity: {
              version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
              status: "PASSED",
              TRANSLATABLE_NODE_COUNT: 6,
              LOCALIZED_VALUE_NODE_COUNT: 6,
              CANONICAL_IDENTICAL_NODE_COUNT: 0,
              EMPTY_OR_MISSING_NODE_COUNT: 0,
              PROTECTED_CANONICAL_NODE_COUNT: 0,
              reasonCodes: [],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
            structuralIntegrity: {
              version: LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
              status: "PASSED",
              CANONICAL_SOURCE_PATHS: 6,
              BUILD_INPUT_PATHS: 6,
              LOCALIZED_OUTPUT_PATHS: 6,
              STRUCTURAL_MISMATCH_COUNT: 0,
              reasonCodes: [],
              evaluatedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        resolveReason: "SCHEMA_VERSION_MISMATCH",
        usabilityReason: "SCHEMA_VERSION_MISMATCH",
      },
    ];

    for (const c of cases) {
      resetPublishedLocalizationPersistenceForTests();
      resetMediaPlpResolveCacheForTests();
      setPublishedLocalizationPersistenceModeForTests("memory");
      c.seed();

      const resolved = await resolvePublishedPresentation({
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
        locale: "uk",
        liveCanonicalVersion: version,
        canonicalPresentation: editorialCanonical,
      });
      assert.equal(resolved.mode, "CANONICAL_FALLBACK", c.name);
      assert.equal(resolved.reasonCode, c.resolveReason, c.name);

      const classification = classifyUsableLocalizedPresentation({
        locale: "uk",
        liveCanonicalVersion: version,
        canonicalPresentation: editorialCanonical,
        snapshot: {
          state: "PUBLISHED",
          identity: {
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
            entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
            locale: "uk",
            canonicalVersion:
              c.usabilityReason === "CANONICAL_VERSION_MISMATCH" ? "v-stale" : version,
            localizationSchemaVersion:
              c.usabilityReason === "SCHEMA_VERSION_MISMATCH"
                ? "PLP.1"
                : PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
          },
          presentation: localizedEditorialPresentation(),
        },
      });
      // Materializer path via real inspect
      const dry = await runMediaPlpMaterializer(
        [
          "node",
          "materialize",
          "--mongo",
          "--entity-type",
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          "--entity-id",
          MEDIA_PLP_EDITORIAL_ENTITY_ID,
          "--locale",
          "uk",
        ],
        materializerDeps(),
      );
      assert.equal(dry.report!.LOCALIZATION_SOURCE, "PROVIDER", c.name);
      assert.notEqual(dry.report!.LOCALIZATION_SOURCE, "UNCHANGED_PLP", c.name);
      assert.equal(dry.report!.REBUILD_REQUIRED, true, c.name);
      assert.equal(dry.report!.EXISTING_PLP_USABILITY, "REBUILD_REQUIRED", c.name);
      assert.equal(dry.report!.EXISTING_PLP_USABILITY_REASON, c.usabilityReason, c.name);
      void classification;
    }

    // BUILDING / FAILED: classifier direct (findCurrent only returns PUBLISHED)
    for (const state of ["BUILDING", "FAILED"] as const) {
      const classification = classifyUsableLocalizedPresentation({
        locale: "uk",
        liveCanonicalVersion: version,
        canonicalPresentation: editorialCanonical,
        snapshot: {
          state,
          identity: {
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
            entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
            locale: "uk",
            canonicalVersion: version,
            localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
          },
          presentation: localizedEditorialPresentation(),
        },
      });
      assert.equal(classification.usability, "REBUILD_REQUIRED", state);
      assert.equal(classification.reason, "STATE_NOT_PUBLISHED", state);
      assert.equal(classification.allowPublishedLocalized, false, state);
    }
  });

  it("core invariant: PUBLISHED_LOCALIZED iff materializer may UNCHANGED_PLP", async () => {
    setPublishedLocalizationPersistenceModeForTests("memory");

    // Unusable → must not UNCHANGED
    seedLegacyPublishedWithoutIntegrity();
    const badResolve = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    const badDry = await runMediaPlpMaterializer(
      [
        "node",
        "materialize",
        "--mongo",
        "--entity-type",
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "--entity-id",
        MEDIA_PLP_EDITORIAL_ENTITY_ID,
        "--locale",
        "uk",
      ],
      materializerDeps(),
    );
    assert.notEqual(badResolve.mode, "PUBLISHED_LOCALIZED");
    assert.notEqual(badDry.report!.LOCALIZATION_SOURCE, "UNCHANGED_PLP");

    // Usable → may UNCHANGED
    resetPublishedLocalizationPersistenceForTests();
    resetMediaPlpResolveCacheForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");
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

    const goodResolve = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    const goodDry = await runMediaPlpMaterializer(
      [
        "node",
        "materialize",
        "--mongo",
        "--entity-type",
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "--entity-id",
        MEDIA_PLP_EDITORIAL_ENTITY_ID,
        "--locale",
        "uk",
      ],
      materializerDeps(),
    );
    assert.equal(goodResolve.mode, "PUBLISHED_LOCALIZED");
    assert.equal(goodDry.report!.LOCALIZATION_SOURCE, "UNCHANGED_PLP");
    assert.equal(goodDry.report!.WOULD_CALL_PROVIDER, false);
    assert.equal(goodDry.report!.WOULD_PUBLISH_PLP, false);
    assert.equal(goodDry.report!.EXISTING_PLP_USABILITY, "USABLE_LOCALIZED");
    assert.equal(goodDry.report!.REBUILD_REQUIRED, false);
  });

  it("CT completeness alone is insufficient — must pass CLI.1 + LSI.1", () => {
    const incomplete = translationValuesPassLocalizationIntegrity({
      locale: "uk",
      canonicalPresentation: editorialCanonical,
      values: { overviewTitle: "Огляд" },
    });
    assert.equal(incomplete.ok, false);

    const complete = translationValuesPassLocalizationIntegrity({
      locale: "uk",
      canonicalPresentation: editorialCanonical,
      values: ukEditorialValues(),
    });
    assert.equal(complete.ok, true);
  });

  it("atomic replacement of invalid current → new usable PUBLISHED_LOCALIZED", async () => {
    setPublishedLocalizationPersistenceModeForTests("memory");
    seedLegacyPublishedWithoutIntegrity({
      snapshotId: "invalid-current",
      contentRevision: 1,
    });

    const before = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(before.mode, "CANONICAL_FALLBACK");

    const executed = await runMediaPlpMaterializer(
      [
        "node",
        "materialize",
        "--mongo",
        "--entity-type",
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "--entity-id",
        MEDIA_PLP_EDITORIAL_ENTITY_ID,
        "--locale",
        "uk",
        "--execute",
      ],
      {
        ...materializerDeps({ translationComplete: true }),
        publish: publishMediaPlpEntity,
      },
    );
    assert.equal(executed.exitCode, 0);
    assert.equal(executed.report!.LOCALIZATION_SOURCE, "EXISTING_CURRENT");
    assert.equal(executed.report!.PLP_OUTCOME, "PUBLISHED");
    assert.equal(executed.report!.WOULD_CALL_PROVIDER, false);

    const prior = findPublishedSnapshotByIdMemory("invalid-current");
    assert.ok(prior);
    assert.equal(prior!.state, "SUPERSEDED");

    resetMediaPlpResolveCacheForTests();
    const after = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      liveCanonicalVersion: version,
      canonicalPresentation: editorialCanonical,
    });
    assert.equal(after.mode, "PUBLISHED_LOCALIZED");
    assert.ok(after.snapshotId);
    assert.notEqual(after.snapshotId, "invalid-current");
  });

  it("candidate build remains gated by CLI.1 + LSI.1", () => {
    const built = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: version,
      canonicalPresentation: editorialCanonical,
      layers: [{ source: "MACHINE", values: ukEditorialValues() }],
      includeDeterministicMachine: false,
    });
    assert.equal(built.validation.status, "READY_TO_PUBLISH");
  });
});
