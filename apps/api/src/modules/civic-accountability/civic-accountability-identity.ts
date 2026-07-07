import type { CivicAccountability } from "@hu/types";

import { listDeliveriesByCapId } from "../civic-delivery/civic-delivery.store.js";
import { listCommitmentsByInitiative } from "../initiative-implementation-commitment/initiative-implementation-commitment.store.js";
import { listTrackingsByInitiative } from "../initiative-implementation-tracking/initiative-implementation-tracking.store.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { isInitiativeOwnedBy } from "../initiatives/initiative-ownership.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";

export function canRecordCivicAccountability(
  accountability: CivicAccountability,
  identity: RequestIdentity,
): boolean {
  const initiative = getInitiativeById(accountability.initiativeId);

  if (!initiative) {
    return false;
  }

  if (isInitiativeOwnedBy(initiative, identity)) {
    return true;
  }

  const isCapSender = listDeliveriesByCapId(accountability.capId).some(
    (delivery) =>
      delivery.status === "sent" && delivery.senderParticipantId === identity.participantId,
  );

  if (isCapSender) {
    return true;
  }

  const isCommitmentAuthor = listCommitmentsByInitiative(accountability.initiativeId).some(
    (commitment) => commitment.participantId === identity.participantId,
  );

  if (isCommitmentAuthor) {
    return true;
  }

  const isTrackingAuthor = listTrackingsByInitiative(accountability.initiativeId).some(
    (tracking) => tracking.participantId === identity.participantId,
  );

  return isTrackingAuthor;
}

export function assertCanRecordCivicAccountability(
  accountability: CivicAccountability,
  identity: RequestIdentity,
): void {
  if (!canRecordCivicAccountability(accountability, identity)) {
    throw new Error("You do not have access to record civic accountability for this CAP.");
  }
}
