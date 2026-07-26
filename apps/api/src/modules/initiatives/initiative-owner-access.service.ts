import type { InitiativeOwnerAccessPayload } from "@hu/types";

import type { RequestIdentity } from "./identity/request-identity.types.js";
import { isInitiativeOwnedBy } from "./initiative-ownership.js";
import { getInitiativeById } from "./initiative.store.js";

export function getInitiativeOwnerAccess(input: {
  initiativeId: string;
  identity: RequestIdentity;
}): InitiativeOwnerAccessPayload {
  const initiative = getInitiativeById(input.initiativeId);

  if (!initiative || !isInitiativeOwnedBy(initiative, input.identity)) {
    return {
      canManage: false,
      initiative: null,
    };
  }

  return {
    canManage: true,
    initiative,
  };
}
