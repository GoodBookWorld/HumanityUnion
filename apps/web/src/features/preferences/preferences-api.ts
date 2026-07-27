import type { MemberPreferences } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getMyPreferences(): Promise<MemberPreferences> {
  return apiRequest<MemberPreferences>("/api/v1/preferences/me");
}

export async function updateMyPreferences(
  patch: Partial<MemberPreferences>,
): Promise<MemberPreferences> {
  return apiRequest<MemberPreferences>("/api/v1/preferences/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
}

/** @deprecated Use getMyPreferences */
export async function getCurrentPreferences(): Promise<MemberPreferences> {
  return getMyPreferences();
}
