import type {
  OfficialResponseId,
  OfficialResponsePublicationStatus,
  OfficialResponseType,
  OfficialResponseVerificationState,
} from "./official-response.js";
import type { CivicActionPackageId } from "./civic-action-package.js";
import type { CivicDeliveryId } from "./civic-delivery.js";
import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeId } from "./initiative.js";

export interface OfficialResponseMetrics {
  responseCount: number;
  verifiedResponseCount: number;
  pendingResponseCount: number;
  unableToVerifyCount: number;
  responseTypes: Record<OfficialResponseType, number>;
  recipientCoverage: number;
}

export interface PublicOfficialResponseListItem {
  responseId: OfficialResponseId;
  responseNumber: string;
  capId: CivicActionPackageId;
  initiativeId: InitiativeId;
  organizationName: string;
  receivedAt: string;
  publishedAt?: string;
  responseType: OfficialResponseType;
  verificationState: OfficialResponseVerificationState;
  publicationStatus: OfficialResponsePublicationStatus;
  subject: string;
  summary: string;
}

export interface PublicOfficialResponseReferenceLinks {
  capUrl: string;
  initiativeUrl: string;
  decisionUrl: string;
  deliveryUrl: string | null;
}

/** Public projection — no private headers, provider metadata, or participant identity. */
export interface PublicOfficialResponseProjection {
  responseId: OfficialResponseId;
  responseNumber: string;
  capId: CivicActionPackageId;
  deliveryId: CivicDeliveryId;
  initiativeId: InitiativeId;
  decisionId: InitiativeCollectiveDecisionId;
  organizationName: string;
  receivedAt: string;
  publishedAt?: string;
  subject: string;
  summary: string;
  responseReference: string;
  responseType: OfficialResponseType;
  verificationState: OfficialResponseVerificationState;
  publicationStatus: OfficialResponsePublicationStatus;
  references: PublicOfficialResponseReferenceLinks;
}
