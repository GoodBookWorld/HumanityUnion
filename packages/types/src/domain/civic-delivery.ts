import type { CivicActionPackageId } from "./civic-action-package.js";
import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/** TASK-040 Civic Action Package delivery identifier. */
export type CivicDeliveryId = string;

export type CivicDeliveryRecipientId = string;

export type CivicDeliveryStatus = "draft" | "sent" | "archived";

export type CivicDeliveryMode = "dev_simulated" | "smtp" | "transactional" | "e_government_api";

export type CivicDeliveryRecipientType =
  | "municipality"
  | "regional_government"
  | "provincial_government"
  | "federal_government"
  | "international_organization"
  | "ngo"
  | "media"
  | "university"
  | "business"
  | "public_official"
  | "other";

export type CivicDeliveryRecipientSource = "recommended" | "user_added";

export type CivicDeliveryRecipientStatus = "selected" | "sent" | "failed" | "skipped";

export const CIVIC_DELIVERY_TRANSITIONS: Record<
  CivicDeliveryStatus,
  readonly CivicDeliveryStatus[]
> = {
  draft: ["sent", "archived"],
  sent: ["archived"],
  archived: [],
};

export function canTransitionCivicDelivery(
  from: CivicDeliveryStatus,
  to: CivicDeliveryStatus,
): boolean {
  return CIVIC_DELIVERY_TRANSITIONS[from].includes(to);
}

export function isCivicDeliveryTerminal(status: CivicDeliveryStatus): boolean {
  return status === "archived";
}

/** TASK-040 delivery workflow aggregate — one record per delivery attempt for a CAP. */
export interface CivicActionPackageDelivery {
  deliveryId: CivicDeliveryId;
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  senderParticipantId: MemberId;
  status: CivicDeliveryStatus;
  deliveryMode?: CivicDeliveryMode;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

/** Recipient address for civic delivery — not a platform account. */
export interface CivicDeliveryRecipient {
  recipientId: CivicDeliveryRecipientId;
  deliveryId: CivicDeliveryId;
  name: string;
  organization?: string;
  recipientType: CivicDeliveryRecipientType;
  email: string;
  reason: string;
  source: CivicDeliveryRecipientSource;
  deliveryStatus: CivicDeliveryRecipientStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

/** Rule-based recommendation before user selection. */
export interface RecommendedCivicDeliveryRecipient {
  name: string;
  organization?: string;
  recipientType: CivicDeliveryRecipientType;
  email: string;
  reason: string;
  source: "recommended";
}
