import type {
  CivicActionPackageDelivery,
  CivicDeliveryRecipient,
  CivicDeliveryRecipientType,
  RecommendedCivicDeliveryRecipient,
} from "@hu/types";
import { canTransitionCivicDelivery } from "@hu/types";

import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import { assertInitiativeOwnership } from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { resolveCivicDeliveryProvider } from "./civic-delivery-provider.js";
import { ensureAccountabilityFromDelivery } from "../civic-accountability/civic-accountability-auto-start.js";
import { recommendCivicDeliveryRecipients } from "./civic-delivery-recommendations.js";
import {
  createDelivery,
  createRecipient,
  deleteRecipient,
  getDeliveryById,
  getDraftDeliveryForCap,
  getRecipientById,
  listDeliveriesBySender,
  listRecipientsByDelivery,
  updateDelivery,
  updateRecipient,
} from "./civic-delivery.store.js";

export interface CreateCivicDeliveryDraftInput {
  capId: string;
}

export interface AddCivicDeliveryRecipientInput {
  name: string;
  organization?: string;
  recipientType: CivicDeliveryRecipientType;
  email: string;
  reason: string;
  source: "recommended" | "user_added";
}

function getOwnedDraftDelivery(
  deliveryId: string,
  identity: RequestIdentity,
): CivicActionPackageDelivery {
  const delivery = getDeliveryById(deliveryId);

  if (!delivery) {
    throw new Error("Delivery record not found.");
  }

  if (delivery.senderParticipantId !== identity.participantId) {
    throw new Error("You do not have access to this delivery record.");
  }

  if (delivery.status !== "draft") {
    throw new Error("Only draft delivery records can be modified.");
  }

  return delivery;
}

function assertCapEligibleForDelivery(capId: string): void {
  const capPackage = getCapById(capId);

  if (!capPackage) {
    throw new Error("Civic Action Package not found.");
  }

  if (capPackage.status !== "issued") {
    throw new Error("Only issued Civic Action Packages can be delivered.");
  }
}

export function createCivicDeliveryDraft(
  identity: RequestIdentity,
  input: CreateCivicDeliveryDraftInput,
): CivicActionPackageDelivery {
  assertCapEligibleForDelivery(input.capId);

  const capPackage = getCapById(input.capId);

  if (!capPackage) {
    throw new Error("Civic Action Package not found.");
  }

  const initiative = getInitiativeById(capPackage.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  const existingDraft = getDraftDeliveryForCap(input.capId, identity.participantId);

  if (existingDraft) {
    return existingDraft;
  }

  const now = new Date().toISOString();

  const delivery: CivicActionPackageDelivery = {
    deliveryId: `civic-delivery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    capId: capPackage.capId,
    initiativeId: capPackage.initiativeId,
    decisionId: capPackage.decisionId,
    senderParticipantId: identity.participantId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  return createDelivery(delivery);
}

export function listRecommendedCivicDeliveryRecipients(
  capId: string,
): RecommendedCivicDeliveryRecipient[] {
  assertCapEligibleForDelivery(capId);

  return recommendCivicDeliveryRecipients(capId);
}

export function addCivicDeliveryRecipient(
  identity: RequestIdentity,
  deliveryId: string,
  input: AddCivicDeliveryRecipientInput,
): CivicDeliveryRecipient {
  const delivery = getOwnedDraftDelivery(deliveryId, identity);
  const normalizedEmail = input.email.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new Error("Recipient email must be a valid address.");
  }

  const existing = listRecipientsByDelivery(delivery.deliveryId).find(
    (recipient) => recipient.email.toLowerCase() === normalizedEmail,
  );

  if (existing) {
    throw new Error("Recipient with this email is already selected for delivery.");
  }

  const now = new Date().toISOString();

  const recipient: CivicDeliveryRecipient = {
    recipientId: `civic-recipient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deliveryId: delivery.deliveryId,
    name: input.name.trim(),
    organization: input.organization?.trim() || undefined,
    recipientType: input.recipientType,
    email: normalizedEmail,
    reason: input.reason.trim(),
    source: input.source,
    deliveryStatus: "selected",
    createdAt: now,
    updatedAt: now,
  };

  return createRecipient(recipient);
}

export function removeCivicDeliveryRecipient(
  identity: RequestIdentity,
  deliveryId: string,
  recipientId: string,
): void {
  getOwnedDraftDelivery(deliveryId, identity);

  const recipient = getRecipientById(recipientId);

  if (!recipient || recipient.deliveryId !== deliveryId) {
    throw new Error("Recipient not found.");
  }

  if (recipient.deliveryStatus !== "selected") {
    throw new Error("Only selected recipients can be removed before sending.");
  }

  deleteRecipient(recipientId);
}

export interface CivicDeliveryDetail {
  delivery: CivicActionPackageDelivery;
  recipients: CivicDeliveryRecipient[];
}

export function getMyCivicDelivery(
  identity: RequestIdentity,
  deliveryId: string,
): CivicDeliveryDetail | null {
  const delivery = getDeliveryById(deliveryId);

  if (!delivery || delivery.senderParticipantId !== identity.participantId) {
    return null;
  }

  return {
    delivery,
    recipients: listRecipientsByDelivery(deliveryId),
  };
}

export function listMyCivicDeliveries(identity: RequestIdentity): CivicDeliveryDetail[] {
  return listDeliveriesBySender(identity.participantId).map((delivery) => ({
    delivery,
    recipients: listRecipientsByDelivery(delivery.deliveryId),
  }));
}

export async function sendCivicDelivery(
  identity: RequestIdentity,
  deliveryId: string,
): Promise<CivicDeliveryDetail> {
  const delivery = getOwnedDraftDelivery(deliveryId, identity);
  const selectedRecipients = listRecipientsByDelivery(deliveryId).filter(
    (recipient) => recipient.deliveryStatus === "selected",
  );

  if (selectedRecipients.length === 0) {
    throw new Error("At least one selected recipient is required before sending.");
  }

  if (!canTransitionCivicDelivery(delivery.status, "sent")) {
    throw new Error(`Delivery cannot transition from "${delivery.status}" to "sent".`);
  }

  const capPackage = getCapById(delivery.capId);

  if (!capPackage) {
    throw new Error("Civic Action Package not found.");
  }

  const provider = resolveCivicDeliveryProvider();
  const results = await provider.sendCivicActionPackage(capPackage, selectedRecipients);
  const now = new Date().toISOString();

  for (const result of results) {
    const recipient = getRecipientById(result.recipientId);

    if (!recipient) {
      continue;
    }

    updateRecipient(result.recipientId, {
      deliveryStatus: result.success ? "sent" : "failed",
      sentAt: result.success ? now : undefined,
      updatedAt: now,
    });
  }

  const updatedDelivery = updateDelivery(deliveryId, {
    status: "sent",
    deliveryMode: provider.mode as CivicActionPackageDelivery["deliveryMode"],
    sentAt: now,
    updatedAt: now,
  });

  if (!updatedDelivery) {
    throw new Error("Delivery record not found.");
  }

  ensureAccountabilityFromDelivery(updatedDelivery, identity.participantId);

  return {
    delivery: updatedDelivery,
    recipients: listRecipientsByDelivery(deliveryId),
  };
}
