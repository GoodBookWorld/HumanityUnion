/** Capability 02 civic entity types for integration layer reference-only linking. */
export type CivicEntityType =
  | "initiative"
  | "analysis"
  | "improvement_proposal"
  | "initiative_revision"
  | "decision_session"
  | "collective_decision"
  | "civic_action_package"
  | "official_response"
  | "implementation_commitment"
  | "implementation_tracking"
  | "public_impact"
  | "civic_archive";

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
  | "analysis_published"
  | "proposal_submitted"
  | "proposal_decided"
  | "revision_published"
  | "decision_opened"
  | "decision_closed"
  | "civic_action_package_issued"
  | "official_response_received"
  | "official_response_verified"
  | "commitment_published"
  | "tracking_updated"
  | "impact_verified"
  | "archive_published";

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
] as const;

export interface CivicIntegrationView {
  context: CivicContext;
  relatedRecords: RelatedRecord[];
  pipelineStatus: CivicPipelineStatus;
  breadcrumb: CivicBreadcrumbItem[];
  searchMetadata: CivicSearchMetadata | null;
}
