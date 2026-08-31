/**
 * Production Completion Pack 02B Task 05 — end-to-end Registry enablement integration.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { AdministrationUnauthorizedError } from "../../../src/modules/administration/administration.errors.js";
import { PreferencesValidationError } from "../../../src/modules/preferences/preferences.errors.js";
import { updateMemberPreferencesForAuthUser } from "../../../src/modules/preferences/preferences.service.js";
import {
  DeterministicTranslationProvider,
  LanguageRegistryValidationError,
  createAdminLanguage,
  ensureLanguageRegistrySeeded,
  getLanguageRegistryByLocale,
  listEnabledSelectableLanguages,
  listPublicLanguages,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  setLanguageRegistryAdminAssertOverrideForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  translateDraft,
  updateAdminLanguage,
} from "../../../src/modules/language/index.js";

const ADMIN = "admin-1";
const MEMBER = "member-lang-task05";

describe("Production Completion Pack 02B Task 05 — enablement integration", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryAdminAssertOverrideForTests(async (userId) => {
      if (userId !== ADMIN) {
        throw new AdministrationUnauthorizedError();
      }
      return { userId: ADMIN, participantId: "participant-admin-1" };
    });
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    setLanguageRegistryAdminAssertOverrideForTests(null);
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
    resetTranslationProviderForTests();
  });

  it("Admin enables uk → public + translations catalogs + prefs + Translate Draft", async () => {
    assert.deepEqual(
      (await listPublicLanguages()).languages.map((row) => row.locale),
      ["en"],
    );
    assert.deepEqual(
      (await listEnabledSelectableLanguages()).map((row) => row.code),
      ["en"],
    );

    await assert.rejects(
      () =>
        updateMemberPreferencesForAuthUser(MEMBER, {
          experiencePreferences: { interfaceLanguage: "uk" },
        }),
      PreferencesValidationError,
    );
    await assert.rejects(
      () =>
        translateDraft({
          sourceRecordId: "draft-task05",
          sourceVersion: "v1",
          sourceLanguage: "en",
          targetLanguage: "uk",
          draftContent: { title: "Hello" },
        }),
      (error: unknown) =>
        error instanceof Error && /Unsupported target language/i.test(error.message),
    );

    const enabled = await updateAdminLanguage({
      actorUserId: ADMIN,
      languageId: "lang-uk",
      body: { enabled: true },
    });
    assert.equal(enabled.enabled, true);

    const publicList = await listPublicLanguages();
    assert.ok(publicList.languages.some((row) => row.locale === "uk"));

    const selectable = await listEnabledSelectableLanguages();
    assert.ok(selectable.some((row) => row.code === "uk"));

    const prefs = await updateMemberPreferencesForAuthUser(MEMBER, {
      experiencePreferences: {
        interfaceLanguage: "uk",
        readingLanguages: ["uk"],
        writingLanguages: ["uk"],
      },
    });
    assert.equal(prefs.experiencePreferences.interfaceLanguage, "uk");

    const draft = await translateDraft({
      sourceRecordId: "draft-task05",
      sourceVersion: "v1",
      sourceLanguage: "en",
      targetLanguage: "uk",
      draftContent: { title: "Hello" },
    });
    assert.equal(draft.workingTranslation.targetLanguage, "uk");
  });

  it("preserves zh-Hant aliases, Arabic RTL, English cannot disable, disabled leave selectable lists", async () => {
    const zh = await getLanguageRegistryByLocale("zh-Hant");
    assert.ok(zh);
    assert.deepEqual(zh.aliases, ["zh-TW", "zh-HK"]);

    const ar = await updateAdminLanguage({
      actorUserId: ADMIN,
      languageId: "lang-ar",
      body: { enabled: true },
    });
    assert.equal(ar.textDirection, "rtl");
    assert.equal(ar.enabled, true);

    await assert.rejects(
      () =>
        updateAdminLanguage({
          actorUserId: ADMIN,
          languageId: "lang-en",
          body: { enabled: false },
        }),
      LanguageRegistryValidationError,
    );

    await updateAdminLanguage({
      actorUserId: ADMIN,
      languageId: "lang-ar",
      body: { enabled: false },
    });
    const selectable = await listEnabledSelectableLanguages();
    assert.ok(!selectable.some((row) => row.code === "ar"));
    assert.ok(selectable.some((row) => row.code === "en"));
  });

  it("Admin create uses POST contract without providerMappings", async () => {
    const created = await createAdminLanguage({
      actorUserId: ADMIN,
      body: {
        locale: "de",
        englishName: "German",
        nativeName: "Deutsch",
        textDirection: "ltr",
        enabled: true,
        fallbackLocale: "en",
      },
    });
    assert.equal(created.locale, "de");
    assert.equal("providerMappings" in created, false);
    assert.ok((await listPublicLanguages()).languages.some((row) => row.locale === "de"));
  });
});
