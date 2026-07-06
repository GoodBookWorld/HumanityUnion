import type { InitiativeImplementationTrackingId } from "./initiative-implementation-tracking.js";
import type { InitiativeId } from "./initiative.js";
import type {
  InitiativePublicImpactId,
  InitiativePublicImpactStatus,
  PublicImpactEvidenceReferenceType,
} from "./initiative-public-impact.js";

export interface PublicImpactEvidenceListItem {
  evidenceId: string;
  title: string;
  description: string;
  referenceUrl?: string;
  referenceType: PublicImpactEvidenceReferenceType;
  createdAt: string;
  authorDisplayName: string;
}

export interface PublicInitiativePublicImpactProjection {
  impactId: InitiativePublicImpactId;
  initiativeId: InitiativeId;
  trackingId: InitiativeImplementationTrackingId;
  title: string;
  summary: string;
  observedImpact: string;
  affectedCommunity: string;
  evidenceSummary: string;
  status: Exclude<InitiativePublicImpactStatus, "draft">;
  publishedAt?: string;
  verifiedAt?: string;
  archivedAt?: string;
  authorDisplayName: string;
  evidence: PublicImpactEvidenceListItem[];
}

export interface PublicInitiativePublicImpactListItem {
  impactId: InitiativePublicImpactId;
  trackingId: InitiativeImplementationTrackingId;
  title: string;
  summary: string;
  observedImpact: string;
  affectedCommunity: string;
  status: Exclude<InitiativePublicImpactStatus, "draft">;
  publishedAt?: string;
  verifiedAt?: string;
  authorDisplayName: string;
  evidenceCount: number;
}

export interface InitiativePublicImpactMetrics {
  impactCount: number;
  publishedImpactCount: number;
  verifiedImpactCount: number;
  averageEvidencePerImpact: number;
}
