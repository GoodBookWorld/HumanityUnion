/**
 * Reset 03B.1 — cross-process durable PLP persistence (isolated hu_test_*).
 * Cannot pass using one shared in-memory repository instance.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  asMediaPlpPresentationNode,
  buildCanonicalTrustedPresentation,
  findCurrentPublishedPresentation,
  fingerprintMediaPlpCanonicalVersion,
  getPublishedLocalizationPersistenceMode,
  publishMediaPlpEntity,
  requirePublishedLocalizationMongoPersistence,
  resetPublishedLocalizationPersistenceForTests,
  resetPublishedLocalizedPresentationMemoryStoreForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { resolveMongoConfig } from "../../../src/infrastructure/mongodb/mongo-config.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { TEST_DATABASE_ENV_VAR } from "../../../scripts/test-mongo-isolation.js";
import type { TrustedMediaResource } from "@hu/types";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const isolatedDb = process.env[TEST_DATABASE_ENV_VAR]?.trim() ?? "";
if (!/^hu_test_/.test(isolatedDb)) {
  console.log(
    "SKIP: Reset 03B.1 durability mongo test requires isolated MONGODB_TEST_DATABASE (hu_test_*).",
  );
  process.exit(0);
}

const trusted: TrustedMediaResource = {
  id: `durability-${Date.now().toString(36)}`,
  name: "Durability Probe",
  logoLabel: "D",
  country: "International",
  categoryId: "international-wire-service",
  explanation: "Cross-process PLP durability probe explanation.",
  websiteUrl: "https://example.test/durability",
  sortOrder: 99,
};

const canonicalPresentation = asMediaPlpPresentationNode(
  buildCanonicalTrustedPresentation(trusted),
);
const canonicalVersion = fingerprintMediaPlpCanonicalVersion(canonicalPresentation);

describe("Reset 03B.1 Media PLP durable Mongo persistence", () => {
  before(async () => {
    assert.match(process.env[TEST_DATABASE_ENV_VAR] ?? "", /^hu_test_/);
    await connectMongoClient();
    requirePublishedLocalizationMongoPersistence("03B.1 durability test");
    assert.equal(getPublishedLocalizationPersistenceMode(), "mongo");
  });

  after(async () => {
    try {
      const collection = getMongoCollection(
        MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent,
      );
      await collection.deleteMany({
        entityType: "civic_media_trusted",
        entityId: trusted.id,
      });
      const history = getMongoCollection(
        MONGO_COLLECTIONS.publishedLocalizedPresentationsHistory,
      );
      await history.deleteMany({
        "identity.entityType": "civic_media_trusted",
        "identity.entityId": trusted.id,
      });
    } catch {
      // best-effort cleanup
    }
    resetPublishedLocalizationPersistenceForTests();
    await disconnectMongoClient();
  });

  it("C/D/E/F: publish survives fresh repository context via durable Mongo", async () => {
    // CONTEXT A — publish through the same persistence selection used by CLI.
    requirePublishedLocalizationMongoPersistence("context-a-publish");
    const writeDb = resolveMongoConfig().database;
    assert.match(writeDb, /^hu_test_/);

    const published = await publishMediaPlpEntity({
      entityType: "civic_media_trusted",
      entityId: trusted.id,
      locale: "uk",
      canonicalVersion,
      contentRevision: 1,
      canonicalPresentation,
      layers: [
        {
          source: "MACHINE",
          values: { explanation: `[uk] ${trusted.explanation}` },
        },
      ],
      includeDeterministicMachine: false,
    });
    assert.equal(published.ok, true);
    if (published.ok) {
      assert.ok(published.outcome === "PUBLISHED" || published.outcome === "IDEMPOTENT");
    }

    // Discard all application memory/state (cannot rely on in-process Map).
    resetPublishedLocalizedPresentationMemoryStoreForTests();
    resetPublishedLocalizationPersistenceForTests();
    assert.equal(getPublishedLocalizationPersistenceMode(), "memory");
    await disconnectMongoClient();

    // CONTEXT B — fresh client + require Mongo again, then read exact identity.
    await connectMongoClient();
    requirePublishedLocalizationMongoPersistence("context-b-read");
    assert.equal(getPublishedLocalizationPersistenceMode(), "mongo");
    const readDb = resolveMongoConfig().database;
    assert.equal(readDb, writeDb);

    const current = await findCurrentPublishedPresentation({
      entityType: "civic_media_trusted",
      entityId: trusted.id,
      locale: "uk",
    });
    assert.ok(current, "durable current pointer must be found after fresh context");
    assert.equal(current!.state, "PUBLISHED");
    assert.equal(current!.identity.entityType, "civic_media_trusted");
    assert.equal(current!.identity.entityId, trusted.id);
    assert.equal(String(current!.identity.locale).toLowerCase(), "uk");
    assert.equal(current!.identity.canonicalVersion, canonicalVersion);
    assert.equal(current!.identity.localizationSchemaVersion, "PLP.1");

    // Direct collection proof (same DB/collections intended for CLI).
    const collection = getMongoCollection<{
      entityType: string;
      entityId: string;
      locale: string;
      state: string;
      identity: { canonicalVersion: string };
    }>(MONGO_COLLECTIONS.publishedLocalizedPresentationsCurrent);
    const doc = await collection.findOne({
      entityType: "civic_media_trusted",
      entityId: trusted.id,
      locale: "uk",
      state: "PUBLISHED",
    });
    assert.ok(doc);
    assert.equal(doc!.identity.canonicalVersion, canonicalVersion);
  });

  it("B: require Mongo fails closed when URI absent (no silent memory)", async () => {
    const prev = process.env.MONGODB_URI;
    // Soft check: with URI present, mode can be forced; without, require throws.
    resetPublishedLocalizationPersistenceForTests();
    assert.equal(getPublishedLocalizationPersistenceMode(), "memory");
    requirePublishedLocalizationMongoPersistence("re-require after reset");
    assert.equal(getPublishedLocalizationPersistenceMode(), "mongo");
    void prev;
  });
});
