/**
 * Pack 02B Staging Runtime Hotfix 01 — Mongo-backed alias index contract.
 * Requires MONGODB_URI; skipped otherwise. Uses temporary fixture rows only.
 * Does not install the obsolete non-partial index against live seed data
 * (that createIndex would fail when en/uk/ar already exist).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import { connectMongoClient } from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import {
  LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME,
  LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_PARTIAL_FILTER,
  isLanguageRegistryAliasKeysUniqueIndexCurrent,
  reconcileLanguageRegistryAliasKeysUniqueIndex,
} from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { toLanguageRegistryMongoDocument } from "../../../src/modules/language/language-registry/language-registry.mongo-document.js";
import type { LanguageRegistryRecord } from "@hu/types";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const fixturePrefix = `lang-hotfix01-${testRunId}`;

const collection = () => getMongoCollection(MONGO_COLLECTIONS.languageRegistry);

function fixtureRecord(
  overrides: Partial<LanguageRegistryRecord> &
    Pick<LanguageRegistryRecord, "languageId" | "locale" | "aliases">,
): LanguageRegistryRecord {
  return {
    languageCode: "xx",
    englishName: "Hotfix Fixture",
    nativeName: "Hotfix Fixture",
    textDirection: "ltr",
    fallbackLocale: "en",
    enabled: false,
    uiTranslationStatus: "none",
    contentTranslationEnabled: false,
    searchEnabled: false,
    seoIndexingEnabled: false,
    providerMappings: {},
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
    ...overrides,
  };
}

async function cleanupFixtures(): Promise<void> {
  await collection().deleteMany({ languageId: { $regex: `^${fixturePrefix}` } });
}

async function ensureCurrentAliasKeysUniqueIndex(): Promise<void> {
  await reconcileLanguageRegistryAliasKeysUniqueIndex();
  await reconcileLanguageRegistryAliasKeysUniqueIndex();
  await collection().createIndex(
    { aliasKeys: 1 },
    {
      unique: true,
      name: LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME,
      partialFilterExpression: { ...LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_PARTIAL_FILTER },
    },
  );
}

before(async () => {
  await connectMongoClient();
});

after(async () => {
  await cleanupFixtures();
});

describe("Pack 02B Hotfix 01 — Language Registry alias index (Mongo)", () => {
  it("reconciles to partial unique alias index and allows multiple no-alias rows", async () => {
    await cleanupFixtures();
    await ensureCurrentAliasKeysUniqueIndex();

    const current = (await collection().indexes()).find(
      (idx) => idx.name === LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME,
    );
    assert.ok(current);
    assert.equal(isLanguageRegistryAliasKeysUniqueIndexCurrent(current!), true);
    assert.deepEqual(
      current!.partialFilterExpression,
      LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_PARTIAL_FILTER,
    );

    // Idempotent reconcile leaves a current index in place.
    await reconcileLanguageRegistryAliasKeysUniqueIndex();
    const afterReconcile = (await collection().indexes()).find(
      (idx) => idx.name === LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME,
    );
    assert.ok(afterReconcile);
    assert.equal(isLanguageRegistryAliasKeysUniqueIndexCurrent(afterReconcile!), true);

    const noAliasA = toLanguageRegistryMongoDocument(
      fixtureRecord({
        languageId: `${fixturePrefix}-a`,
        locale: `hx-a-${testRunId}`,
        aliases: [],
      }),
    );
    const noAliasB = toLanguageRegistryMongoDocument(
      fixtureRecord({
        languageId: `${fixturePrefix}-b`,
        locale: `hx-b-${testRunId}`,
        aliases: [],
      }),
    );
    assert.equal("aliasKeys" in noAliasA, false);

    await collection().insertOne(noAliasA);
    await collection().insertOne(noAliasB);
    await collection().insertOne(
      toLanguageRegistryMongoDocument(
        fixtureRecord({
          languageId: `${fixturePrefix}-zh`,
          locale: `zh-Hant-hx-${testRunId}`,
          aliases: ["zh-TW-hx", "zh-HK-hx"],
        }),
      ),
    );

    const storedA = await collection().findOne({ languageId: `${fixturePrefix}-a` });
    assert.equal("aliasKeys" in (storedA ?? {}), false);
    const storedZh = await collection().findOne({ languageId: `${fixturePrefix}-zh` });
    assert.deepEqual(storedZh?.aliasKeys, ["zh-tw-hx", "zh-hk-hx"]);

    await assert.rejects(
      () =>
        collection().insertOne(
          toLanguageRegistryMongoDocument(
            fixtureRecord({
              languageId: `${fixturePrefix}-dup`,
              locale: `yue-hx-${testRunId}`,
              aliases: ["zh-TW-hx"],
            }),
          ),
        ),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return /E11000|duplicate key/i.test(message);
      },
    );
  });
});
