import type { BetaInvitePublic } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function listBetaInvitesForAdmin(): Promise<readonly BetaInvitePublic[]> {
  const data = await apiRequest<{ invites: BetaInvitePublic[] }>("/api/v1/beta-invites");
  return data.invites;
}

export interface CreateBetaInviteResult {
  invite: BetaInvitePublic;
  /** One-time invite code returned only on create — never re-fetched. */
  code: string;
}

export async function createBetaInviteForAdmin(email: string): Promise<CreateBetaInviteResult> {
  return apiRequest<CreateBetaInviteResult>("/api/v1/beta-invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
