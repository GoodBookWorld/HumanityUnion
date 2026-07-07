import type { CivicAccountability, CivicActionPackageDelivery, OfficialResponse } from "@hu/types";

import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { listRecipientsByDelivery } from "../civic-delivery/civic-delivery.store.js";
import {
  createAccountability,
  getAccountabilityByCapId,
  updateAccountability,
} from "./civic-accountability.store.js";

function buildAccountabilityId(capId: string): string {
  return `civic-accountability-${capId}`;
}

function createAccountabilityRecord(input: {
  capId: string;
  initiativeId: string;
  decisionId: string;
  createdByParticipantId: string;
  deliveryId?: string;
  recipientId?: string;
  responseId?: string;
}): CivicAccountability {
  const now = new Date().toISOString();

  return {
    accountabilityId: buildAccountabilityId(input.capId),
    capId: input.capId,
    initiativeId: input.initiativeId,
    decisionId: input.decisionId,
    deliveryId: input.deliveryId,
    recipientId: input.recipientId,
    responseId: input.responseId,
    createdByParticipantId: input.createdByParticipantId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export function ensureAccountabilityFromDelivery(
  delivery: CivicActionPackageDelivery,
  createdByParticipantId: string,
): CivicAccountability {
  const capPackage = getCapById(delivery.capId);

  if (!capPackage) {
    throw new Error("Civic Action Package not found.");
  }

  const existing = getAccountabilityByCapId(delivery.capId);
  const sentRecipient = listRecipientsByDelivery(delivery.deliveryId).find(
    (recipient) => recipient.deliveryStatus === "sent",
  );
  const now = new Date().toISOString();

  if (existing) {
    const updated = updateAccountability(existing.accountabilityId, {
      deliveryId: existing.deliveryId ?? delivery.deliveryId,
      recipientId: existing.recipientId ?? sentRecipient?.recipientId,
      updatedAt: now,
    });

    return updated ?? existing;
  }

  return createAccountability(
    createAccountabilityRecord({
      capId: delivery.capId,
      initiativeId: delivery.initiativeId,
      decisionId: capPackage.decisionId,
      createdByParticipantId,
      deliveryId: delivery.deliveryId,
      recipientId: sentRecipient?.recipientId,
    }),
  );
}

export function ensureAccountabilityFromResponse(response: OfficialResponse): CivicAccountability {
  const capPackage = getCapById(response.capId);

  if (!capPackage) {
    throw new Error("Civic Action Package not found.");
  }

  const existing = getAccountabilityByCapId(response.capId);
  const now = new Date().toISOString();

  if (existing) {
    const updated = updateAccountability(existing.accountabilityId, {
      responseId: response.responseId,
      deliveryId: existing.deliveryId ?? response.deliveryId,
      recipientId: existing.recipientId ?? response.recipientId,
      updatedAt: now,
    });

    return updated ?? existing;
  }

  return createAccountability(
    createAccountabilityRecord({
      capId: response.capId,
      initiativeId: response.initiativeId,
      decisionId: response.decisionId,
      createdByParticipantId: response.recordedByParticipantId,
      deliveryId: response.deliveryId,
      recipientId: response.recipientId,
      responseId: response.responseId,
    }),
  );
}
