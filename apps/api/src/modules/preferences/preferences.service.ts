import type { MemberPreferences } from "@hu/types";

import {
  assertEnabledPreferenceLocale,
} from "../language/language-registry-runtime.js";
import {
  getOrCreatePreferencesForMember,
  updatePreferencesRecord,
} from "./preferences.repository.js";
import {
  mergePreferencesPatch,
  validatePreferencesPatch,
  type ValidatedPreferencesPatch,
} from "./preferences.validators.js";

/**
 * Canonicalize interface / reading / writing languages against enabled Registry locales.
 * Preserves the three distinct preference fields; aliases normalize to canonical locale.
 */
async function canonicalizeExperienceLanguageFields(
  patch: ValidatedPreferencesPatch,
): Promise<ValidatedPreferencesPatch> {
  const experience = patch.experiencePreferences;
  if (!experience) {
    return patch;
  }

  const nextExperience = { ...experience };

  if (experience.interfaceLanguage !== undefined) {
    nextExperience.interfaceLanguage = await assertEnabledPreferenceLocale(
      experience.interfaceLanguage,
      "interfaceLanguage",
    );
  }

  if (experience.readingLanguages !== undefined) {
    const canonical: string[] = [];
    for (const entry of experience.readingLanguages) {
      canonical.push(await assertEnabledPreferenceLocale(entry, "readingLanguages"));
    }
    nextExperience.readingLanguages = canonical;
  }

  if (experience.writingLanguages !== undefined) {
    const canonical: string[] = [];
    for (const entry of experience.writingLanguages) {
      canonical.push(await assertEnabledPreferenceLocale(entry, "writingLanguages"));
    }
    nextExperience.writingLanguages = canonical;
  }

  return {
    ...patch,
    experiencePreferences: nextExperience,
  };
}

export async function getMemberPreferencesForAuthUser(input: {
  memberId: string;
  userId?: string;
}): Promise<MemberPreferences> {
  return getOrCreatePreferencesForMember(input);
}

export async function updateMemberPreferencesForAuthUser(
  memberId: string,
  body: unknown,
): Promise<MemberPreferences> {
  const rawPatch: ValidatedPreferencesPatch = validatePreferencesPatch(body);
  const patch = await canonicalizeExperienceLanguageFields(rawPatch);
  const current = await getOrCreatePreferencesForMember({ memberId });
  const next = mergePreferencesPatch(current, patch);
  const updated = await updatePreferencesRecord(memberId, next);

  if (!updated) {
    throw new Error("Member preferences could not be updated.");
  }

  return updated;
}
