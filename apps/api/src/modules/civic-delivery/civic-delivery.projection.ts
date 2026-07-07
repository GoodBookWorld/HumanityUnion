import type {
  CivicActionPackageDelivery,
  CivicDeliveryMetrics,
  PublicCivicDeliveryListItem,
  PublicCivicDeliveryProjection,
  PublicCivicDeliveryRecipientLogEntry,
} from "@hu/types";

import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import {
  getDeliveryById,
  listDeliveries,
  listDeliveriesByCapId,
  listRecipients,
  listRecipientsByDelivery,
} from "./civic-delivery.store.js";

function toPublicRecipientLogEntry(
  recipient: ReturnType<typeof listRecipientsByDelivery>[number],
): PublicCivicDeliveryRecipientLogEntry {
  return {
    name: recipient.name,
    organization: recipient.organization,
    recipientType: recipient.recipientType,
    deliveryStatus: recipient.deliveryStatus,
    reason: recipient.reason,
    sentAt: recipient.sentAt,
  };
}

export function toPublicCivicDeliveryListItem(
  delivery: CivicActionPackageDelivery,
): PublicCivicDeliveryListItem {
  const deliveryRecipients = listRecipientsByDelivery(delivery.deliveryId);

  return {
    deliveryId: delivery.deliveryId,
    capId: delivery.capId,
    initiativeId: delivery.initiativeId,
    status: delivery.status,
    deliveryMode: delivery.deliveryMode,
    sentAt: delivery.sentAt,
    recipientCount: deliveryRecipients.length,
    sentRecipientCount: deliveryRecipients.filter(
      (recipient) => recipient.deliveryStatus === "sent",
    ).length,
  };
}

export function toPublicCivicDeliveryProjection(
  delivery: NonNullable<ReturnType<typeof getDeliveryById>>,
): PublicCivicDeliveryProjection {
  const deliveryRecipients = listRecipientsByDelivery(delivery.deliveryId);

  return {
    deliveryId: delivery.deliveryId,
    capId: delivery.capId,
    initiativeId: delivery.initiativeId,
    status: delivery.status,
    deliveryMode: delivery.deliveryMode,
    sentAt: delivery.sentAt,
    recipients: deliveryRecipients.map((recipient) => toPublicRecipientLogEntry(recipient)),
  };
}

export function computeCivicDeliveryMetrics(): CivicDeliveryMetrics {
  const allRecipients = listRecipients();
  const deliveries = listDeliveries();

  return {
    deliveryCount: deliveries.length,
    sentDeliveryCount: deliveries.filter((delivery) => delivery.status === "sent").length,
    recipientCount: allRecipients.length,
    sentRecipientCount: allRecipients.filter((recipient) => recipient.deliveryStatus === "sent")
      .length,
    failedRecipientCount: allRecipients.filter((recipient) => recipient.deliveryStatus === "failed")
      .length,
    recommendedRecipientCount: allRecipients.filter(
      (recipient) => recipient.source === "recommended",
    ).length,
    userAddedRecipientCount: allRecipients.filter((recipient) => recipient.source === "user_added")
      .length,
  };
}

export function getPublicCivicDelivery(deliveryId: string): PublicCivicDeliveryProjection | null {
  const delivery = getDeliveryById(deliveryId);

  if (!delivery || delivery.status === "draft") {
    return null;
  }

  return toPublicCivicDeliveryProjection(delivery);
}

export function listPublicCivicDeliveriesForCap(capId: string): PublicCivicDeliveryListItem[] {
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    return [];
  }

  return listDeliveriesByCapId(capId)
    .filter((delivery) => delivery.status !== "draft")
    .map((delivery) => toPublicCivicDeliveryListItem(delivery));
}

export function assertPublicProjectionHasNoPrivateFields(
  projection: PublicCivicDeliveryProjection,
): boolean {
  const serialized = JSON.stringify(projection);

  return (
    !serialized.includes('"participantId"') &&
    !serialized.includes('"senderParticipantId"') &&
    !serialized.includes('"email"') &&
    !serialized.includes('"authorId"') &&
    !serialized.includes('"stewardId"') &&
    !serialized.includes('"memberId"')
  );
}
