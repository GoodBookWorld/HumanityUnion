import type {
  CivicAccountabilityEventType,
  CivicAccountabilityId,
  CivicAccountabilityStatus,
} from "./civic-accountability.js";
import type { CivicActionPackageId } from "./civic-action-package.js";
import type { CivicDeliveryRecipientType } from "./civic-delivery.js";
import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";
import type { OfficialResponseId } from "./official-response.js";

export interface CivicAccountabilityMetrics {
  accountabilityCount: number;
  activeAccountabilityCount: number;
  closedAccountabilityCount: number;
  archivedAccountabilityCount: number;
  eventCount: number;
  averageEventsPerAccountability: number;
  noResponseObservedCount: number;
  institutionActionReportedCount: number;
}

export interface PublicCivicAccountabilityRecipientInfo {
  name: string;
  organization?: string;
  recipientType: CivicDeliveryRecipientType;
}

export interface PublicCivicAccountabilityEventItem {
  eventId: string;
  eventType: CivicAccountabilityEventType;
  title: string;
  summary: string;
  evidenceReference?: string;
  occurredAt: string;
  recordedAt: string;
}

export interface PublicCivicAccountabilityReferenceLinks {
  capUrl: string;
  initiativeUrl: string;
  decisionUrl: string;
  deliveryUrl: string | null;
  responseUrl: string | null;
}

export interface PublicCivicAccountabilityListItem {
  accountabilityId: CivicAccountabilityId;
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  status: CivicAccountabilityStatus;
  eventCount: number;
  latestEventTitle?: string;
  latestEventSummary?: string;
  latestEventOccurredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Public projection — no participant identity or private routing data. */
export interface PublicCivicAccountabilityProjection {
  accountabilityId: CivicAccountabilityId;
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  responseId?: OfficialResponseId;
  status: CivicAccountabilityStatus;
  recipient?: PublicCivicAccountabilityRecipientInfo;
  officialResponseNumber?: string;
  officialResponseOrganization?: string;
  events: PublicCivicAccountabilityEventItem[];
  references: PublicCivicAccountabilityReferenceLinks;
  createdAt: string;
  updatedAt: string;
}
