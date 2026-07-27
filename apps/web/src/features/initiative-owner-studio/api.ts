import type { InitiativeOwnerAccessPayload } from "@hu/types";

import { apiRequest } from "../../lib/api-client";

export async function getInitiativeOwnerAccess(
  initiativeId: string,
): Promise<InitiativeOwnerAccessPayload> {
  return apiRequest<InitiativeOwnerAccessPayload>(
    `/api/v1/initiatives/${encodeURIComponent(initiativeId)}/owner-access`,
  );
}
