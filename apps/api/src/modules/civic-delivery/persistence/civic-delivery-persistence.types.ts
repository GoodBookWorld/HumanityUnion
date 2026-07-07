import type { CivicActionPackageDelivery, CivicDeliveryRecipient } from "@hu/types";

export interface CivicDeliveryPersistenceSnapshot {
  version: 1;
  deliveries: Record<string, CivicActionPackageDelivery>;
  recipients: Record<string, CivicDeliveryRecipient>;
}

export interface CivicDeliveryPersistenceAdapter {
  readonly mode: "file" | "memory";
  load(): CivicDeliveryPersistenceSnapshot;
  save(snapshot: CivicDeliveryPersistenceSnapshot): void;
}

export function createEmptyCivicDeliveryPersistenceSnapshot(): CivicDeliveryPersistenceSnapshot {
  return {
    version: 1,
    deliveries: {},
    recipients: {},
  };
}

export function snapshotFromCivicDeliveryRecords(
  deliveries: Map<string, CivicActionPackageDelivery>,
  recipients: Map<string, CivicDeliveryRecipient>,
): CivicDeliveryPersistenceSnapshot {
  const serializedDeliveries: Record<string, CivicActionPackageDelivery> = {};
  const serializedRecipients: Record<string, CivicDeliveryRecipient> = {};

  for (const [deliveryId, delivery] of deliveries) {
    serializedDeliveries[deliveryId] = structuredClone(delivery);
  }

  for (const [recipientId, recipient] of recipients) {
    serializedRecipients[recipientId] = structuredClone(recipient);
  }

  return {
    version: 1,
    deliveries: serializedDeliveries,
    recipients: serializedRecipients,
  };
}
