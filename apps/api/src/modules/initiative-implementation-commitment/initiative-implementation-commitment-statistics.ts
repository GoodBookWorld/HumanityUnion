import type { InitiativeImplementationCommitment } from "@hu/types";
import { isInitiativeImplementationCommitmentTerminal } from "@hu/types";

/**
 * Pack 19B — Participant Implementation Commitment statistics.
 *
 * Counts use current canonical Commitment fields only:
 * `participantId` + `proposalStatus === "accepted"` (+ status for active/fulfilled).
 *
 * Legacy TASK-031 records (`proposalStatus == null`) are intentionally excluded
 * until migrated — they are execution-owned via
 * `hasAcceptedImplementationResponsibility` but are not package Accept/Take facts.
 *
 * `proposalHistory` / transferred-away entries never contribute.
 */

export interface ImplementationCommitmentStatistics {
  /** Currently attributed accepted responsibility (includes completed/withdrawn). */
  readonly accepted: number;
  /** Accepted and not terminal (`status === "published"`). */
  readonly active: number;
  /** Accepted and `status === "completed"` — "Commitments Fulfilled". */
  readonly fulfilled: number;
}

/**
 * Package Accept / Take / transfer-Accept facts only.
 * Requires valid server `acceptedAt` (same bar as execution gates for package rows).
 */
export function isCanonicalAcceptedCommitmentForStatistics(
  commitment: Pick<
    InitiativeImplementationCommitment,
    "participantId" | "proposalStatus" | "acceptedAt"
  >,
  participantId: string,
): boolean {
  if (!participantId || commitment.participantId !== participantId) {
    return false;
  }

  if (commitment.proposalStatus !== "accepted") {
    return false;
  }

  if (typeof commitment.acceptedAt !== "string" || commitment.acceptedAt.trim().length === 0) {
    return false;
  }

  return !Number.isNaN(Date.parse(commitment.acceptedAt));
}

export function isActiveAcceptedCommitmentForStatistics(
  commitment: Pick<
    InitiativeImplementationCommitment,
    "participantId" | "proposalStatus" | "acceptedAt" | "status"
  >,
  participantId: string,
): boolean {
  if (!isCanonicalAcceptedCommitmentForStatistics(commitment, participantId)) {
    return false;
  }

  return (
    commitment.status === "published" &&
    !isInitiativeImplementationCommitmentTerminal(commitment.status)
  );
}

export function isFulfilledCommitmentForStatistics(
  commitment: Pick<
    InitiativeImplementationCommitment,
    "participantId" | "proposalStatus" | "acceptedAt" | "status"
  >,
  participantId: string,
): boolean {
  return (
    isCanonicalAcceptedCommitmentForStatistics(commitment, participantId) &&
    commitment.status === "completed"
  );
}

export function computeImplementationCommitmentStatistics(
  commitments: readonly Pick<
    InitiativeImplementationCommitment,
    "participantId" | "proposalStatus" | "acceptedAt" | "status"
  >[],
  participantId: string,
): ImplementationCommitmentStatistics {
  let accepted = 0;
  let active = 0;
  let fulfilled = 0;

  for (const commitment of commitments) {
    if (!isCanonicalAcceptedCommitmentForStatistics(commitment, participantId)) {
      continue;
    }

    accepted += 1;

    if (isActiveAcceptedCommitmentForStatistics(commitment, participantId)) {
      active += 1;
    }

    if (isFulfilledCommitmentForStatistics(commitment, participantId)) {
      fulfilled += 1;
    }
  }

  return { accepted, active, fulfilled };
}
