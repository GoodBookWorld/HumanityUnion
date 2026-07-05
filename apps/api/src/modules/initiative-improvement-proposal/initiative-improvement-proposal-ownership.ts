import type { InitiativeImprovementProposal } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

export function assertInitiativeImprovementProposalOwnership(
  proposal: InitiativeImprovementProposal,
  identity: RequestIdentity,
): void {
  if (proposal.authorId !== identity.participantId) {
    throw new Error("You do not have access to this improvement proposal.");
  }
}

export function isInitiativeImprovementProposalOwnedBy(
  proposal: InitiativeImprovementProposal,
  identity: RequestIdentity,
): boolean {
  return proposal.authorId === identity.participantId;
}
