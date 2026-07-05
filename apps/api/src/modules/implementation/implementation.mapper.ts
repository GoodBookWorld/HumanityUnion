import type { Implementation } from "@hu/types";

export function mapImplementationLinks(implementation: Implementation): Record<string, string> {
  return {
    self: `/api/v1/implementations/${implementation.implementationId}`,
    initiative: `/api/v1/initiatives/${implementation.initiativeId}`,
    collectiveDecision: `/api/v1/collective-decisions/${implementation.collectiveDecisionId}`,
    petition: `/api/v1/petitions/${implementation.petitionId}`,
    implementationCommitment: `/api/v1/implementation-commitments/${implementation.implementationCommitmentId}`,
  };
}

export function mapImplementationResponse(implementation: Implementation): Implementation {
  return structuredClone(implementation);
}

export function mapImplementationListResponse(implementations: Implementation[]): Implementation[] {
  return implementations.map((implementation) => mapImplementationResponse(implementation));
}
