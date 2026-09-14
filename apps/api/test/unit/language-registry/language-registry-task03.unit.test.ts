/**
 * Production Completion Pack 02B Task 03 — migrate consumers to Language Registry.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { PreferencesValidationError } from "../../../src/modules/preferences/preferences.errors.js";
import { updateMemberPreferencesForAuthUser } from "../../../src/modules/preferences/preferences.service.js";
import {
  TranslationProviderError,
  assertEnabledSelectableLocale,
  buildParticipantLanguageContextFromExperience,
  ensureLanguageRegistrySeeded,
  listEnabledSelectableLanguages,
  resetLanguageRegistryStoreForTests,
  resolveEnabledCanonicalLocale,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  resetTranslationProviderForTests,
  DeterministicTranslationProvider,
  translateDraft,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const MEMBER_ID = "member-lang-registry-task03";

describe("Production Completion Pack 02B Task 03 — Registry consumer cutover", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
    resetTranslationProviderForTests();
  });

  it("translations/languages catalog shape is registry-backed and excludes disabled", async () => {
    const languages = await listEnabledSelectableLanguages();
    assert.deepEqual(
      languages.map((row) => row.code),
      ["en"],
    );
    assert.equal(languages[0]?.englishName, "English");
    assert.equal(languages[0]?.nativeName, "English");
    assert.equal(languages[0]?.rtl, false);

    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    const afterEnable = await listEnabledSelectableLanguages();
    assert.deepEqual(
      afterEnable.map((row) => row.code),
      ["en", "uk"],
    );
  });

  it("alias input canonicalizes to enabled locale; disabled alias target rejected", async () => {
    assert.equal(await resolveEnabledCanonicalLocale("EN"), "en");
    assert.equal(await resolveEnabledCanonicalLocale("zh-TW"), null);
    assert.equal(await resolveEnabledCanonicalLocale("uk"), null);

    await assert.rejects(
      () => assertEnabledSelectableLocale("zh-HK"),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "unsupported_language",
    );

    await updateLanguageRegistryRecord("lang-zh-Hant", { enabled: true });
    assert.equal(await resolveEnabledCanonicalLocale("zh-TW"), "zh-Hant");
    assert.equal(await assertEnabledSelectableLocale("zh-hk"), "zh-Hant");
  });

  it("participant preference validation preserves interface/reading/writing and rejects disabled", async () => {
    await assert.rejects(
      () =>
        updateMemberPreferencesForAuthUser(MEMBER_ID, {
          experiencePreferences: { interfaceLanguage: "uk" },
        }),
      PreferencesValidationError,
    );

    const updated = await updateMemberPreferencesForAuthUser(MEMBER_ID, {
      experiencePreferences: {
        interfaceLanguage: "EN",
        readingLanguages: ["en"],
        writingLanguages: ["en"],
      },
    });
    assert.equal(updated.experiencePreferences.interfaceLanguage, "en");
    assert.deepEqual(updated.experiencePreferences.readingLanguages, ["en"]);
    assert.deepEqual(updated.experiencePreferences.writingLanguages, ["en"]);

    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    const withUk = await updateMemberPreferencesForAuthUser(MEMBER_ID, {
      experiencePreferences: {
        interfaceLanguage: "en",
        readingLanguages: ["uk"],
        writingLanguages: ["en", "uk"],
      },
    });
    assert.equal(withUk.experiencePreferences.interfaceLanguage, "en");
    assert.deepEqual(withUk.experiencePreferences.readingLanguages, ["uk"]);
    assert.deepEqual(withUk.experiencePreferences.writingLanguages, ["en", "uk"]);
  });

  it("participant context falls back to English for disabled stored preferences", async () => {
    const context = await buildParticipantLanguageContextFromExperience({
      interfaceLanguage: "uk",
      readingLanguages: ["ar"],
      writingLanguages: ["zh-Hant"],
      translationPreference: "preferred",
      timeZone: "UTC",
      dateFormat: "YYYY-MM-DD",
      timeFormat: "24h",
      expertiseAreas: [],
      skills: [],
    });
    assert.equal(context.interfaceLanguage, "en");
    assert.equal(context.preferredReadingLanguage, "en");
    assert.equal(context.writingLanguage, "en");
    assert.equal(context.translationDisplayPreference, "preferred");
  });

  it("Translate Draft uses Registry — rejects disabled targets; English works", async () => {
    await assert.rejects(
      () =>
        translateDraft({
          sourceRecordId: "draft-task03",
          sourceVersion: "v1",
          sourceLanguage: "en",
          targetLanguage: "uk",
          draftContent: { title: "Hello" },
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError && error.code === "unsupported_language",
    );

    const ok = await translateDraft({
      sourceRecordId: "draft-task03",
      sourceVersion: "v1",
      sourceLanguage: "en",
      targetLanguage: "en",
      draftContent: { title: "Hello" },
    });
    assert.equal(ok.workingTranslation.targetLanguage, "en");
    assert.deepEqual(ok.originalDraftContent, { title: "Hello" });
  });

  it("migrated runtime consumers do not read PRIORITY_LANGUAGE_CATALOG", () => {
    const routes = fs.readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/language.routes.ts"),
      "utf8",
    );
    const translateDraftSource = fs.readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/translate-draft.ts"),
      "utf8",
    );
    const prefsService = fs.readFileSync(
      path.join(repoRoot, "apps/api/src/modules/preferences/preferences.service.ts"),
      "utf8",
    );
    const runtime = fs.readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/language-registry-runtime.ts"),
      "utf8",
    );
    const webPrefs = fs.readFileSync(
      path.join(
        repoRoot,
        "apps/web/src/features/preferences/components/PreferencesWorkspace.tsx",
      ),
      "utf8",
    );
    const webTranslate = fs.readFileSync(
      path.join(
        repoRoot,
        "apps/web/src/features/language/components/TranslateDraftControl.tsx",
      ),
      "utf8",
    );

    for (const source of [routes, translateDraftSource, prefsService, runtime, webPrefs, webTranslate]) {
      assert.doesNotMatch(source, /PRIORITY_LANGUAGE_CATALOG/);
      assert.doesNotMatch(source, /PRIORITY_LANGUAGE_CODES/);
    }

    assert.match(routes, /listEnabledSelectableLanguages/);
    assert.match(translateDraftSource, /assertEnabledSelectableLocale/);
    assert.match(prefsService, /assertEnabledPreferenceLocale/);
    assert.match(webPrefs, /listPriorityLanguages/);
    assert.match(webTranslate, /listPriorityLanguages/);
  });
});
