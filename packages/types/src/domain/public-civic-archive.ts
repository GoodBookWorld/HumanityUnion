import type { ParticipationScope } from "./initiative-collective-decision.js";
import type { InitiativeCollectiveDecisionId } from "./initiative-collective-decision.js";
import type { InitiativeImplementationCommitmentId } from "./initiative-implementation-commitment.js";
import type { InitiativeImplementationTrackingId } from "./initiative-implementation-tracking.js";
import type { InitiativePublicImpactId } from "./initiative-public-impact.js";
import type { InitiativeId } from "./initiative.js";
import type { MemberId } from "./member.js";

/** TASK-037 Public Civic Archive record identifier. */
export type PublicCivicArchiveRecordId = string;

/** Permanent civic archive lifecycle — immutable after publication. */
export type PublicCivicArchiveStatus = "draft" | "published";

export const PUBLIC_CIVIC_ARCHIVE_TRANSITIONS: Record<
  PublicCivicArchiveStatus,
  readonly PublicCivicArchiveStatus[]
> = {
  draft: ["published"],
  published: [],
};

export function canTransitionPublicCivicArchive(
  from: PublicCivicArchiveStatus,
  to: PublicCivicArchiveStatus,
): boolean {
  return PUBLIC_CIVIC_ARCHIVE_TRANSITIONS[from].includes(to);
}

export function isPublicCivicArchiveTerminal(status: PublicCivicArchiveStatus): boolean {
  return status === "published";
}

export interface LessonsLearned {
  whatWorked: string;
  whatDidNotWork: string;
  recommendationsForFuture: string;
  transferableExperience: string;
}

export interface KnowledgeContribution {
  socialBenefits: string;
  environmentalBenefits: string;
  economicBenefits: string;
  governanceBenefits: string;
  educationalBenefits: string;
  additionalObservations: string;
}

/** Reference-only linkage to upstream civic pipeline records. */
export interface PublicCivicArchiveReferences {
  initiativeId: InitiativeId;
  initiativeVersion: number;
  decisionId: InitiativeCollectiveDecisionId;
  commitmentId: InitiativeImplementationCommitmentId;
  trackingId: InitiativeImplementationTrackingId;
  impactId: InitiativePublicImpactId;
}

/** TASK-037 Public Civic Archive aggregate root. */
export interface PublicCivicArchiveRecord {
  archiveRecordId: PublicCivicArchiveRecordId;
  initiativeId: InitiativeId;
  impactId: InitiativePublicImpactId;
  authorId: MemberId;
  stewardId: MemberId;
  references: PublicCivicArchiveReferences;
  title: string;
  summary: string;
  country: string;
  region: string;
  community: string;
  activityArea: string;
  participationScope: ParticipationScope;
  implementationPeriod: string;
  lessonsLearned: LessonsLearned;
  knowledgeContribution: KnowledgeContribution;
  status: PublicCivicArchiveStatus;
  archivedVersion: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
