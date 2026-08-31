/**
 * Production Completion Pack 02B Task 02 — Language Registry bootstrap + read APIs.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  LanguageRegistryConflictError,
  assertLanguageRegistryLocaleIntegrity,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  listAdminLanguages,
  listLanguageRegistry,
  listPublicLanguages,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryAdminAssertOverrideForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("Production Completion Pack 02B Task 02 — Language Registry bootstrap + read APIs", () => {
  beforeEach(() => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryAdminAssertOverrideForTests(null);
  });

  afterEach(() => {
    setLanguageRegistryAdminAssertOverrideForTests(null);
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("wires ensureLanguageRegistrySeeded into Mongo bootstrap after indexes", () => {
    const bootstrapSource = fs.readFileSync(
      path.join(repoRoot, "apps/api/src/infrastructure/mongodb/bootstrap-mongo-persistence.ts"),
      "utf8",
    );
    assert.match(bootstrapSource, /ensureLanguageRegistrySeeded/);
    assert.match(
      bootstrapSource,
      /await ensureMongoIndexes\(\);\s*\n\s*(?:\/\/[^\n]*\n\s*)*await ensureLanguageRegistrySeeded\(\);/m,
    );

    const appSource = fs.readFileSync(path.join(repoRoot, "apps/api/src/app.ts"), "utf8");
    assert.match(appSource, /app\.use\("\/api\/v1\/languages", publicLanguagesRouter\)/);
    assert.match(appSource, /app\.use\("\/api\/v1\/admin\/languages", adminLanguagesRouter\)/);
    assert.match(appSource, /app\.use\("\/api\/v1\/translations", languageRouter\)/);
  });

  it("seeds idempotently without overwriting Admin-modified records", async () => {
    const first = await ensureLanguageRegistrySeeded();
    assert.equal(first.inserted, 4);

    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      englishName: "Ukrainian (Admin)",
    });

    const second = await ensureLanguageRegistrySeeded();
    assert.equal(second.inserted, 0);
    assert.equal(second.skippedExisting, 4);

    const listed = await listLanguageRegistry();
    assert.equal(listed.length, 4);
    const uk = listed.find((row) => row.locale === "uk");
    assert.equal(uk?.enabled, true);
    assert.equal(uk?.englishName, "Ukrainian (Admin)");
  });

  it("public list returns only enabled languages with public-safe fields", async () => {
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });

    const publicList = await listPublicLanguages();
    assert.deepEqual(
      publicList.languages.map((row) => row.locale),
      ["en", "uk"],
    );

    for (const row of publicList.languages) {
      const keys = Object.keys(row).sort();
      assert.deepEqual(keys, [
        "aliases",
        "englishName",
        "fallbackLocale",
        "languageCode",
        "languageId",
        "locale",
        "nativeName",
        "textDirection",
        "uiTranslationStatus",
      ]);
      assert.equal("providerMappings" in row, false);
      assert.equal("enabled" in row, false);
      assert.equal("localeKey" in row, false);
      assert.equal("aliasKeys" in row, false);
      assert.equal("createdAt" in row, false);
      assert.equal("updatedAt" in row, false);
      assert.equal("contentTranslationEnabled" in row, false);
      assert.equal("searchEnabled" in row, false);
      assert.equal("seoIndexingEnabled" in row, false);
    }
  });

  it("admin list includes disabled languages, omits providerMappings, and enforces authorization", async () => {
    await ensureLanguageRegistrySeeded();

    const adminSource = fs.readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/language-registry/admin-languages.routes.ts",
      ),
      "utf8",
    );
    assert.match(adminSource, /authenticationMiddleware/);
    assert.match(adminSource, /requireAuthenticationMiddleware/);

    setLanguageRegistryAdminAssertOverrideForTests(async (userId) => {
      if (!userId.trim()) {
        throw new AdministrationUnauthorizedError();
      }
      if (userId === "member-1") {
        throw new AdministrationForbiddenError("Administrator access is required.");
      }
      if (userId !== "admin-1") {
        throw new AdministrationUnauthorizedError();
      }
      return { userId: "admin-1", participantId: "participant-admin-1" };
    });

    await assert.rejects(
      () => listAdminLanguages({ actorUserId: "" }),
      AdministrationUnauthorizedError,
    );
    await assert.rejects(
      () => listAdminLanguages({ actorUserId: "member-1" }),
      AdministrationForbiddenError,
    );

    const adminList = await listAdminLanguages({ actorUserId: "admin-1" });
    assert.equal(adminList.languages.length, 4);
    assert.ok(adminList.languages.some((row) => row.enabled === false));
    assert.deepEqual(
      adminList.languages.map((row) => row.locale),
      ["ar", "en", "uk", "zh-Hant"],
    );

    for (const row of adminList.languages) {
      assert.equal("providerMappings" in row, false);
      assert.equal("localeKey" in row, false);
      assert.equal("aliasKeys" in row, false);
      assert.equal(typeof row.enabled, "boolean");
      assert.ok(row.createdAt);
      assert.ok(row.updatedAt);
    }
  });

  it("rejects canonical locale that collides with another record alias", async () => {
    await ensureLanguageRegistrySeeded();
    await assert.rejects(
      () =>
        createLanguageRegistryRecord({
          locale: "zh-TW",
          englishName: "Taiwan Chinese",
          nativeName: "Taiwan",
          textDirection: "ltr",
        }),
      LanguageRegistryConflictError,
    );
  });

  it("rejects alias that collides with another canonical locale", async () => {
    await ensureLanguageRegistrySeeded();
    await assert.rejects(
      () =>
        updateLanguageRegistryRecord("lang-uk", {
          aliases: ["en"],
        }),
      LanguageRegistryConflictError,
    );
  });

  it("rejects alias that collides with another record alias", async () => {
    await ensureLanguageRegistrySeeded();
    await assert.rejects(
      () =>
        updateLanguageRegistryRecord("lang-uk", {
          aliases: ["zh-HK"],
        }),
      LanguageRegistryConflictError,
    );
  });

  it("normalizes duplicate aliases within one record uniquely", async () => {
    await ensureLanguageRegistrySeeded();
    const created = await createLanguageRegistryRecord({
      locale: "fa",
      englishName: "Persian",
      nativeName: "فارسی",
      textDirection: "rtl",
      aliases: ["fa-IR", "FA-IR", " fa-IR "],
    });
    assert.deepEqual(created.aliases, ["fa-IR"]);
  });

  it("rejects own locale appearing as an alias", async () => {
    await ensureLanguageRegistrySeeded();
    await assert.rejects(
      () =>
        updateLanguageRegistryRecord("lang-uk", {
          aliases: ["UK"],
        }),
      LanguageRegistryConflictError,
    );

    assert.throws(
      () =>
        assertLanguageRegistryLocaleIntegrity([], {
          languageId: "lang-x",
          locale: "de",
          aliases: ["de"],
        }),
      LanguageRegistryConflictError,
    );
  });
});
