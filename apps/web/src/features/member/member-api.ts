import type { Member, MemberPublicProjection } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getCurrentMember(): Promise<Member> {
  return apiRequest<Member>("/api/v1/members/me");
}

export async function getPublicMember(uniqueName: string): Promise<MemberPublicProjection> {
  return apiRequest<MemberPublicProjection>(
    `/api/v1/members/public/${encodeURIComponent(uniqueName)}`,
  );
}
