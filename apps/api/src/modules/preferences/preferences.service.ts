import type { MemberPreferences } from "@hu/types";

import {
  getOrCreatePreferencesForMember,
  updatePreferencesRecord,
} from "./preferences.repository.js";
import {
  mergePreferencesPatch,
  validatePreferencesPatch,
  type ValidatedPreferencesPatch,
} from "./preferences.validators.js";

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
  const patch: ValidatedPreferencesPatch = validatePreferencesPatch(body);
  const current = await getOrCreatePreferencesForMember({ memberId });
  const next = mergePreferencesPatch(current, patch);
  const updated = await updatePreferencesRecord(memberId, next);

  if (!updated) {
    throw new Error("Member preferences could not be updated.");
  }

  return updated;
}
