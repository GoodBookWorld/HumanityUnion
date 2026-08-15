import type { OwnershipCheck, OwnershipRelation } from "@hu/types";

import { AdministrationForbiddenError } from "./administration.errors.js";

/**
 * Ownership is orthogonal to administrative capabilities.
 * Initiative Author / Blog Author / self resources continue to use ownership checks.
 */
export function isOwner(check: OwnershipCheck): boolean {
  return (
    check.actorParticipantId.length > 0 &&
    check.actorParticipantId === check.ownerParticipantId
  );
}

export function assertOwnership(check: OwnershipCheck, message?: string): void {
  if (!isOwner(check)) {
    throw new AdministrationForbiddenError(
      message ?? `Ownership required (${check.relation}).`,
    );
  }
}

export function ownershipOf(
  relation: OwnershipRelation,
  actorParticipantId: string,
  ownerParticipantId: string,
): OwnershipCheck {
  return { relation, actorParticipantId, ownerParticipantId };
}
