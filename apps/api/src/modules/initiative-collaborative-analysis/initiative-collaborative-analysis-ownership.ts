import type { InitiativeCollaborativeAnalysis } from "@hu/types";

import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

export function assertInitiativeCollaborativeAnalysisOwnership(
  analysis: InitiativeCollaborativeAnalysis,
  identity: RequestIdentity,
): void {
  if (analysis.authorId !== identity.participantId) {
    throw new Error("You do not have access to this analysis.");
  }
}

export function isInitiativeCollaborativeAnalysisOwnedBy(
  analysis: InitiativeCollaborativeAnalysis,
  identity: RequestIdentity,
): boolean {
  return analysis.authorId === identity.participantId;
}
