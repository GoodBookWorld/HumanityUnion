import type {
  CivicDeliveryId,
  CivicDeliveryRecipientType,
  CivicDeliveryStatus,
} from "./civic-delivery.js";
import type { CivicActionPackageId } from "./civic-action-package.js";
import type { InitiativeId } from "./initiative.js";

export interface CivicDeliveryMetrics {
  deliveryCount: number;
  sentDeliveryCount: number;
  recipientCount: number;
  sentRecipientCount: number;
  failedRecipientCount: number;
  recommendedRecipientCount: number;
  userAddedRecipientCount: number;
}

/** Public delivery log entry — no sender identity or recipient email. */
export interface PublicCivicDeliveryRecipientLogEntry {
  name: string;
  organization?: string;
  recipientType: CivicDeliveryRecipientType;
  deliveryStatus: string;
  reason: string;
  sentAt?: string;
}

export interface PublicCivicDeliveryListItem {
  deliveryId: CivicDeliveryId;
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  status: CivicDeliveryStatus;
  deliveryMode?: string;
  sentAt?: string;
  recipientCount: number;
  sentRecipientCount: number;
}

/** Public delivery detail for transparent audit log. */
export interface PublicCivicDeliveryProjection {
  deliveryId: CivicDeliveryId;
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  status: CivicDeliveryStatus;
  deliveryMode?: string;
  sentAt?: string;
  recipients: PublicCivicDeliveryRecipientLogEntry[];
}
