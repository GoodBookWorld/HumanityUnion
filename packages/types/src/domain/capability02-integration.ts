/** Capability 02 civic entity types for integration layer reference-only linking. */
export type CivicEntityType =
  | "initiative"
  | "analysis"
  | "improvement_proposal"
  | "initiative_revision"
  | "petition"
  | "decision_session"
  | "collective_decision"
  | "civic_action_package"
  | "official_response"
  | "civic_accountability"
  | "implementation_commitment"
  | "implementation_tracking"
  | "public_impact"
  | "civic_archive"
  | "knowledge_article"
  | "knowledge_media"
  | "civic_nomination"
  | "member_badge_contribution";

/** Reference-only relationship semantics — no business logic. */
export type CivicRelationshipType =
  | "created_from"
  | "implements"
  | "references"
  | "supersedes"
  | "produced"
  | "documents"
  | "archives";

/** Universal related record reference for cross-entity navigation. */
export interface RelatedRecord {
  entityType: CivicEntityType;
  entityId: string;
  title: string;
  summary: string;
  publicUrl: string;
  relationshipType: CivicRelationshipType;
}

/** Search metadata contract for future global search — no search engine in TASK-038. */
export interface CivicSearchMetadata {
  entityType: CivicEntityType;
  entityId: string;
  title: string;
  summary: string;
  country: string;
  region: string;
  community: string;
  activityArea: string;
  status: string;
  publicUrl: string;
  updatedAt: string;
  countryLabel?: string;
  regionLabel?: string;
  countryCode?: string;
  regionCode?: string;
  imageUrl?: string;
  /** Parent initiative when this record belongs to an initiative lifecycle. */
  initiativeId?: string;
}

export type CivicPipelineStageId =
  | "initiative"
  | "analysis"
  | "proposal"
  | "revision"
  | "decision_session"
  | "collective_decision"
  | "civic_action_package"
  | "official_response"
  | "civic_accountability"
  | "commitment"
  | "tracking"
  | "public_impact"
  | "archive";

export interface CivicPipelineStageStatus {
  id: CivicPipelineStageId;
  label: string;
  complete: boolean;
}

/** Informational pipeline widget — no controls. */
export interface CivicPipelineStatus {
  stages: CivicPipelineStageStatus[];
  currentStageId: CivicPipelineStageId | null;
  previousStageId: CivicPipelineStageId | null;
  nextStageId: CivicPipelineStageId | null;
  nextAvailableStep: string | null;
}

export interface CivicBreadcrumbItem {
  label: string;
  href: string | null;
}

/** Contextual civic awareness for an entity within the constitutional pipeline. */
export interface CivicContext {
  entityType: CivicEntityType;
  entityId: string;
  title: string;
  summary: string;
  initiativeId: string | null;
  currentStageId: CivicPipelineStageId | null;
  relatedSections: CivicContextSection[];
}

export interface CivicContextSection {
  id: string;
  title: string;
  records: RelatedRecord[];
}

/** Notification event registry — delivery not implemented in TASK-038. */
export type CivicNotificationEventType =
  | "initiative_published"
  | "initiative_interest_match"
  | "analysis_published"
  | "proposal_submitted"
  | "proposal_decided"
  | "revision_published"
  | "decision_opened"
  | "decision_closed"
  | "civic_action_package_issued"
  | "official_response_received"
  | "official_response_verified"
  | "civic_accountability_event_added"
  | "civic_accountability_closed"
  | "commitment_published"
  | "tracking_updated"
  | "impact_verified"
  | "archive_published"
  | "civic_nomination_submitted"
  | "civic_nomination_published"
  | "civic_nomination_withdrawn"
  | "civic_nomination_voting_opened"
  | "civic_nomination_vote_cast"
  | "civic_nomination_voting_closed"
  | "member_badge_contribution_confirmed"
  | "member_badge_shipped"
  | "member_badge_delivered"
  | "member_badge_contribution_refunded"
  | "initiative_comment_posted"
  | "initiative_comment_reply";

export interface CivicNotificationEventDefinition {
  eventType: CivicNotificationEventType;
  description: string;
  entityType: CivicEntityType;
}

