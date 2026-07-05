import type { Initiative } from "@hu/types";

import type { RequestIdentity } from "./identity/request-identity.types.js";

export function assertInitiativeOwnership(initiative: Initiative, identity: RequestIdentity): void {
  if (initiative.stewardId !== identity.participantId) {
    throw new Error("You do not have access to this initiative.");
  }
}

export function isInitiativeOwnedBy(initiative: Initiative, identity: RequestIdentity): boolean {
  return initiative.stewardId === identity.participantId;
}
