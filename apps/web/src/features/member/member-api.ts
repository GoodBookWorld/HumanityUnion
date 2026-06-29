import type { Member } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getCurrentMember(): Promise<Member> {
  return apiRequest<Member>("/api/v1/members/me");
}
