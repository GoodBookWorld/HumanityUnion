import type { CivicActionPackageId } from "./civic-action-package.js";
import type { CivicDeliveryId, CivicDeliveryRecipientId } from "./civic-delivery.js";
import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";
import type { OfficialResponseId } from "./official-response.js";

/** TASK-042 Civic Accountability identifier. */
export type CivicAccountabilityId = string;

export type CivicAccountabilityStatus = "active" | "closed" | "archived";

export const CIVIC_ACCOUNTABILITY_STATUS_TRANSITIONS: Record<
  CivicAccountabilityStatus,
  readonly CivicAccountabilityStatus[]
> = {
  active: ["closed", "archived"],
  closed: ["archived"],
  archived: [],
};

export function canTransitionCivicAccountabilityStatus(
  from: CivicAccountabilityStatus,
  to: CivicAccountabilityStatus,
): boolean {
  return CIVIC_ACCOUNTABILITY_STATUS_TRANSITIONS[from].includes(to);
}

export type CivicAccountabilityEventId = string;

export type CivicAccountabilityEventType =
  | "follow_up_sent"
  | "response_received"
  | "institution_action_reported"
  | "no_response_observed"
  | "public_statement_recorded"
  | "meeting_recorded"
  | "document_received"
  | "implementation_started"
  | "implementation_delayed"
  | "implementation_completed"
  | "correction_added"
  | "other";

/** Immutable accountability event — corrections add new events. */
export interface CivicAccountabilityEvent {
  eventId: CivicAccountabilityEventId;
  accountabilityId: CivicAccountabilityId;
  eventType: CivicAccountabilityEventType;
  title: string;
  summary: string;
  evidenceReference?: string;
  occurredAt: string;
  recordedAt: string;
  recordedByParticipantId: MemberId;
}

/** TASK-042 Civic Accountability aggregate — public follow-up timeline for one CAP. */
export interface CivicAccountability {
  accountabilityId: CivicAccountabilityId;
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  deliveryId?: CivicDeliveryId;
  recipientId?: CivicDeliveryRecipientId;
  responseId?: OfficialResponseId;
  createdByParticipantId: MemberId;
  status: CivicAccountabilityStatus;
  createdAt: string;
  updatedAt: string;
}
