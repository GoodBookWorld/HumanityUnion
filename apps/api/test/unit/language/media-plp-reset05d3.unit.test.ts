/**
 * RESET 05D.3 — editorial path-exact ownership + validator closure.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  BRAND_SITE_NAME_TOKEN,
} from "@hu/types";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  flattenStructuredLocalizationValues,
  validateMediaPlpProviderLocalizationValues,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import {
  ensureMediaPlpAdapterRegistered,
  inventoryPresentationPathAuthority,
  isCollectedPathMachineEligible,
  mergeLocalizedLayersByProvenance,
  processPlpBuildRequest,
  resolveCollectedPathOwnership,
  resolveFieldPolicyForEntityType,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
  validatePublishedBuildResult,
  enqueueCivicMediaEditorialPlpBuilds,
  setPlpAutoBuildWorkForceMemoryForTests,
  resetPlpAutoBuildWorkStoreForTests,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
  enqueuePlpBuildRequest,
} from "../../../src/modules/language/published-localized-presentation/index.js";

beforeEach(() => {
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetMediaPlpMaterializerCountersForTests();
  ensureMediaPlpAdapterRegistered();
});

afterEach(() => {
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
});

describe("RESET 05D.3 — editorial path-exact ownership", () => {
  it("reproduces live REJECTED_PARTIAL path set when only overviewTitle/Summary are MACHINE", () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    assert.equal(fingerprintMediaPlpCanonicalVersion(tree), "v-2dd8a2b73768d26f");
    const fieldPolicy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: tree,
      layers: [
        {
          source: "MACHINE",
          values: {
            overviewTitle: `[uk] ${CIVIC_MEDIA_OVERVIEW.title}`,
            overviewSummary: `[uk] ${CIVIC_MEDIA_OVERVIEW.summary}`,
          },
          appliedAt: "2026-09-07T00:00:00.000Z",
        },
      ],
    });
    const validation = validatePublishedBuildResult({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: mediaPlpEditorialEntityId(),
      locale: "uk",
      canonicalVersion: "v-2dd8a2b73768d26f",
      buildTargetCanonicalVersion: "v-2dd8a2b73768d26f",
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: tree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      fieldPolicy,
    });
    assert.equal(validation.status, "NOT_READY");
    assert.ok(validation.reasonCodes.includes("PARTIAL_AUTO_NODES"));
    assert.ok(
      validation.reasonCodes.includes("LOCALIZATION_CONTENT_INTEGRITY_FAILED"),
    );
    assert.ok(
      validation.reasonCodes.includes("CANONICAL_IDENTICAL_TRANSLATABLE_VALUE"),
    );
    const expected = [
      "overviewPoints[0].heading",
      "overviewPoints[0].body",
      "overviewPoints[1].heading",
      "overviewPoints[1].body",
      "overviewPoints[2].heading",
      "overviewPoints[2].body",
      "faq[0].question",
      "faq[0].answer",
      "faq[1].question",
      "faq[1].answer",
      "faq[2].question",
      "faq[2].answer",
      "faq[3].question",
      "faq[3].answer",
      "faq[4].question",
      "faq[4].answer",
    ];
    for (const path of expected) {
      assert.ok(
        validation.pathDiagnostics.PARTIAL_AUTO_PATHS.includes(path),
        `missing PARTIAL path ${path}`,
      );
      assert.ok(
        validation.pathDiagnostics.CANONICAL_IDENTICAL_TRANSLATABLE_PATHS.includes(
          path,
        ),
        `missing IDENTICAL path ${path}`,
      );
    }
    assert.equal(validation.pathDiagnostics.PARTIAL_AUTO_PATHS.length, 16);
  });

  it("inventory: every semantic leaf classified; ids protected; FAQ brand tokens tagged", () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    const fieldPolicy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    const leaves = collectAutoPaths(tree);
    const inventory = inventoryPresentationPathAuthority({
      leaves,
      fieldPolicy,
      brandToken: BRAND_SITE_NAME_TOKEN,
    });
    assert.equal(inventory.TOTAL_SEMANTIC_LEAVES, 26);
    assert.equal(inventory.MACHINE_CONTENT_PATHS.length, 18);
    assert.equal(inventory.PROTECTED_PATHS.length, 8);
    assert.ok(inventory.BRAND_TOKEN_PATHS.length >= 4);
    assert.equal(inventory.OTHER_AUTHORITY_PATHS.length, 0);
    for (const path of inventory.PROTECTED_PATHS) {
      assert.ok(path.endsWith(".id"));
      assert.equal(isCollectedPathMachineEligible(path, fieldPolicy), false);
    }
    for (const path of inventory.MACHINE_CONTENT_PATHS) {
      assert.equal(isCollectedPathMachineEligible(path, fieldPolicy), true);
    }
  });

  it("after fix: full MACHINE set localizes and validates with zero path diagnostics", async () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    const fieldPolicy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    const result = await processPlpBuildRequest(
      {
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID),
        locale: "uk",
        canonicalVersion: version,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
      },
      {
        importProvider: async () => ({
          provider: new FakeLocalMediaPlpTransport({}),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
        verifyDurability: async () => ({ ok: true }),
      },
    );
    assert.equal(result.status, "COMPLETED");

    const values: Record<string, string> = {};
    for (const node of collectAutoPaths(tree)) {
      if (!isCollectedPathMachineEligible(node.path, fieldPolicy)) {
        continue;
      }
      values[node.path] = `[uk] ${node.value}`;
    }
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: tree,
      layers: [
        {
          source: "MACHINE",
          values,
          appliedAt: "2026-09-07T00:00:00.000Z",
        },
      ],
    });
    const validation = validatePublishedBuildResult({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: mediaPlpEditorialEntityId(),
      locale: "uk",
      canonicalVersion: version,
      buildTargetCanonicalVersion: version,
      localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      canonicalPresentation: tree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      fieldPolicy,
    });
    assert.equal(validation.status, "READY_TO_PUBLISH");
    assert.equal(validation.pathDiagnostics.PARTIAL_AUTO_PATHS.length, 0);
    assert.equal(
      validation.pathDiagnostics.CANONICAL_IDENTICAL_TRANSLATABLE_PATHS.length,
      0,
    );
    assert.equal(validation.pathDiagnostics.INTEGRITY_FAILED_PATHS.length, 0);
  });

  it("nested provider JSON flattens to faq[n].question paths", () => {
    const out: Record<string, string> = {};
    flattenStructuredLocalizationValues(
      {
        overviewTitle: "Огляд",
        faq: [{ question: "Питання?", answer: "Відповідь" }],
      },
      "",
      out,
    );
    assert.equal(out["faq[0].question"], "Питання?");
    assert.equal(out["faq[0].answer"], "Відповідь");
    assert.equal(out.overviewTitle, "Огляд");
  });

  it("wildcard ownership: faq[*].id never MACHINE; faq[*].question is", () => {
    const policy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.equal(
      resolveCollectedPathOwnership("faq[2].id", policy),
      "NON_LOCALIZABLE_DATA",
    );
    assert.equal(
      resolveCollectedPathOwnership("faq[2].question", policy),
      "MACHINE_CONTENT",
    );
    assert.equal(
      resolveCollectedPathOwnership("overviewPoints[1].heading", policy),
      "MACHINE_CONTENT",
    );
  });

  it("targeted current-version heal still reopens terminal failed editorial only", async () => {
    const enqueued = await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    const work = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(work);
    await markPlpAutoBuildWorkFailed({
      workKey: work!.workKey,
      attempts: 5,
      maxAttempts: 5,
      failure: {
        failureCode: "REJECTED_PARTIAL",
        retryable: false,
        stage: "validate",
        safeReason:
          "REJECTED_PARTIAL:PARTIAL_AUTO_NODES;PARTIAL_AUTO_PATHS=faq[0].question|faq[0].answer",
      },
    });
    const blocked = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: work!.entityId,
      locale: "uk",
      canonicalVersion: enqueued.canonicalVersion,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      reopenFailedSameVersion: false,
    });
    assert.equal(blocked.deduped, true);
    await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    const after = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(after);
    assert.ok(
      after!.status === "pending" ||
        after!.status === "skipped_usable" ||
        after!.status === "completed",
    );
  });

  it("Brand token loss still rejects provider values before publish", () => {
    const lost = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: {
        "faq[0].answer":
          "{siteName} curates sources that meet published selection principles.",
      },
      translated: {
        "faq[0].answer": "Союз Людяності відбирає джерела.",
      },
    });
    assert.equal(lost.ok, false);
    if (!lost.ok) {
      assert.equal(lost.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
    }
  });
});
