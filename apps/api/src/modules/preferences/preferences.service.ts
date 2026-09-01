import type { MemberPreferences } from "@hu/types";

import {
  assertEnabledPreferenceLocale,
} from "../language/language-registry-runtime.js";
import { buildDefaultMemberPreferences } from "./preferences.defaults.js";
import {
  applyPreferencesPatchAtomically,
  findPreferencesByMemberId,
  getOrCreatePreferencesForMember,
  insertPreferences,
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

function isDuplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key|E11000/i.test(message);
}

export async function getMemberPreferencesForAuthUser(input: {
  memberId: string;
  userId?: string;
}): Promise<MemberPreferences> {
  return getOrCreatePreferencesForMember(input);
}

/**
 * Pack 02G Task 07B — partial preference updates apply only validated patch fields
 * atomically. Sibling fields (e.g. readingLanguages vs interfaceLanguage) cannot be
 * clobbered by a stale full-document read-modify-write.
 */
export async function updateMemberPreferencesForAuthUser(
  memberId: string,
  body: unknown,
): Promise<MemberPreferences> {
  const rawPatch: ValidatedPreferencesPatch = validatePreferencesPatch(body);
  const patch = await canonicalizeExperienceLanguageFields(rawPatch);

  const existing = await findPreferencesByMemberId(memberId);
  if (!existing) {
    const initial = mergePreferencesPatch(
      buildDefaultMemberPreferences({ memberId }),
      patch,
    );
    try {
      return await insertPreferences(initial);
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      // Concurrent first create — apply patch atomically onto the winner.
    }
  }

  const updated = await applyPreferencesPatchAtomically(memberId, patch);
  if (!updated) {
    throw new Error("Member preferences could not be updated.");
  }

  return updated;
}
