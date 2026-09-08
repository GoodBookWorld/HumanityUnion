/**
 * RESET 05D.7 — Editorial canonical-version authority closure.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  buildProviderOwnedMachinePayload,
  reassembleBrandSlotPlans,
} from "@hu/types";

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
  enqueueCivicMediaEditorialPlpBuilds,
  ensureMediaPlpAdapterRegistered,
  findCurrentPublishedMemory,
  isCollectedPathMachineEligible,
  isPlpBuildStaleAgainstLive,
  listPlpAutoBuildWorkForTests,
  mapBuildStatusToFailure,
  markPlpAutoBuildWorkFailed,
  mergeLocalizedLayersByProvenance,
  processPlpBuildRequest,
  publishAtomicMemory,
  publishPublishedLocalizedPresentation,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveFieldPolicyForEntityType,
  runUniversalPlpBuild,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  printMediaLiveClosureReport,
  runMediaLiveClosureDiagnostic,
  type MediaLiveClosureReport,
} from "../../../src/modules/language/media-plp-carousel/media-live-closure-diagnostic.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import { mediaPlpDomainAdapter } from "../../../src/modules/language/published-localized-presentation/universal/adapters/media-plp-adapter.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const LIVE_VERSION = "v-2dd8a2b73768d26f";
const EDITORIAL_ID = mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID);

function editorialTree() {
  return asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
}

function machineValuesFor(
  tree: ReturnType<typeof editorialTree>,
  locale = "uk",
): Record<string, string> {
  const fieldPolicy = resolveFieldPolicyForEntityType(
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
  );
  const values: Record<string, string> = {};
  for (const node of collectAutoPaths(tree)) {
    if (!isCollectedPathMachineEligible(node.path, fieldPolicy)) {
      continue;
    }
    values[node.path] = `[${locale}] ${node.value}`;
  }
  return values;
}

function emptyDiagReport(): MediaLiveClosureReport {
  return {
    pack: "RESET_05D",
    operation: "diagnose_media_live_closure",
    readOnly: true,
    PROVIDER_CALLS_FROM_READ: 0,
    PLP_WRITES_FROM_READ: 0,
    MONGO_WRITES_FROM_READ: 0,
    PLP_PERSISTENCE_MODE: "MONGO",
    locale: "uk",
    countryCode: "UA",
    MEDIA_RSS_TOTAL: 0,
    MEDIA_RSS_LOCALIZED: 0,
    MEDIA_RSS_FALLBACK: 0,
    COUNTRY_RSS_TOTAL: 0,
    COUNTRY_AFFILIATED_SOURCE_COUNT: 0,
    COUNTRY_AFFILIATED_SOURCE_IDS: [],
    COUNTRY_AFFILIATED_CURRENT_NEWS: 0,
    COUNTRY_RELEVANT_COUNT: 0,
    COUNTRY_RELEVANT_INCLUDED: 0,
    COUNTRY_RELEVANT_EXCLUDED: 0,
    COUNTRY_GLOBAL_SUPPLEMENT_COUNT: 0,
    COUNTRY_SOURCE_COVERAGE_GAP: false,
    EDITORIAL_MODE: "CANONICAL_FALLBACK",
    EDITORIAL_CANONICAL_LEAVES: 0,
    EDITORIAL_CURRENT_CANONICAL_VERSION: LIVE_VERSION,
    EDITORIAL_WORK_ROW_FOUND: true,
    EDITORIAL_WORK_STATUS: "failed",
    EDITORIAL_FAILURE_CODE: "STALE_CANONICAL_VERSION",
    EDITORIAL_FAILURE_STAGE: "validate",
    EDITORIAL_FAILURE_REASON_SAFE:
      "STALE_CANONICAL_VERSION;STALE_REVISION;STALE_WORK_VERSION=v-a;STALE_CURRENT_SOURCE_VERSION=v-b;STALE_BOUNDARY=publish_cas_content_revision;STALE_AUTHORITY=publishAtomicMemory",
    EDITORIAL_WORK_CANONICAL_VERSION: LIVE_VERSION,
    EDITORIAL_ATTEMPT_COUNT: 1,
    EDITORIAL_MAX_ATTEMPTS: 3,
    EDITORIAL_RETRYABLE: false,
    EDITORIAL_SNAPSHOT_FOUND: false,
    EDITORIAL_SNAPSHOT_CANONICAL_VERSION: null,
    EDITORIAL_SNAPSHOT_SCHEMA_VERSION: null,
    EDITORIAL_SNAPSHOT_USABLE: false,
    EDITORIAL_RESOLVER_MODE: "CANONICAL_FALLBACK",
    EDITORIAL_RESOLVER_FALLBACK_REASON: null,
    EDITORIAL_WORK_TRIGGER: "ADMIN_REBUILD",
    EDITORIAL_PARTIAL_AUTO_PATHS: [],
    EDITORIAL_CANONICAL_IDENTICAL_TRANSLATABLE_PATHS: [],
    EDITORIAL_INTEGRITY_FAILED_PATHS: [],
    EDITORIAL_BRAND_TOKEN_PATH_STATES: [],
    EDITORIAL_STALE_WORK_VERSION: "v-a",
    EDITORIAL_STALE_CURRENT_SOURCE_VERSION: "v-b",
    EDITORIAL_STALE_BOUNDARY: "publish_cas_content_revision",
    EDITORIAL_STALE_AUTHORITY: "publishAtomicMemory",
    FAQ_MACHINE_LEAVES: 0,
    FAQ_MACHINE_LOCALIZED: 0,
    FAQ_CANONICAL_MACHINE_LEAVES: 0,
    FAQ_BRAND_TOKENS: 0,
    FAQ_BRAND_RESOLVED: 0,
    MIXED_SEMANTIC_OWNERSHIP: 0,
    IDENTITY_MISMATCHES: 0,
    CONSUMER_BYPASSES: 0,
    ok: false,
    mediaRssRows: [],
    leaves: [],
  };
}

beforeEach(() => {
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  ensureMediaPlpAdapterRegistered();
});

afterEach(() => {
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
});

describe("RESET 05D.7 — canonical-version authority", () => {
  it("1: identical canonical source → same version across diagnostic/enqueue/adapter/candidate/publish", async () => {
    const tree = editorialTree();
    const fingerprint = fingerprintMediaPlpCanonicalVersion(tree);
    assert.equal(fingerprint, LIVE_VERSION);

    const enqueued = await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    assert.equal(enqueued.canonicalVersion, fingerprint);

    const contract = await mediaPlpDomainAdapter.resolveCanonicalEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
    });
    assert.ok(contract);
    assert.equal(contract!.canonicalVersion, fingerprint);

    const values = machineValuesFor(tree);
    const built = await runUniversalPlpBuild({
      contract: contract!,
      liveCanonicalVersion: fingerprint,
      layers: [{ source: "MACHINE", values }],
    });
    assert.equal(built.status, "COMPLETED");
    const current = findCurrentPublishedMemory({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
    });
    assert.equal(current?.identity.canonicalVersion, fingerprint);
  });

  it("2: Brand segmentation does not alter canonicalVersion", () => {
    const tree = editorialTree();
    const before = fingerprintMediaPlpCanonicalVersion(tree);
    const fieldPolicy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    const autoValues: Record<string, string> = {};
    for (const node of collectAutoPaths(tree)) {
      if (isCollectedPathMachineEligible(node.path, fieldPolicy)) {
        autoValues[node.path] = node.value;
      }
    }
    const { payload, plans } = buildProviderOwnedMachinePayload(autoValues);
    const reassembled = reassembleBrandSlotPlans({
      plans,
      translatedSegments: payload,
    });
    assert.ok(Object.keys(payload).length > 0);
    assert.ok(Object.keys(reassembled.values).length > 0);
    assert.equal(fingerprintMediaPlpCanonicalVersion(tree), before);
  });

  it("3: translated prose does not alter canonicalVersion", () => {
    const tree = editorialTree();
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    const values = machineValuesFor(tree, "uk");
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values, appliedAt: "2026-09-07T00:00:00.000Z" }],
    });
    assert.notEqual(JSON.stringify(merged.presentation), JSON.stringify(tree));
    assert.equal(fingerprintMediaPlpCanonicalVersion(tree), version);
  });

  it("4: old published snapshot with higher contentRevision does not stale new canonical work", async () => {
    const tree = editorialTree();
    const values = machineValuesFor(tree);
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values, appliedAt: "2026-09-07T00:00:00.000Z" }],
    });

    const old = publishAtomicMemory({
      candidate: {
        snapshotId: "old-editorial",
        identity: {
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: EDITORIAL_ID,
          locale: "uk",
          canonicalVersion: "v-c14c759d8836db89",
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
    assert.equal(old.ok, true);

    const advanced = await publishPublishedLocalizedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
      canonicalVersion: LIVE_VERSION,
      contentRevision: 1,
      canonicalPresentation: tree,
      localizedCandidate: merged.presentation,
      provenance: merged.provenance,
      snapshotId: "new-editorial",
    });
    assert.equal(advanced.ok, true);
    const current = findCurrentPublishedMemory({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
    });
    assert.equal(current?.identity.canonicalVersion, LIVE_VERSION);
    assert.equal(current?.contentRevision, 10);
  });

  it("5: actual canonical source mutation supersedes old work at claim", async () => {
    assert.equal(
      isPlpBuildStaleAgainstLive({
        buildTargetCanonicalVersion: "v-old",
        liveCanonicalVersion: LIVE_VERSION,
      }),
      true,
    );
    const result = await processPlpBuildRequest({
      workKey: "editorial:stale",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: EDITORIAL_ID,
      locale: "uk",
      canonicalVersion: "v-old",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
      enqueuedAt: new Date().toISOString(),
      status: "RUNNING",
    });
    assert.equal(result.status, "FAILED");
    assert.equal(result.failure?.failureCode, "STALE_CANONICAL_VERSION");
    assert.match(result.failure?.safeReason ?? "", /STALE_WORK_VERSION=v-old/);
    assert.match(
      result.failure?.safeReason ?? "",
      new RegExp(`STALE_CURRENT_SOURCE_VERSION=${LIVE_VERSION}`),
    );
    assert.match(result.failure?.safeReason ?? "", /STALE_BOUNDARY=claim_source_reload/);
  });

  it("6: stale failure records both compared versions and boundary", () => {
    const failure = mapBuildStatusToFailure({
      status: "FAILED",
      reasonCodes: [
        "STALE_REVISION",
        "STALE_WORK_VERSION=v-work",
        "STALE_CURRENT_SOURCE_VERSION=v-live",
        "STALE_BOUNDARY=publish_cas_content_revision",
        "STALE_AUTHORITY=publishAtomicMemory",
      ],
    });
    assert.equal(failure.failureCode, "STALE_CANONICAL_VERSION");
    assert.match(failure.safeReason, /STALE_WORK_VERSION=v-work/);
    assert.match(failure.safeReason, /STALE_CURRENT_SOURCE_VERSION=v-live/);
    assert.match(failure.safeReason, /STALE_BOUNDARY=publish_cas_content_revision/);
    assert.match(failure.safeReason, /STALE_AUTHORITY=publishAtomicMemory/);
  });

  it("7: CAS still rejects genuinely stale same-version lower revision", async () => {
    const tree = editorialTree();
    const values = machineValuesFor(tree);
    const merged = mergeLocalizedLayersByProvenance({
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values, appliedAt: "2026-09-07T00:00:00.000Z" }],
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
      assert.ok(stale.reasonCodes.some((c) => c.startsWith("STALE_WORK_VERSION=")));
      assert.ok(
        stale.reasonCodes.some((c) => c.startsWith("STALE_CURRENT_SOURCE_VERSION=")),
      );
      assert.ok(
        stale.reasonCodes.includes("STALE_BOUNDARY=publish_cas_content_revision"),
      );
    }
  });

  it("8: diagnostic is read-only and prints stale forensics fields", async () => {
    const result = await runMediaLiveClosureDiagnostic(
      { locale: "uk", countryCode: "UA", countryName: "Ukraine", regionName: "" },
      {
        isMongoConfigured: () => true,
        requirePersistence: () => ({
          PLP_PERSISTENCE_MODE: "MONGO",
          PLP_CURRENT_COLLECTION: "published_localized_presentations_current",
          PLP_HISTORY_COLLECTION: "published_localized_presentations_history",
          PLP_READ_DATABASE: "humanity_union_staging",
          PLP_WRITE_DATABASE: "humanity_union_staging",
        }),
        connect: async () => undefined,
        disconnect: async () => undefined,
        executeReads: async () => emptyDiagReport(),
      },
    );
    assert.ok(result.report);
    assert.equal(result.report!.readOnly, true);
    assert.equal(result.report!.PROVIDER_CALLS_FROM_READ, 0);
    assert.equal(result.report!.PLP_WRITES_FROM_READ, 0);
    assert.equal(result.report!.MONGO_WRITES_FROM_READ, 0);
    assert.equal(result.report!.EDITORIAL_STALE_WORK_VERSION, "v-a");
    assert.equal(result.report!.EDITORIAL_STALE_CURRENT_SOURCE_VERSION, "v-b");

    const chunks: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      chunks.push(args.map(String).join(" "));
    };
    try {
      printMediaLiveClosureReport(result.report!);
    } finally {
      console.log = original;
    }
    const printed = chunks.join("\n");
    assert.match(printed, /EDITORIAL_STALE_WORK_VERSION=v-a/);
    assert.match(printed, /EDITORIAL_STALE_CURRENT_SOURCE_VERSION=v-b/);
    assert.match(printed, /EDITORIAL_STALE_BOUNDARY=publish_cas_content_revision/);
    assert.match(printed, /EDITORIAL_STALE_AUTHORITY=publishAtomicMemory/);
  });

  it("9–10: Country untouched; PLP atomicity path still CAS-gated", () => {
    const countrySrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.match(countrySrc, /COUNTRY_RELEVANT_EXCLUDED/);
    assert.match(countrySrc, /COUNTRY_SOURCE_COVERAGE_GAP/);

    const mongoSrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/persistence/mongo.repository.ts",
      ),
      "utf8",
    );
    assert.match(
      mongoSrc,
      /contentRevision CAS applies only within the same canonicalVersion/,
    );
    assert.match(mongoSrc, /New canonical source must supersede old pointer/);
  });

  it("targeted heal reopens failed editorial at current canonical version", async () => {
    const version = fingerprintMediaPlpCanonicalVersion(editorialTree());
    await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    const work = listPlpAutoBuildWorkForTests().find(
      (w) =>
        w.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL &&
        w.locale === "uk",
    );
    assert.ok(work);
    await markPlpAutoBuildWorkFailed({
      workKey: work!.workKey,
      attempts: 1,
      maxAttempts: work!.maxAttempts,
      failure: mapBuildStatusToFailure({
        status: "FAILED",
        reasonCodes: [
          "STALE_REVISION",
          `STALE_WORK_VERSION=${version}`,
          `STALE_CURRENT_SOURCE_VERSION=${version}`,
          "STALE_BOUNDARY=publish_cas_content_revision",
          "STALE_AUTHORITY=publishAtomicMemory",
        ],
      }),
    });

    const healed = await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    assert.equal(healed.canonicalVersion, version);
    assert.equal(healed.enqueued, 1);
    const pending = listPlpAutoBuildWorkForTests().find(
      (w) => w.workKey === work!.workKey,
    );
    assert.equal(pending?.status, "pending");
    assert.equal(pending?.canonicalVersion, version);
    assert.equal(pending?.attempts, 0);
  });

  it("single fingerprint authority: adapter/enqueue/diagnostic share fingerprintMediaPlpCanonicalVersion", () => {
    const adapterSrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/adapters/media-plp-adapter.ts",
      ),
      "utf8",
    );
    const enqueueSrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/editorial-build-trigger.ts",
      ),
      "utf8",
    );
    const diagSrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.match(adapterSrc, /fingerprintMediaPlpCanonicalVersion/);
    assert.match(enqueueSrc, /fingerprintMediaPlpCanonicalVersion/);
    assert.match(diagSrc, /fingerprintMediaPlpCanonicalVersion/);
    assert.doesNotMatch(adapterSrc, /createHash\(/);
    assert.doesNotMatch(enqueueSrc, /createHash\(/);
  });
});
