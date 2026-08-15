import type { MyInitiativeGroupSummary } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export type { MyInitiativeGroupSummary, MyInitiativeGroupRole } from "@hu/types";

/**
 * Communication UX Pack 03.9 Part 3 — Initiative Group Chat's "My
 * Initiative Groups" picker read: every Initiative the signed-in
 * Participant authors or actively collaborates on. Always authenticated
 * (Group Chat has no guest view), so an auth-required error here means the
 * caller should fall back to the signed-out empty state, exactly like the
 * Active Allies directory in Personal Chat mode.
 */
export async function listMyInitiativeGroups(): Promise<MyInitiativeGroupSummary[]> {
  return apiRequest<MyInitiativeGroupSummary[]>("/api/v1/initiatives/my-groups");
}
