import type { CivicActionPackageDelivery, CivicDeliveryRecipient } from "@hu/types";

import { resolveCivicDeliveryPersistenceAdapter } from "./persistence/resolve-civic-delivery-persistence.js";
import { snapshotFromCivicDeliveryRecords } from "./persistence/civic-delivery-persistence.types.js";

const persistence = resolveCivicDeliveryPersistenceAdapter();

function loadRecords(): {
  deliveries: Map<string, CivicActionPackageDelivery>;
  recipients: Map<string, CivicDeliveryRecipient>;
} {
  const snapshot = persistence.load();

  return {
    deliveries: new Map<string, CivicActionPackageDelivery>(
      Object.entries(snapshot.deliveries).map(([deliveryId, delivery]) => [
        deliveryId,
        structuredClone(delivery),
      ]),
    ),
    recipients: new Map<string, CivicDeliveryRecipient>(
      Object.entries(snapshot.recipients).map(([recipientId, recipient]) => [
        recipientId,
        structuredClone(recipient),
      ]),
    ),
  };
}

const { deliveries, recipients } = loadRecords();

function persistRecords(): void {
  persistence.save(snapshotFromCivicDeliveryRecords(deliveries, recipients));
}

export function getPersistenceMode(): "file" | "memory" {
  return persistence.mode;
}

export function getDeliveryById(deliveryId: string): CivicActionPackageDelivery | null {
  const delivery = deliveries.get(deliveryId);

  return delivery ? structuredClone(delivery) : null;
}

export function listDeliveries(): CivicActionPackageDelivery[] {
  return Array.from(deliveries.values(), (delivery) => structuredClone(delivery));
}

export function listDeliveriesByCapId(capId: string): CivicActionPackageDelivery[] {
  return listDeliveries()
    .filter((delivery) => delivery.capId === capId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listDeliveriesBySender(senderParticipantId: string): CivicActionPackageDelivery[] {
  return listDeliveries()
    .filter((delivery) => delivery.senderParticipantId === senderParticipantId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getDraftDeliveryForCap(
  capId: string,
  senderParticipantId: string,
): CivicActionPackageDelivery | null {
  const draft = listDeliveriesByCapId(capId).find(
    (delivery) =>
      delivery.senderParticipantId === senderParticipantId && delivery.status === "draft",
  );

  return draft ? structuredClone(draft) : null;
}

export function createDelivery(delivery: CivicActionPackageDelivery): CivicActionPackageDelivery {
  if (deliveries.has(delivery.deliveryId)) {
    throw new Error("Delivery record already exists.");
  }

  deliveries.set(delivery.deliveryId, structuredClone(delivery));
  persistRecords();

  return structuredClone(delivery);
}

export function updateDelivery(
  deliveryId: string,
  update: Partial<
    Pick<CivicActionPackageDelivery, "status" | "deliveryMode" | "sentAt" | "updatedAt">
  >,
): CivicActionPackageDelivery | null {
  const existing = deliveries.get(deliveryId);

  if (!existing) {
    return null;
  }

  const updated: CivicActionPackageDelivery = {
    ...existing,
    ...update,
  };

  deliveries.set(deliveryId, updated);
  persistRecords();

  return structuredClone(updated);
}

export function getRecipientById(recipientId: string): CivicDeliveryRecipient | null {
  const recipient = recipients.get(recipientId);

  return recipient ? structuredClone(recipient) : null;
}

export function listRecipientsByDelivery(deliveryId: string): CivicDeliveryRecipient[] {
  return Array.from(recipients.values(), (recipient) => structuredClone(recipient))
    .filter((recipient) => recipient.deliveryId === deliveryId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listRecipients(): CivicDeliveryRecipient[] {
  return Array.from(recipients.values(), (recipient) => structuredClone(recipient));
}

export function createRecipient(recipient: CivicDeliveryRecipient): CivicDeliveryRecipient {
  if (recipients.has(recipient.recipientId)) {
    throw new Error("Recipient already exists.");
  }

  recipients.set(recipient.recipientId, structuredClone(recipient));
  persistRecords();

  return structuredClone(recipient);
}

export function updateRecipient(
  recipientId: string,
  update: Partial<Pick<CivicDeliveryRecipient, "deliveryStatus" | "sentAt" | "updatedAt">>,
): CivicDeliveryRecipient | null {
  const existing = recipients.get(recipientId);

  if (!existing) {
    return null;
  }

  const updated: CivicDeliveryRecipient = {
    ...existing,
    ...update,
  };

  recipients.set(recipientId, updated);
  persistRecords();

  return structuredClone(updated);
}

export function deleteRecipient(recipientId: string): boolean {
  const deleted = recipients.delete(recipientId);

  if (deleted) {
    persistRecords();
  }

  return deleted;
}
