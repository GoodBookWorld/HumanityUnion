/**
 * Pack 02B Staging Runtime Hotfix 01 — Language Registry aliasKeys unique index.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { LanguageRegistryRecord } from "@hu/types";

import {
  LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME,
  LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_PARTIAL_FILTER,
  isLanguageRegistryAliasKeysUniqueIndexCurrent,
} from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  LanguageRegistryConflictError,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  getLanguageRegistryByLocale,
  listLanguageRegistry,
  resetLanguageRegistryStoreForTests,
  resolveLanguageRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { toLanguageRegistryMongoDocument } from "../../../src/modules/language/language-registry/language-registry.mongo-document.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function baseRecord(
  overrides: Partial<LanguageRegistryRecord> &
    Pick<LanguageRegistryRecord, "languageId" | "locale" | "aliases">,
): LanguageRegistryRecord {
  return {
    languageCode: "xx",
    englishName: "Test",
    nativeName: "Test",
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

describe("Pack 02B Hotfix 01 — Language Registry aliasKeys unique index", () => {
  beforeEach(() => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("omits aliasKeys on Mongo documents when a language has no aliases", () => {
    const doc = toLanguageRegistryMongoDocument(
      baseRecord({ languageId: "lang-en", locale: "en", aliases: [] }),
    );
    assert.deepEqual(doc.aliases, []);
    assert.equal("aliasKeys" in doc, false);
  });

  it("persists normalized aliasKeys for zh-Hant aliases", () => {
    const doc = toLanguageRegistryMongoDocument(
      baseRecord({
        languageId: "lang-zh-Hant",
        locale: "zh-Hant",
        aliases: ["zh-TW", "zh-HK"],
      }),
    );
    assert.deepEqual(doc.aliases, ["zh-TW", "zh-HK"]);
    assert.deepEqual(doc.aliasKeys, ["zh-tw", "zh-hk"]);
  });

  it("seeds en + uk + ar (no aliases) and zh-Hant (with aliases) idempotently", async () => {
    const first = await ensureLanguageRegistrySeeded();
    assert.equal(first.inserted, 4);

    const listed = await listLanguageRegistry();
    const byLocale = new Map(listed.map((row) => [row.locale, row]));
    assert.deepEqual(byLocale.get("en")?.aliases, []);
    assert.deepEqual(byLocale.get("uk")?.aliases, []);
    assert.deepEqual(byLocale.get("ar")?.aliases, []);
    assert.deepEqual(byLocale.get("zh-Hant")?.aliases, ["zh-TW", "zh-HK"]);

    const fromTw = await resolveLanguageRegistryLocale("zh-TW");
    assert.equal(fromTw?.locale, "zh-Hant");

    const second = await ensureLanguageRegistrySeeded();
    assert.equal(second.inserted, 0);
    assert.equal(second.skippedExisting, 4);
  });

  it("preserves Admin edits across reseed", async () => {
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      englishName: "Ukrainian (Admin)",
    });

    const reseed = await ensureLanguageRegistrySeeded();
    assert.equal(reseed.inserted, 0);

    const uk = await getLanguageRegistryByLocale("uk");
    assert.equal(uk?.enabled, true);
    assert.equal(uk?.englishName, "Ukrainian (Admin)");
  });

  it("rejects duplicate real aliases and locale/alias collisions", async () => {
    await ensureLanguageRegistrySeeded();

    await assert.rejects(
      () =>
        createLanguageRegistryRecord({
          locale: "yue",
          englishName: "Cantonese",
          nativeName: "粵語",
          textDirection: "ltr",
          aliases: ["zh-TW"],
        }),
      LanguageRegistryConflictError,
    );

    await assert.rejects(
      () =>
        createLanguageRegistryRecord({
          locale: "fa",
          englishName: "Persian",
          nativeName: "فارسی",
          textDirection: "rtl",
          aliases: ["ar"],
        }),
      LanguageRegistryConflictError,
    );
  });

  it("detects obsolete vs current aliasKeys unique index definitions", () => {
    assert.equal(
      isLanguageRegistryAliasKeysUniqueIndexCurrent({
        name: LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME,
        key: { aliasKeys: 1 },
        unique: true,
      }),
      false,
    );

    assert.equal(
      isLanguageRegistryAliasKeysUniqueIndexCurrent({
        name: LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME,
        key: { aliasKeys: 1 },
        unique: true,
        partialFilterExpression: LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_PARTIAL_FILTER,
      }),
      true,
    );

    assert.equal(
      isLanguageRegistryAliasKeysUniqueIndexCurrent({
        name: "unrelated_index",
        key: { aliasKeys: 1 },
        unique: true,
        partialFilterExpression: LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_PARTIAL_FILTER,
      }),
      false,
    );
  });

  it("wires partial unique alias index and idempotent reconcile into mongo-indexes", () => {
    const source = fs.readFileSync(
      path.join(repoRoot, "apps/api/src/infrastructure/mongodb/mongo-indexes.ts"),
      "utf8",
    );

    assert.match(source, /language_registry_alias_keys_unique/);
    assert.match(source, /"aliasKeys\.0":\s*\{\s*\$exists:\s*true\s*\}/);
    assert.match(source, /partialFilterExpression:\s*LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_PARTIAL_FILTER/);
    assert.match(source, /reconcileLanguageRegistryAliasKeysUniqueIndex/);
    assert.match(
      source,
      /withMongoStartupIndexRetry\(\s*"reconcileLanguageRegistryAliasKeysUniqueIndex"/,
    );

    const reconcileStart = source.indexOf(
      "async function reconcileLanguageRegistryAliasKeysUniqueIndex",
    );
    assert.ok(reconcileStart >= 0);
    const reconcileBody = source.slice(reconcileStart, reconcileStart + 1200);
    assert.match(reconcileBody, /isLanguageRegistryAliasKeysUniqueIndexCurrent/);
    assert.match(reconcileBody, /dropIndex\(LANGUAGE_REGISTRY_ALIAS_KEYS_UNIQUE_INDEX_NAME\)/);
    assert.match(reconcileBody, /IndexNotFound/);
    assert.match(reconcileBody, /NamespaceNotFound/);
    assert.doesNotMatch(reconcileBody, /dropIndex\("language_registry_language_id_unique"\)/);
    assert.doesNotMatch(reconcileBody, /dropIndex\("language_registry_locale_key_unique"\)/);
  });
});
