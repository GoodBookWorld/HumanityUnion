import type { ImplementationCommitment } from "@hu/types";

export function mapImplementationCommitmentLinks(
  commitment: ImplementationCommitment,
): Record<string, string> {
  return {
    self: `/api/v1/implementation-commitments/${commitment.implementationCommitmentId}`,
    initiative: `/api/v1/initiatives/${commitment.initiativeId}`,
    collectiveDecision: `/api/v1/collective-decisions/${commitment.collectiveDecisionId}`,
    petition: `/api/v1/petitions/${commitment.petitionId}`,
  };
}

export function mapImplementationCommitmentResponse(
  commitment: ImplementationCommitment,
): ImplementationCommitment {
  return structuredClone(commitment);
}

export function mapImplementationCommitmentListResponse(
  commitments: ImplementationCommitment[],
): ImplementationCommitment[] {
  return commitments.map((commitment) => mapImplementationCommitmentResponse(commitment));
}
