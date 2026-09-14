/**
 * Reset 03E.8 — HTTP PLP persistence truth (no live ops).
 * Proves API HTTP resolve must share the durable PLP store with materializer/diagnose,
 * and cannot silently read empty memory while Mongo is configured.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  MEDIA_PLP_ENTITY_TYPE,
} from "@hu/types";

import {
  asMediaPlpPresentationNode,
  assertMediaPlpReadImportIsolation,
  bootstrapPublishedLocalizationApiPersistence,
  buildCanonicalEditorialPresentation,
  fingerprintMediaPlpCanonicalVersion,
  forcePublishedLocalizationPersistenceUnboundForTests,
  getPublishedLocalizationPersistenceMode,
  getPublishedLocalizationPersistenceProbeMode,
  getPublishedLocalizationPersistenceRuntimeClass,
  markPublishedLocalizationPersistenceUnavailable,
  publishMediaPlpEntity,
  resetMediaPlpInstrumentationForTests,
  resetMediaPlpResolveCacheForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerItem,
  setMediaPlpConsumptionEnabledForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

const editorial = asMediaPlpPresentationNode(
  buildCanonicalEditorialPresentation({
    overview: CIVIC_MEDIA_OVERVIEW,
    faq: [...CIVIC_MEDIA_FAQ],
  }),
);
const version = fingerprintMediaPlpCanonicalVersion(editorial);

beforeEach(() => {
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
  resetMediaPlpResolveCacheForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
});

afterEach(() => {
  setMediaPlpConsumptionEnabledForTests(null);
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
  resetMediaPlpResolveCacheForTests();
});

describe("Reset 03E.8 — HTTP PLP persistence composition", () => {
  it("unit-test MEMORY_TEST path: publish then HTTP consumer resolve → PUBLISHED_LOCALIZED", async () => {
    assert.equal(getPublishedLocalizationPersistenceProbeMode(), "MEMORY_TEST");

    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: editorial,
      includeDeterministicMachine: true,
    });
    assert.equal(published.ok, true);

    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      canonicalPresentation: editorial,
    });

    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
    assert.notEqual(resolved.reasonCode, "NO_PUBLISHED_SNAPSHOT");
    assert.equal(resolved.persistenceMode, "MEMORY_TEST");
    assert.equal(resolved.lookupResult, "FOUND");
  });

  it("fresh repository-instance durability: writer instance != reader instance (memory reset)", async () => {
    // Writer context
    setPublishedLocalizationPersistenceModeForTests("memory");
    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: editorial,
      includeDeterministicMachine: true,
    });
    assert.equal(published.ok, true);

    // Simulate distinct process memory: wipe store without re-publish → NOT_FOUND.
    // (Mongo durability is covered by 03B.1; here we prove HTTP path uses the active facade.)
    resetPublishedLocalizationPersistenceForTests();
    setPublishedLocalizationPersistenceModeForTests("memory");

    const miss = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      canonicalPresentation: editorial,
    });
    assert.equal(miss.mode, "CANONICAL_FALLBACK");
    assert.equal(miss.reasonCode, "NO_PUBLISHED_SNAPSHOT");
    assert.equal(miss.lookupResult, "NOT_FOUND");

    // Re-publish in "reader" instance → FOUND (same abstraction materializer uses).
    await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: editorial,
      includeDeterministicMachine: true,
    });
    const hit = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      canonicalPresentation: editorial,
    });
    assert.equal(hit.mode, "PUBLISHED_LOCALIZED");
    assert.equal(hit.lookupResult, "FOUND");
  });

  it("staging/production-like: Mongo URI + unbound/memory default → PLP_PERSISTENCE_UNAVAILABLE", async () => {
    const prevUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/hu-plp-03e8-test";
    try {
      forcePublishedLocalizationPersistenceUnboundForTests();
      assert.equal(getPublishedLocalizationPersistenceRuntimeClass(), "UNBOUND");
      assert.equal(getPublishedLocalizationPersistenceMode(), "memory");

      const resolved = await resolveMediaPlpConsumerItem({
        locale: "uk",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
        canonicalPresentation: editorial,
      });

      assert.equal(resolved.mode, "CANONICAL_FALLBACK");
      assert.equal(resolved.reasonCode, "PLP_PERSISTENCE_UNAVAILABLE");
      assert.equal(resolved.lookupResult, "ERROR");
      assert.equal(resolved.persistenceMode, "UNAVAILABLE");
    } finally {
      if (prevUri === undefined) {
        delete process.env.MONGODB_URI;
      } else {
        process.env.MONGODB_URI = prevUri;
      }
      resetPublishedLocalizationPersistenceForTests();
    }
  });

  it("explicit mark unavailable → distinct reason (not NO_PUBLISHED_SNAPSHOT)", async () => {
    markPublishedLocalizationPersistenceUnavailable("test");
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      canonicalPresentation: editorial,
    });
    assert.equal(resolved.reasonCode, "PLP_PERSISTENCE_UNAVAILABLE");
    assert.equal(resolved.lookupResult, "ERROR");
  });

  it("genuine missing snapshot on MEMORY_TEST → NO_PUBLISHED_SNAPSHOT", async () => {
    setPublishedLocalizationPersistenceModeForTests("memory");
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: MEDIA_PLP_EDITORIAL_ENTITY_ID,
      canonicalPresentation: editorial,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(resolved.reasonCode, "NO_PUBLISHED_SNAPSHOT");
    assert.equal(resolved.lookupResult, "NOT_FOUND");
    assert.equal(resolved.persistenceMode, "MEMORY_TEST");
  });

  it("API bootstrap selects MONGO when MONGODB_URI configured", () => {
    const prevUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/hu-plp-03e8-boot";
    try {
      forcePublishedLocalizationPersistenceUnboundForTests();
      const boot = bootstrapPublishedLocalizationApiPersistence();
      assert.equal(boot.runtimeClass, "MONGO");
      assert.equal(getPublishedLocalizationPersistenceMode(), "mongo");
      assert.equal(getPublishedLocalizationPersistenceProbeMode(), "MONGO");
    } finally {
      if (prevUri === undefined) {
        delete process.env.MONGODB_URI;
      } else {
        process.env.MONGODB_URI = prevUri;
      }
      resetPublishedLocalizationPersistenceForTests();
    }
  });

  it("API index.ts wires bootstrapPublishedLocalizationPersistence", () => {
    const indexSource = readFileSync(path.join(apiSrc, "index.ts"), "utf8");
    assert.match(indexSource, /bootstrapPublishedLocalizationPersistence/);
    assert.match(indexSource, /bootstrapMongoPersistence/);
  });

  it("read-path import graph excludes Gemini/provider/worker/materializer/warm/reconcile", () => {
    const isolation = assertMediaPlpReadImportIsolation();
    assert.equal(isolation.ok, true, isolation.violations.join(", "));

    const bootstrap = readFileSync(
      path.join(apiSrc, "infrastructure/mongodb/bootstrap-published-localization-persistence.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      bootstrap,
      /from\s+["'][^"']*(gemini|materializ|worker|warm|reconcil|language-registry)[^"']*["']/i,
    );

    const repository = readFileSync(
      path.join(
        apiSrc,
        "modules/language/published-localized-presentation/persistence/repository.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(repository, /from ["'].*gemini|from ["'].*materializ|from ["'].*language-registry/);
  });
});
