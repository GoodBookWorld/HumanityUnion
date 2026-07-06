import type { InitiativeImplementationTrackingId } from "./initiative-implementation-tracking.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/** TASK-033 Public Impact identifier (Capability 02 pipeline). */
export type InitiativePublicImpactId = string;

/** Observable societal outcome lifecycle after completed implementation tracking. */
export type InitiativePublicImpactStatus = "draft" | "published" | "verified" | "archived";

export const INITIATIVE_PUBLIC_IMPACT_TRANSITIONS: Record<
  InitiativePublicImpactStatus,
  readonly InitiativePublicImpactStatus[]
> = {
  draft: ["published", "archived"],
  published: ["verified", "archived"],
  verified: [],
  archived: [],
};

export function canTransitionInitiativePublicImpact(
  from: InitiativePublicImpactStatus,
  to: InitiativePublicImpactStatus,
): boolean {
  return INITIATIVE_PUBLIC_IMPACT_TRANSITIONS[from].includes(to);
}

export function isInitiativePublicImpactTerminal(status: InitiativePublicImpactStatus): boolean {
  return status === "verified" || status === "archived";
}

/** TASK-033 immutable public impact evidence entry. */
export type PublicImpactEvidenceId = string;

export type PublicImpactEvidenceReferenceType =
  | "document"
  | "official_letter"
  | "media"
  | "dataset"
  | "photo_reference"
  | "video_reference"
  | "research"
  | "website"
  | "other";

export const PUBLIC_IMPACT_EVIDENCE_REFERENCE_TYPES: readonly PublicImpactEvidenceReferenceType[] =
  [
    "document",
    "official_letter",
    "media",
    "dataset",
    "photo_reference",
    "video_reference",
    "research",
    "website",
    "other",
  ];

export interface PublicImpactEvidence {
  evidenceId: PublicImpactEvidenceId;
  impactId: InitiativePublicImpactId;
  title: string;
  description: string;
  referenceUrl?: string;
  referenceType: PublicImpactEvidenceReferenceType;
  authorId: MemberId;
  createdAt: string;
}

/** TASK-033 Public Impact aggregate root. */
export interface InitiativePublicImpact {
  impactId: InitiativePublicImpactId;
  initiativeId: InitiativeId;
  trackingId: InitiativeImplementationTrackingId;
  participantId: MemberId;
  title: string;
  summary: string;
  observedImpact: string;
  affectedCommunity: string;
  evidenceSummary: string;
  status: InitiativePublicImpactStatus;
  publishedAt?: string;
  verifiedAt?: string;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
