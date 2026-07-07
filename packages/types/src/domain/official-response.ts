import type { CivicActionPackageId } from "./civic-action-package.js";
import type { CivicDeliveryId, CivicDeliveryRecipientId } from "./civic-delivery.js";
import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/** TASK-041 Official Response identifier. */
export type OfficialResponseId = string;

export type OfficialResponseType =
  | "official_letter"
  | "email"
  | "public_statement"
  | "meeting_minutes"
  | "policy_update"
  | "decision_notice"
  | "media_response"
  | "other";

export type OfficialResponseVerificationState = "pending" | "verified" | "unable_to_verify";

export type OfficialResponsePublicationStatus = "draft" | "published" | "archived";

export const OFFICIAL_RESPONSE_PUBLICATION_TRANSITIONS: Record<
  OfficialResponsePublicationStatus,
  readonly OfficialResponsePublicationStatus[]
> = {
  draft: ["published"],
  published: ["archived"],
  archived: [],
};

export function canTransitionOfficialResponsePublication(
  from: OfficialResponsePublicationStatus,
  to: OfficialResponsePublicationStatus,
): boolean {
  return OFFICIAL_RESPONSE_PUBLICATION_TRANSITIONS[from].includes(to);
}

export function isOfficialResponsePublicationTerminal(
  status: OfficialResponsePublicationStatus,
): boolean {
  return status === "archived";
}

/** Future reply identity architecture — no mailbox in TASK-041. */
export interface OfficialResponseIdentity {
  capId: CivicActionPackageId;
  replyIdentifier: string;
  createdAt: string;
}

/** TASK-041 Official Response aggregate — immutable after publication; corrections add new records. */
export interface OfficialResponse {
  responseId: OfficialResponseId;
  responseNumber: string;
  capId: CivicActionPackageId;
  deliveryId: CivicDeliveryId;
  recipientId: CivicDeliveryRecipientId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  organizationName: string;
  recordedByParticipantId: MemberId;
  receivedAt: string;
  publishedAt?: string;
  subject: string;
  summary: string;
  responseReference: string;
  responseType: OfficialResponseType;
  verificationState: OfficialResponseVerificationState;
  publicationStatus: OfficialResponsePublicationStatus;
  rawSource?: string;
  messageHeaders?: Record<string, string>;
  providerMetadata?: Record<string, unknown>;
  verifiedAt?: string;
  verifiedByParticipantId?: MemberId;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
