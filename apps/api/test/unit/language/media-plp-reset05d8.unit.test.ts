/**
 * RESET 05D.8 — STALE_REVISION origin closure + Editorial live regression.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
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
import {
  PLP_STALE_ORIGIN,
  PLP_STALE_ORIGIN_INVENTORY,
  encodePlpStructuredStaleSafeReason,
  enqueueCivicMediaEditorialPlpBuilds,
  ensureMediaPlpAdapterRegistered,
  findCurrentPublishedMemory,
  isBareStaleRevisionReason,
  isCollectedPathMachineEligible,
  listPlpAutoBuildWorkForTests,
  mapBuildStatusToFailure,
  markPlpAutoBuildWorkFailed,
  mergeLocalizedLayersByProvenance,
  parsePlpStructuredStaleFromSafeReason,
  processPlpBuildRequest,
  publishAtomicMemory,
  publishPublishedLocalizedPresentation,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveFieldPolicyForEntityType,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";

const LIVE_VERSION = "v-2dd8a2b73768d26f";
const OLD_SNAPSHOT_VERSION = "v-c14c759d8836db89";
const EDITORIAL_ID = mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID);

function editorialTree() {
  return asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
}

function machineValuesFor(tree: ReturnType<typeof editorialTree>) {
  const fieldPolicy = resolveFieldPolicyForEntityType(
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
  );
  const values: Record<string, string> = {};
  for (const node of collectAutoPaths(tree)) {
    if (!isCollectedPathMachineEligible(node.path, fieldPolicy)) {
      continue;
    }
    values[node.path] = `[uk] ${node.value}`;
  }
  return values;
}

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
  resetMediaPlpMaterializerCountersForTests();
});

describe("RESET 05D.8 — STALE_REVISION origin closure", () => {
  it("origin inventory is exhaustive and testable", () => {
    assert.equal(PLP_STALE_ORIGIN_INVENTORY.length, 6);
    const ids = new Set(PLP_STALE_ORIGIN_INVENTORY.map((o) => o.ORIGIN_ID));
    assert.ok(ids.has(PLP_STALE_ORIGIN.CLAIM_SOURCE_RELOAD));
    assert.ok(ids.has(PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION));
    assert.ok(ids.has(PLP_STALE_ORIGIN.PUBLISH_ATOMIC_MAPPER));
    assert.ok(ids.has(PLP_STALE_ORIGIN.MAP_BUILD_STATUS));
    for (const row of PLP_STALE_ORIGIN_INVENTORY) {
      assert.equal(row.METADATA_PASSTHROUGH, true);
    }
  });

  it("live regression: old snapshot rev>1 + new Editorial work rev=1 publishes via processPlpBuildRequest", async () => {
    const tree = editorialTree();
    assert.equal(fingerprintMediaPlpCanonicalVersion(tree), LIVE_VERSION);
    const values = machineValuesFor(tree);
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values, appliedAt: "2026-09-08T00:00:00.000Z" }],
    });

    const seeded = publishAtomicMemory({
      candidate: {
        snapshotId: "old-live-editorial",
        identity: {
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: EDITORIAL_ID,
          locale: "uk",
          canonicalVersion: OLD_SNAPSHOT_VERSION,
          localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        },
        state: "PUBLISHED",
        contentRevision: 9,
        presentation: merged.presentation,
        provenance: merged.provenance,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    assert.equal(seeded.ok, true);

    const result = await processPlpBuildRequest(
      {
        workKey: "editorial:live-regression",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: EDITORIAL_ID,
        locale: "uk",
        canonicalVersion: LIVE_VERSION,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        enqueuedAt: new Date().toISOString(),
        status: "RUNNING",
      },
      {
        importProvider: async () => ({
          provider: new FakeLocalMediaPlpTransport({}),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
        verifyDurability: async () => ({ ok: true }),
      },
    );
    assert.equal(result.status, "COMPLETED", result.failure?.safeReason);

    const current = findCurrentPublishedMemory({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
    });
    assert.equal(current?.identity.canonicalVersion, LIVE_VERSION);
    assert.equal(current?.contentRevision, 10);
  });

  it("same canonicalVersion with higher existing revision is STALE with origin metadata", async () => {
    const tree = editorialTree();
    const values = machineValuesFor(tree);
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values, appliedAt: "2026-09-08T00:00:00.000Z" }],
    });
    const first = await publishPublishedLocalizedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
      canonicalVersion: LIVE_VERSION,
      contentRevision: 5,
      canonicalPresentation: tree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "rev5",
    });
    assert.equal(first.ok, true);

    const stale = await publishPublishedLocalizedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
      canonicalVersion: LIVE_VERSION,
      contentRevision: 1,
      canonicalPresentation: tree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "rev1",
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.outcome, "STALE_REVISION");
      const joined = stale.reasonCodes.join(";");
      const parsed = parsePlpStructuredStaleFromSafeReason(joined);
      assert.ok(parsed);
      assert.equal(parsed!.originId, PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION);
      assert.equal(parsed!.workCanonicalVersion, LIVE_VERSION);
      assert.equal(parsed!.currentSourceCanonicalVersion, LIVE_VERSION);
      assert.equal(parsed!.candidateContentRevision, 1);
      assert.equal(parsed!.existingContentRevision, 5);
      assert.equal(isBareStaleRevisionReason(joined), false);
    }

    const mapped = mapBuildStatusToFailure({
      status: "FAILED",
      reasonCodes: !stale.ok ? stale.reasonCodes : [],
    });
    assert.equal(mapped.failureCode, "STALE_CANONICAL_VERSION");
    assert.equal(isBareStaleRevisionReason(mapped.safeReason), false);
    assert.match(mapped.safeReason, /STALE_ORIGIN_ID=publish_cas_content_revision/);
  });

  it("canonical source mutation during claim is structured stale, not bare STALE_REVISION", async () => {
    const result = await processPlpBuildRequest({
      workKey: "editorial:mutated",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
      canonicalVersion: "v-old-work",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      enqueuedAt: new Date().toISOString(),
      status: "RUNNING",
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.failure?.failureCode, "STALE_CANONICAL_VERSION");
    assert.equal(isBareStaleRevisionReason(result.failure?.safeReason), false);
    const parsed = parsePlpStructuredStaleFromSafeReason(result.failure?.safeReason);
    assert.ok(parsed);
    assert.equal(parsed!.originId, PLP_STALE_ORIGIN.CLAIM_SOURCE_RELOAD);
    assert.equal(parsed!.workCanonicalVersion, "v-old-work");
    assert.equal(parsed!.currentSourceCanonicalVersion, LIVE_VERSION);
  });

  it("durable failure rejects bare STALE_REVISION and forces origin fields", async () => {
    await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    const work = listPlpAutoBuildWorkForTests().find(
      (w) =>
        w.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL &&
        w.locale === "uk",
    );
    assert.ok(work);

    // Simulate pre-05D.7 / live-compatible bare reason.
    await markPlpAutoBuildWorkFailed({
      workKey: work!.workKey,
      attempts: 1,
      maxAttempts: work!.maxAttempts,
      failure: {
        failureCode: "STALE_CANONICAL_VERSION",
        retryable: false,
        stage: "validate",
        safeReason: "STALE_REVISION",
      },
    });
    const failed = listPlpAutoBuildWorkForTests().find((w) => w.workKey === work!.workKey);
    assert.equal(failed?.status, "failed");
    assert.equal(isBareStaleRevisionReason(failed?.lastError), false);
    assert.match(failed?.lastError ?? "", /STALE_ORIGIN_ID=/);
    assert.match(failed?.lastError ?? "", /STALE_WORK_VERSION=/);
    assert.match(failed?.lastError ?? "", /STALE_CURRENT_SOURCE_VERSION=/);
    assert.match(failed?.lastError ?? "", /STALE_BOUNDARY=/);
    assert.match(failed?.lastError ?? "", /STALE_AUTHORITY=/);
  });

  it("mapBuildStatusToFailure never emits bare STALE_REVISION (pre-05D.7 live shape)", () => {
    const failure = mapBuildStatusToFailure({
      status: "FAILED",
      reasonCodes: ["STALE_REVISION"],
    });
    assert.equal(failure.failureCode, "STALE_CANONICAL_VERSION");
    assert.notEqual(failure.safeReason, "STALE_REVISION");
    assert.equal(isBareStaleRevisionReason(failure.safeReason), false);
    assert.match(failure.safeReason, /STALE_ORIGIN_ID=/);
    assert.match(failure.safeReason, /STALE_WORK_VERSION=UNKNOWN/);
  });

  it("encode/parse round-trip preserves structured contract", () => {
    const encoded = encodePlpStructuredStaleSafeReason({
      code: "STALE_CANONICAL_VERSION",
      reason: "STALE_REVISION",
      originId: PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION,
      boundary: PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION,
      authority: "publishAtomicMemory",
      workCanonicalVersion: LIVE_VERSION,
      currentSourceCanonicalVersion: LIVE_VERSION,
      candidateContentRevision: 1,
      existingContentRevision: 9,
    });
    const parsed = parsePlpStructuredStaleFromSafeReason(encoded);
    assert.ok(parsed);
    assert.equal(parsed!.originId, PLP_STALE_ORIGIN.PUBLISH_CAS_CONTENT_REVISION);
    assert.equal(parsed!.candidateContentRevision, 1);
    assert.equal(parsed!.existingContentRevision, 9);
  });

  it("targeted heal reopens failed editorial at current version", async () => {
    await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    const work = listPlpAutoBuildWorkForTests().find(
      (w) => w.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(work);
    await markPlpAutoBuildWorkFailed({
      workKey: work!.workKey,
      attempts: 1,
      maxAttempts: work!.maxAttempts,
      failure: mapBuildStatusToFailure({
        status: "FAILED",
        reasonCodes: ["STALE_REVISION"],
      }),
    });
    const healed = await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    assert.equal(healed.canonicalVersion, LIVE_VERSION);
    assert.equal(healed.enqueued, 1);
    const pending = listPlpAutoBuildWorkForTests().find((w) => w.workKey === work!.workKey);
    assert.equal(pending?.status, "pending");
    assert.equal(pending?.attempts, 0);
  });
});
