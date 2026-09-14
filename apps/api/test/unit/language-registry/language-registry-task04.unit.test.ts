/**
 * Production Completion Pack 02B Task 04 — Admin Language Registry write control plane.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  listAdministrationAuditsForTarget,
  resetAdministrationAuditMemoryForTests,
} from "../../../src/modules/administration/index.js";
import {
  LanguageRegistryConflictError,
  LanguageRegistryValidationError,
  createAdminLanguage,
  ensureLanguageRegistrySeeded,
  listEnabledSelectableLanguages,
  listPublicLanguages,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryAdminAssertOverrideForTests,
  setLanguageRegistryForceMemoryForTests,
  updateAdminLanguage,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";

describe("Production Completion Pack 02B Task 04 — Admin write control plane", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetAdministrationAuditMemoryForTests();
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
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    setLanguageRegistryAdminAssertOverrideForTests(null);
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
    resetAdministrationAuditMemoryForTests();
  });

  it("requires Admin authorization", async () => {
    await assert.rejects(
      () =>
        createAdminLanguage({
          actorUserId: "",
          body: {
            locale: "de",
            englishName: "German",
            nativeName: "Deutsch",
            textDirection: "ltr",
          },
        }),
      AdministrationUnauthorizedError,
    );
    await assert.rejects(
      () =>
        createAdminLanguage({
          actorUserId: "member-1",
          body: {
            locale: "de",
            englishName: "German",
            nativeName: "Deutsch",
            textDirection: "ltr",
          },
        }),
      AdministrationForbiddenError,
    );
  });

  it("creates a language and emits audit", async () => {
    const created = await createAdminLanguage({
      actorUserId: "admin-1",
      body: {
        locale: "de",
        englishName: "German",
        nativeName: "Deutsch",
        textDirection: "ltr",
        enabled: false,
        aliases: ["de-DE"],
      },
    });
    assert.equal(created.locale, "de");
    assert.equal(created.enabled, false);
    assert.deepEqual(created.aliases, ["de-DE"]);
    assert.equal("providerMappings" in created, false);

    const audits = await listAdministrationAuditsForTarget({
      targetType: "language_registry",
      targetId: created.languageId,
    });
    assert.equal(audits.length, 1);
    assert.equal(audits[0]?.action, "language_registry.create");
    assert.match(audits[0]?.afterSummary ?? "", /locale=de/);
    assert.doesNotMatch(audits[0]?.afterSummary ?? "", /provider/i);
  });

  it("rejects duplicate locale/alias conflicts", async () => {
    await assert.rejects(
      () =>
        createAdminLanguage({
          actorUserId: "admin-1",
          body: {
            locale: "en",
            englishName: "English Dup",
            nativeName: "English Dup",
            textDirection: "ltr",
          },
        }),
      LanguageRegistryConflictError,
    );
    await assert.rejects(
      () =>
        createAdminLanguage({
          actorUserId: "admin-1",
          body: {
            locale: "fa",
            englishName: "Persian",
            nativeName: "فارسی",
            textDirection: "rtl",
            aliases: ["zh-TW"],
          },
        }),
      LanguageRegistryConflictError,
    );
  });

  it("keeps canonical locale immutable", async () => {
    await assert.rejects(
      () =>
        updateAdminLanguage({
          actorUserId: "admin-1",
          languageId: "lang-uk",
          body: { locale: "uk-UA" },
        }),
      LanguageRegistryValidationError,
    );
    await assert.rejects(
      () =>
        updateLanguageRegistryRecord("lang-uk", {
          locale: "uk-UA",
        }),
      LanguageRegistryValidationError,
    );
  });

  it("enables uk / zh-Hant / ar and reflects on public + translations catalogs", async () => {
    for (const languageId of ["lang-uk", "lang-zh-Hant", "lang-ar"] as const) {
      const updated = await updateAdminLanguage({
        actorUserId: "admin-1",
        languageId,
        body: { enabled: true },
      });
      assert.equal(updated.enabled, true);
    }

    const publicList = await listPublicLanguages();
    assert.deepEqual(
      publicList.languages.map((row) => row.locale),
      ["ar", "en", "uk", "zh-Hant"],
    );

    const selectable = await listEnabledSelectableLanguages();
    assert.deepEqual(
      selectable.map((row) => row.code),
      ["ar", "en", "uk", "zh-Hant"],
    );

    const enableAudits = await listAdministrationAuditsForTarget({
      targetType: "language_registry",
      targetId: "lang-uk",
    });
    assert.ok(enableAudits.some((row) => row.action === "language_registry.enable"));
  });

  it("cannot disable English", async () => {
    await assert.rejects(
      () =>
        updateAdminLanguage({
          actorUserId: "admin-1",
          languageId: "lang-en",
          body: { enabled: false },
        }),
      LanguageRegistryValidationError,
    );
  });

  it("validates fallbackLocale and blocks disable when dependents exist", async () => {
    await updateAdminLanguage({
      actorUserId: "admin-1",
      languageId: "lang-uk",
      body: { enabled: true },
    });

    await assert.rejects(
      () =>
        createAdminLanguage({
          actorUserId: "admin-1",
          body: {
            locale: "de",
            englishName: "German",
            nativeName: "Deutsch",
            textDirection: "ltr",
            enabled: true,
            fallbackLocale: "fr",
          },
        }),
      LanguageRegistryValidationError,
    );

    await assert.rejects(
      () =>
        updateAdminLanguage({
          actorUserId: "admin-1",
          languageId: "lang-uk",
          body: { fallbackLocale: "uk" },
        }),
      LanguageRegistryValidationError,
    );

    const dependent = await createAdminLanguage({
      actorUserId: "admin-1",
      body: {
        locale: "de",
        englishName: "German",
        nativeName: "Deutsch",
        textDirection: "ltr",
        enabled: true,
        fallbackLocale: "uk",
      },
    });
    assert.equal(dependent.fallbackLocale, "uk");

    await assert.rejects(
      () =>
        updateAdminLanguage({
          actorUserId: "admin-1",
          languageId: "lang-uk",
          body: { enabled: false },
        }),
      LanguageRegistryConflictError,
    );
  });

  it("feature flags require enabled=true; uiTranslationStatus alone does not enable", async () => {
    await assert.rejects(
      () =>
        updateAdminLanguage({
          actorUserId: "admin-1",
          languageId: "lang-uk",
          body: { searchEnabled: true },
        }),
      LanguageRegistryValidationError,
    );

    const patched = await updateAdminLanguage({
      actorUserId: "admin-1",
      languageId: "lang-uk",
      body: { uiTranslationStatus: "partial" },
    });
    assert.equal(patched.enabled, false);
    assert.equal(patched.uiTranslationStatus, "partial");

    const enabled = await updateAdminLanguage({
      actorUserId: "admin-1",
      languageId: "lang-uk",
      body: {
        enabled: true,
        searchEnabled: true,
        contentTranslationEnabled: true,
        seoIndexingEnabled: true,
      },
    });
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.searchEnabled, true);
    assert.equal(enabled.contentTranslationEnabled, true);
    assert.equal(enabled.seoIndexingEnabled, true);
  });

  it("PATCH preserves unspecified fields", async () => {
    await updateAdminLanguage({
      actorUserId: "admin-1",
      languageId: "lang-zh-Hant",
      body: {
        enabled: true,
        englishName: "Chinese (Traditional)",
        aliases: ["zh-TW", "zh-HK"],
        uiTranslationStatus: "partial",
      },
    });

    const patched = await updateAdminLanguage({
      actorUserId: "admin-1",
      languageId: "lang-zh-Hant",
      body: { nativeName: "繁體中文（更新）" },
    });

    assert.equal(patched.nativeName, "繁體中文（更新）");
    assert.equal(patched.enabled, true);
    assert.equal(patched.englishName, "Chinese (Traditional)");
    assert.deepEqual(patched.aliases, ["zh-TW", "zh-HK"]);
    assert.equal(patched.uiTranslationStatus, "partial");
    assert.equal(patched.locale, "zh-Hant");
  });

  it("rejects providerMappings and empty patch bodies", async () => {
    await assert.rejects(
      () =>
        createAdminLanguage({
          actorUserId: "admin-1",
          body: {
            locale: "de",
            englishName: "German",
            nativeName: "Deutsch",
            textDirection: "ltr",
            providerMappings: { google: "de" },
          },
        }),
      AdministrationValidationError,
    );
    await assert.rejects(
      () =>
        updateAdminLanguage({
          actorUserId: "admin-1",
          languageId: "lang-uk",
          body: {},
        }),
      AdministrationValidationError,
    );
  });
});
