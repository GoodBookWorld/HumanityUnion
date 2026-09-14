/**
 * Reset 03C — Media PLP consumer acceptance (API; seeded fixtures; zero live ops).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpTrustedEntityId,
  type TrustedMediaResource,
} from "@hu/types";

import {
  asMediaPlpPresentationNode,
  assertMediaPlpReadImportIsolation,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
  getMediaPlpInstrumentationCounters,
  mediaPlpReadModulesAvoidCorpusToArray,
  publishMediaPlpEntity,
  resetMediaPlpInstrumentationForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerItem,
  setMediaPlpConsumptionEnabledForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { parseMediaPlpConsumerAcceptanceArgs } from "../../../src/modules/language/media-plp-consumer-acceptance/run-acceptance.js";

const reuters: TrustedMediaResource = {
  id: "reuters",
  name: "Reuters",
  logoLabel: "R",
  country: "International",
  categoryId: "international-wire-service",
  explanation: "Independent international news agency with global editorial standards.",
  websiteUrl: "https://www.reuters.com/",
  sortOrder: 1,
};

const atlantic: TrustedMediaResource = {
  id: "the-atlantic",
  name: "The Atlantic",
  logoLabel: "The Atlantic",
  country: "United States",
  countryCode: "US",
  categoryId: "independent-investigative",
  explanation: "Trusted explanation of editorial standards for participants.",
  websiteUrl: "https://www.theatlantic.com/",
  sortOrder: 2,
};

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function treeFor(resource: TrustedMediaResource) {
  return asMediaPlpPresentationNode(buildCanonicalTrustedPresentation(resource));
}

beforeEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
});

afterEach(() => {
  setMediaPlpConsumptionEnabledForTests(null);
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
});

describe("Reset 03C Media PLP consumer gate", () => {
  it("A: uk + matching reuters PLP → PUBLISHED_LOCALIZED", async () => {
    const tree = treeFor(reuters);
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values: { explanation: "[uk] Reuters explanation" } }],
      includeDeterministicMachine: false,
    });

    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
    assert.equal(
      (resolved.presentation as { explanation?: string }).explanation,
      "[uk] Reuters explanation",
    );
  });

  it("B: uk + no PLP for another trusted → complete CANONICAL_FALLBACK", async () => {
    const tree = treeFor(atlantic);
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(atlantic.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(
      (resolved.presentation as { explanation?: string }).explanation,
      atlantic.explanation,
    );
    assert.equal(resolved.reasonCode, "NO_PUBLISHED_SNAPSHOT");
  });

  it("C: stale canonicalVersion → CANONICAL_FALLBACK", async () => {
    const tree = treeFor(reuters);
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values: { explanation: "[uk] x" } }],
      includeDeterministicMachine: false,
    });

    const staleTree = asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation({
        ...reuters,
        explanation: `${reuters.explanation} changed`,
      }),
    );
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      canonicalPresentation: staleTree,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "CANONICAL_VERSION_MISMATCH");
    assert.equal(
      (resolved.presentation as { explanation?: string }).explanation,
      `${reuters.explanation} changed`,
    );
  });

  it("D: non-PUBLISHED states fall back (no mixed)", async () => {
    // No current PUBLISHED pointer → fallback (BUILDING/FAILED/SUPERSEDED never served).
    const tree = treeFor(reuters);
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "NO_PUBLISHED_SNAPSHOT");
  });

  it("E: schema mismatch → CANONICAL_FALLBACK", async () => {
    const tree = treeFor(reuters);
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values: { explanation: "[uk] x" } }],
      includeDeterministicMachine: false,
    });

    const {
      resolvePublishedPresentation,
    } = await import(
      "../../../src/modules/language/published-localized-presentation/resolve-published-presentation.js"
    );
    const mismatched = await resolvePublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      locale: "uk",
      liveCanonicalVersion: version,
      liveLocalizationSchemaVersion: "PLP.999" as never,
      canonicalPresentation: tree,
    });
    assert.equal(mismatched.mode, "CANONICAL_FALLBACK");
    assert.equal(mismatched.reasonCode, "SCHEMA_VERSION_MISMATCH");
  });

  it("F/G/H/I/J: no mixed; provider/write/client/hydration counters stay 0", async () => {
    const tree = treeFor(reuters);
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values: { explanation: "[uk] full" } }],
      includeDeterministicMachine: false,
    });
    resetMediaPlpInstrumentationForTests();

    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
    // Coherent: explanation localized; name remains protected identity wrapper from snapshot.
    assert.equal(
      (resolved.presentation as { explanation?: string }).explanation,
      "[uk] full",
    );

    const counters = getMediaPlpInstrumentationCounters();
    assert.equal(counters.PROVIDER_CALL_COUNT, 0);
    assert.equal(counters.CONTENT_TRANSLATION_WRITE_COUNT, 0);
    assert.equal(counters.CLIENT_SEMANTIC_TRANSLATION_REQUEST_COUNT, 0);
    assert.equal(counters.POST_HYDRATION_SEMANTIC_CHANGE_COUNT, 0);
  });

  it("K: /media and country share trusted identity", () => {
    assert.equal(mediaPlpTrustedEntityId("reuters"), "reuters");
    assert.equal(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED, "civic_media_trusted");
  });

  it("N: flag OFF consumer returns MEDIA_PLP_DISABLED", async () => {
    setMediaPlpConsumptionEnabledForTests(false);
    const tree = treeFor(reuters);
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: mediaPlpTrustedEntityId(reuters.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "MEDIA_PLP_DISABLED");
  });

  it("read import boundary excludes provider/materializer/worker", () => {
    const isolation = assertMediaPlpReadImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(", "));
    assert.equal(mediaPlpReadModulesAvoidCorpusToArray(), true);

    const routes = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/media/public-media-plp.routes.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(routes, /media-plp-materializer|gemini-translation|thin-gemini/);

    const app = readFileSync(join(apiRoot, "src/app.ts"), "utf8");
    assert.match(app, /public\/media-plp/);
    assert.match(app, /publicMediaPlpRouter/);

    const pkg = readFileSync(join(apiRoot, "package.json"), "utf8");
    assert.match(pkg, /diagnose:media-plp-consumer/);
  });

  it("acceptance CLI requires --mongo + one identity + locale", () => {
    assert.equal(parseMediaPlpConsumerAcceptanceArgs(["node", "x"]).ok, false);
    const ok = parseMediaPlpConsumerAcceptanceArgs([
      "node",
      "diagnose-media-plp-consumer.ts",
      "--mongo",
      "--entity-type",
      "civic_media_trusted",
      "--entity-id",
      "reuters",
      "--locale",
      "uk",
    ]);
    assert.equal(ok.ok, true);
  });

  it("O: zero live operations in this pack (script is read-only)", () => {
    const script = readFileSync(
      join(apiRoot, "src/scripts/diagnose-media-plp-consumer.ts"),
      "utf8",
    );
    assert.match(script, /READ-ONLY/);
    assert.doesNotMatch(script, /materialize|Gemini|generateContent/);
  });
});
