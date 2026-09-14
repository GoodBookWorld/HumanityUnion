/**
 * Localization Simplification Step 01 —
 * Preferred Reading Language (`readingLanguages[0]`) drives presentation sync.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  findPreferencesByMemberId,
  resetPreferencesMemoryStoreForTests,
  setPreferencesForceMemoryForTests,
} from "../../../src/modules/preferences/preferences.repository.js";
import { updateMemberPreferencesForAuthUser } from "../../../src/modules/preferences/preferences.service.js";

const MEMBER = "member-simplification-step01-preferred-reading";

describe("Localization Simplification Step 01 — Preferred Reading Language sync", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setPreferencesForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetPreferencesMemoryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    await updateLanguageRegistryRecord("lang-ar", { enabled: true });
    await updateLanguageRegistryRecord("lang-zh-Hant", { enabled: true });
  });

  afterEach(() => {
    resetPreferencesMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setPreferencesForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("persists Preferred Reading Language and synchronizes interfaceLanguage", async () => {
    const updated = await updateMemberPreferencesForAuthUser(MEMBER, {
      experiencePreferences: {
        readingLanguages: ["uk"],
        writingLanguages: ["en"],
        translationPreference: "preferred",
      },
    });

    assert.deepEqual(updated.experiencePreferences.readingLanguages, ["uk"]);
    assert.equal(updated.experiencePreferences.interfaceLanguage, "uk");
    assert.equal(updated.experiencePreferences.translationPreference, "preferred");
    assert.deepEqual(updated.experiencePreferences.writingLanguages, ["en"]);

    const stored = await findPreferencesByMemberId(MEMBER);
    assert.ok(stored);
    assert.deepEqual(stored.experiencePreferences.readingLanguages, ["uk"]);
    assert.equal(stored.experiencePreferences.interfaceLanguage, "uk");
  });

  it("accepts uk / ar / zh-Hant as Preferred Reading Language", async () => {
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const updated = await updateMemberPreferencesForAuthUser(MEMBER, {
        experiencePreferences: { readingLanguages: [locale] },
      });
      assert.deepEqual(updated.experiencePreferences.readingLanguages, [locale]);
      assert.equal(updated.experiencePreferences.interfaceLanguage, locale);
    }
  });

  it("canonicalizes aliases for Preferred Reading Language (zh-TW → zh-Hant)", async () => {
    const updated = await updateMemberPreferencesForAuthUser(MEMBER, {
      experiencePreferences: { readingLanguages: ["zh-TW"] },
    });
    assert.deepEqual(updated.experiencePreferences.readingLanguages, ["zh-Hant"]);
    assert.equal(updated.experiencePreferences.interfaceLanguage, "zh-Hant");
  });

  it("rejects disabled locales for Preferred Reading Language", async () => {
    await updateLanguageRegistryRecord("lang-uk", { enabled: false });
    await assert.rejects(
      () =>
        updateMemberPreferencesForAuthUser(MEMBER, {
          experiencePreferences: { readingLanguages: ["uk"] },
        }),
      (error: unknown) =>
        error instanceof Error &&
        /readingLanguages must be an enabled platform language/i.test(error.message),
    );
  });

  it("interfaceLanguage-only PATCH does not overwrite readingLanguages", async () => {
    await updateMemberPreferencesForAuthUser(MEMBER, {
      experiencePreferences: {
        readingLanguages: ["ar"],
        interfaceLanguage: "ar",
      },
    });

    const updated = await updateMemberPreferencesForAuthUser(MEMBER, {
      experiencePreferences: { interfaceLanguage: "en" },
    });

    assert.deepEqual(updated.experiencePreferences.readingLanguages, ["ar"]);
    assert.equal(updated.experiencePreferences.interfaceLanguage, "en");
  });

  it("translationPreference-only PATCH leaves reading/interface unchanged", async () => {
    await updateMemberPreferencesForAuthUser(MEMBER, {
      experiencePreferences: {
        readingLanguages: ["uk"],
        translationPreference: "none",
      },
    });

    const updated = await updateMemberPreferencesForAuthUser(MEMBER, {
      experiencePreferences: { translationPreference: "ask" },
    });

    assert.equal(updated.experiencePreferences.translationPreference, "ask");
    assert.deepEqual(updated.experiencePreferences.readingLanguages, ["uk"]);
    assert.equal(updated.experiencePreferences.interfaceLanguage, "uk");
  });
});
