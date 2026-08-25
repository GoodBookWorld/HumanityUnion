/**
 * Pack 19A.2 — UX invariant for follow-up Packs (19A.3+):
 *
 * The Lifecycle Implementation Commitments interface must NOT become a row of
 * permanent management buttons. Prefer state-driven contextual controls:
 * UNASSIGNED → "Available" + one eligible primary action;
 * PROPOSED (self) → "Awaiting your response" (inbox/notification-first);
 * PROPOSED (other) → "Awaiting response";
 * ACCEPTED → responsible identity + "Accepted";
 * COMPLETED → responsible identity + completion state.
 * Explain state more often than offer buttons.
 */

import {
  hasAcceptedImplementationResponsibility,
  isPackageActionImplementationCommitment,
  type InitiativeImplementationCommitment,
} from "@hu/types";

export {
  hasAcceptedImplementationResponsibility,
  isPackageActionImplementationCommitment,
};

/**
 * Execution-responsibility gate for Complete / Withdraw / Tracking on
 * package Action-Commitments. Legacy TASK-031 (no proposalStatus) remains
 * participantId-owned without requiring Accept.
 */
export function assertAcceptedImplementationResponsibility(
  commitment: InitiativeImplementationCommitment,
  participantId: string,
  operationLabel: string,
): void {
  if (hasAcceptedImplementationResponsibility(commitment, participantId)) {
    return;
  }

  if (isPackageActionImplementationCommitment(commitment)) {
    if (commitment.proposalStatus === "proposed") {
      throw new Error(
        `Only an accepted Implementation Commitment can be ${operationLabel}. Accept the proposal first.`,
      );
    }

    if (commitment.proposalStatus === "unassigned") {
      throw new Error(
        `Only an accepted Implementation Commitment can be ${operationLabel}. This Action is still unassigned.`,
      );
    }

    if (commitment.proposalStatus === "declined") {
      throw new Error(
        `Only an accepted Implementation Commitment can be ${operationLabel}. This proposal was declined.`,
      );
    }
  }

  throw new Error(`You do not have accepted responsibility for this implementation commitment.`);
}

/**
 * Pack 19A.3 — Take Commitment transition (domain prep only; no route/UI yet).
 *
 * published + unassigned → same canonical accepted-responsibility fact as Accept:
 *   participantId = actor
 *   proposalStatus = "accepted"
 *   acceptedAt = server timestamp
 */
export function buildTakeImplementationCommitmentAcceptanceUpdate(
  commitment: InitiativeImplementationCommitment,
  actorParticipantId: string,
  acceptedAt: string = new Date().toISOString(),
): Pick<InitiativeImplementationCommitment, "participantId" | "proposalStatus" | "acceptedAt"> {
  if (commitment.status !== "published") {
    throw new Error("Only a published Implementation Commitment can be taken.");
  }

  if (commitment.proposalStatus !== "unassigned") {
    throw new Error("Only an unassigned Implementation Commitment can be taken.");
  }

  if (!actorParticipantId.trim()) {
    throw new Error("Participant identity is required to take an Implementation Commitment.");
  }

  if (!isValidAcceptedAt(acceptedAt)) {
    throw new Error("acceptedAt must be a valid server timestamp.");
  }

  return {
    participantId: actorParticipantId,
    proposalStatus: "accepted",
    acceptedAt,
  };
}

function isValidAcceptedAt(acceptedAt: string): boolean {
  return acceptedAt.trim().length > 0 && !Number.isNaN(Date.parse(acceptedAt));
}