export const CIVIC_NOTIFICATION_EVENT_REGISTRY: readonly CivicNotificationEventDefinition[] = [
  {
    eventType: "initiative_published",
    description: "An initiative entered public civic life.",
    entityType: "initiative",
  },
  {
    eventType: "analysis_published",
    description: "A collaborative analysis was published.",
    entityType: "analysis",
  },
  {
    eventType: "proposal_submitted",
    description: "An improvement proposal was submitted for steward review.",
    entityType: "improvement_proposal",
  },
  {
    eventType: "proposal_decided",
    description: "A steward decided on an improvement proposal.",
    entityType: "improvement_proposal",
  },
  {
    eventType: "revision_published",
    description: "An initiative revision was published.",
    entityType: "initiative_revision",
  },
  {
    eventType: "decision_opened",
    description: "A collective decision opened for participation.",
    entityType: "collective_decision",
  },
  {
    eventType: "decision_closed",
    description: "A collective decision closed with a public outcome.",
    entityType: "collective_decision",
  },
  {
    eventType: "civic_action_package_issued",
    description: "A Civic Action Package was issued from a closed collective decision.",
    entityType: "civic_action_package",
  },
  {
    eventType: "official_response_received",
    description: "An official institutional response was published for a Civic Action Package.",
    entityType: "official_response",
  },
  {
    eventType: "official_response_verified",
    description: "A steward verified an official institutional response.",
    entityType: "official_response",
  },
  {
    eventType: "civic_accountability_event_added",
    description: "A civic accountability event was added to a CAP follow-up timeline.",
    entityType: "civic_accountability",
  },
  {
    eventType: "civic_accountability_closed",
    description: "A civic accountability timeline was closed.",
    entityType: "civic_accountability",
  },
  {
    eventType: "commitment_published",
    description: "An implementation commitment was published.",
    entityType: "implementation_commitment",
  },
  {
    eventType: "tracking_updated",
    description: "An implementation tracking journal entry was added.",
    entityType: "implementation_tracking",
  },
  {
    eventType: "impact_verified",
    description: "Public impact was verified after completed tracking.",
    entityType: "public_impact",
  },
  {
    eventType: "archive_published",
    description: "A verified civic cycle entered the Public Civic Archive.",
    entityType: "civic_archive",
  },
  {
    eventType: "civic_nomination_submitted",
    description: "A civic nomination was submitted for institution formation review.",
    entityType: "civic_nomination",
  },
  {
    eventType: "civic_nomination_published",
    description: "A civic nomination poster was published.",
    entityType: "civic_nomination",
  },
  {
    eventType: "civic_nomination_withdrawn",
    description: "A civic nomination was withdrawn.",
    entityType: "civic_nomination",
  },
  {
    eventType: "civic_nomination_voting_opened",
    description: "Transparent support voting opened on a published civic nomination.",
    entityType: "civic_nomination",
  },
  {
    eventType: "civic_nomination_vote_cast",
    description: "A participant cast or updated a civic nomination support vote.",
    entityType: "civic_nomination",
  },
  {
    eventType: "civic_nomination_voting_closed",
    description: "Transparent support voting closed on a civic nomination.",
    entityType: "civic_nomination",
  },
  {
    eventType: "member_badge_contribution_confirmed",
    description: "An additional Member Badge Contribution was confirmed.",
    entityType: "member_badge_contribution",
  },
  {
    eventType: "member_badge_shipped",
    description: "A physical Member Badge request was shipped.",
    entityType: "member_badge_contribution",
  },
  {
    eventType: "member_badge_delivered",
    description: "A physical Member Badge request was delivered.",
    entityType: "member_badge_contribution",
  },
  {
    eventType: "member_badge_contribution_refunded",
    description: "A Member Badge Contribution was refunded.",
    entityType: "member_badge_contribution",
  },
  {
    eventType: "initiative_comment_posted",
    description: "A new comment was posted on an initiative discussion.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_comment_reply",
    description: "A participant replied to an initiative discussion comment.",
    entityType: "initiative",
  },
] as const;

export interface CivicIntegrationView {
  context: CivicContext;
  relatedRecords: RelatedRecord[];
  pipelineStatus: CivicPipelineStatus;
  breadcrumb: CivicBreadcrumbItem[];
  searchMetadata: CivicSearchMetadata | null;
}
