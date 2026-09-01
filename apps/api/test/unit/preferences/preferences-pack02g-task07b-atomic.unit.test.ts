/**
 * Pack 02G Task 07B — atomic preferences PATCH (no full-document lost updates).
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
} from "../../../src/modules/preferences/preferences.repository.js";
import { updateMemberPreferencesForAuthUser } from "../../../src/modules/preferences/preferences.service.js";
import {
  buildPreferencesFieldSetFromPatch,
  validatePreferencesPatch,
} from "../../../src/modules/preferences/preferences.validators.js";

const MEMBER_A = "member-pack02g-t07b-atomic-a";
const MEMBER_B = "member-pack02g-t07b-atomic-b";
const MEMBER_C = "member-pack02g-t07b-atomic-c";
const MEMBER_D = "member-pack02g-t07b-atomic-d";

describe("Production Completion Pack 02G Task 07B — atomic preferences update", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetPreferencesMemoryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
  });

  afterEach(() => {
    resetPreferencesMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A. interfaceLanguage-only PATCH preserves readingLanguages + translationPreference", async () => {
    await updateMemberPreferencesForAuthUser(MEMBER_A, {
      experiencePreferences: {
        readingLanguages: ["uk"],
        translationPreference: "preferred",
      },
    });

    const afterInterface = await updateMemberPreferencesForAuthUser(MEMBER_A, {
      experiencePreferences: {
        interfaceLanguage: "uk",
      },
    });

    assert.deepEqual(afterInterface.experiencePreferences.readingLanguages, ["uk"]);
    assert.equal(afterInterface.experiencePreferences.translationPreference, "preferred");
    assert.equal(afterInterface.experiencePreferences.interfaceLanguage, "uk");
  });

  it("B. independent reading/interface updates do not clobber each other by write order", async () => {
    await updateMemberPreferencesForAuthUser(MEMBER_B, {
      experiencePreferences: {
        interfaceLanguage: "en",
        readingLanguages: ["en"],
        translationPreference: "preferred",
      },
    });

    await updateMemberPreferencesForAuthUser(MEMBER_B, {
      experiencePreferences: { readingLanguages: ["uk"] },
    });
    await updateMemberPreferencesForAuthUser(MEMBER_B, {
      experiencePreferences: { interfaceLanguage: "uk" },
    });

    let prefs = await findPreferencesByMemberId(MEMBER_B);
    assert.ok(prefs);
    assert.deepEqual(prefs.experiencePreferences.readingLanguages, ["uk"]);
    assert.equal(prefs.experiencePreferences.interfaceLanguage, "uk");
    assert.equal(prefs.experiencePreferences.translationPreference, "preferred");

    // Reverse order on a fresh member path via sequential independent writes.
    await updateMemberPreferencesForAuthUser(MEMBER_B, {
      experiencePreferences: { interfaceLanguage: "en" },
    });
    await updateMemberPreferencesForAuthUser(MEMBER_B, {
      experiencePreferences: { readingLanguages: ["uk"] },
    });

    prefs = await findPreferencesByMemberId(MEMBER_B);
    assert.ok(prefs);
    assert.deepEqual(prefs.experiencePreferences.readingLanguages, ["uk"]);
    assert.equal(prefs.experiencePreferences.interfaceLanguage, "en");
    assert.equal(prefs.experiencePreferences.translationPreference, "preferred");
  });

  it("C. translationPreference-only PATCH leaves interface/reading unchanged", async () => {
    await updateMemberPreferencesForAuthUser(MEMBER_C, {
      experiencePreferences: {
        interfaceLanguage: "uk",
        readingLanguages: ["uk"],
        translationPreference: "none",
      },
    });

    const updated = await updateMemberPreferencesForAuthUser(MEMBER_C, {
      experiencePreferences: {
        translationPreference: "preferred",
      },
    });

    assert.equal(updated.experiencePreferences.translationPreference, "preferred");
    assert.equal(updated.experiencePreferences.interfaceLanguage, "uk");
    assert.deepEqual(updated.experiencePreferences.readingLanguages, ["uk"]);
  });

  it("D. first preference mutation creates defaults + applies patch", async () => {
    const created = await updateMemberPreferencesForAuthUser(MEMBER_D, {
      experiencePreferences: {
        interfaceLanguage: "uk",
        readingLanguages: ["uk"],
        translationPreference: "preferred",
      },
    });

    assert.equal(created.memberId, MEMBER_D);
    assert.equal(created.experiencePreferences.interfaceLanguage, "uk");
    assert.deepEqual(created.experiencePreferences.readingLanguages, ["uk"]);
    assert.equal(created.experiencePreferences.translationPreference, "preferred");
    assert.deepEqual(created.experiencePreferences.writingLanguages, ["en"]);
    assert.equal(created.communicationPreferences.emailNotificationsEnabled, true);
    assert.equal(created.visibilityPreferences.profileVisibility, "members_only");
  });

  it("E. field-set builder only includes explicitly patched experience fields", () => {
    const patch = validatePreferencesPatch({
      experiencePreferences: {
        interfaceLanguage: "uk",
      },
    });
    const setFields = buildPreferencesFieldSetFromPatch(patch);
    assert.deepEqual(Object.keys(setFields).sort(), [
      "experiencePreferences.interfaceLanguage",
    ]);
    assert.equal(setFields["experiencePreferences.interfaceLanguage"], "uk");
    assert.equal("experiencePreferences.readingLanguages" in setFields, false);
    assert.equal("experiencePreferences.translationPreference" in setFields, false);
  });
});
