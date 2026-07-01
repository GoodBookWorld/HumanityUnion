import type { MemberPreferences } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getCurrentPreferences(): Promise<MemberPreferences> {
  return apiRequest<MemberPreferences>("/api/v1/preferences/me");
}
