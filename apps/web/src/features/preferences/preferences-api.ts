import type { MemberPreferences } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

/** Fired after a successful preferences PATCH so public content can re-read readingLanguages. */
export const MEMBER_PREFERENCES_CHANGED_EVENT = "hu:member-preferences-changed";

export async function getMyPreferences(): Promise<MemberPreferences> {
  return apiRequest<MemberPreferences>("/api/v1/preferences/me");
}

export async function updateMyPreferences(
  patch: Partial<MemberPreferences>,
): Promise<MemberPreferences> {
  const updated = await apiRequest<MemberPreferences>("/api/v1/preferences/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MEMBER_PREFERENCES_CHANGED_EVENT));
  }
  return updated;
}

/** @deprecated Use getMyPreferences */
export async function getCurrentPreferences(): Promise<MemberPreferences> {
  return getMyPreferences();
}
