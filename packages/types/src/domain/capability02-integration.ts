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
  | "member_badge_contribution"
  /** Profile UX Pack 03 — Direct Collaboration conversation (private, never a public entity). */
  | "direct_conversation"
  /** Blog Implementation Pack 02 — published Blog posts in Global Search. */
  | "blog_post"
  /** Author Access Pack 04 — Blog Author application (Workspace, not public). */
  | "blog_author_application"
  /** Pack 12E2 — Delegated Editor grant (Workspace Editor Panel, not public). */
  | "editor_grant";

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

/**
 * Informational Cap02 pipeline widget — COMPATIBILITY_DISPLAY_ONLY.
 * Must never advance or block canonical Initiative Lifecycle progression
 * (`resolveInitiativeLifecycleState` / `experience.currentStageId`).
 */
export interface CivicPipelineStatus {
  stages: CivicPipelineStageStatus[];
  /**
   * Cap02 widget cursor only — NOT `PublicInitiativeExperienceProjection.currentStageId`.
   */
  currentStageId: CivicPipelineStageId | null;
  previousStageId: CivicPipelineStageId | null;
  nextStageId: CivicPipelineStageId | null;
  nextAvailableStep: string | null;
  /** Frozen authority marker — always compatibility display. */
  progressionAuthority: "compatibility_display_only";
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
  | "implementation_commitment_proposed"
  | "implementation_commitment_taken"
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
  | "initiative_comment_reply"
  | "initiative_collaboration_interest_expressed"
  | "initiative_collaboration_interest_accepted"
  | "initiative_collaboration_interest_declined"
  | "initiative_allies_invitation_received"
  | "initiative_allies_invitation_accepted"
  | "initiative_allies_invitation_declined"
  /** Profile UX Pack 03 Part 13 — new Direct Collaboration message received. */
  | "direct_message_received"
  /** Communication UX Pack 03.5 Part 7 — new Initiative Collaboration Channel message. */
  | "initiative_collaboration_channel_message_received"
  /** Communication UX Pack 03.5 Part 7 — an important Collaboration Channel system event (e.g. Ally joined). */
  | "initiative_collaboration_channel_system_event"
  /** Communication UX Pack 03.6 Part 7 — a new Collaboration Session was scheduled. */
  | "initiative_collaboration_session_created"
  /** Communication UX Pack 03.6 Part 7 — an existing Collaboration Session was edited or rescheduled. */
  | "initiative_collaboration_session_updated"
  /** Communication UX Pack 03.6 Part 7 — a Collaboration Session was cancelled. */
  | "initiative_collaboration_session_cancelled"
  /** Communication UX Pack 03.6 Part 7/8 — an Active Ally changed their attendance response. */
  | "initiative_collaboration_session_attendance_changed"
  /**
   * Communication UX Pack 03.6 Part 7/8 — a Collaboration Session is about
   * to begin. This event type and its notification helper exist as a
   * prepared extension point only (Part 8: "reminder generation belongs to
   * future automation packs") — nothing in this pack ever emits it; a
   * future scheduled-job pack calls `emitInitiativeCollaborationSessionUpcomingReminderNotification`.
   */
  | "initiative_collaboration_session_upcoming_reminder"
  /** Communication UX Pack 03.7 Part 10 — a new Shared Document was uploaded to a communication context. */
  | "shared_document_uploaded"
  /** Communication UX Pack 03.7 Part 10 — a Shared Document was replaced with a new version. */
  | "shared_document_replaced"
  /** Communication UX Pack 03.7 Part 10 — a Shared Document was removed. */
  | "shared_document_removed"
  /**
   * Initiative Lifecycle Part A Part 14 — a lifecycle stage was formally
   * published/opened/finalized/fixed. Fanned out to every Active Ally of
   * the Initiative (excluding the acting Author) by the universal
   * `initiative-lifecycle-stage` notification consumer; never emitted
   * directly by a stage domain's own service.
   */
  | "initiative_lifecycle_stage_published"
  /** Author Access Pack 04 — Blog Author application submitted. */
  | "blog_author_application_submitted"
  /** Author Access Pack 04 — Blog Author application approved. */
  | "blog_author_application_approved"
  /** Author Access Pack 04 — Editor requested changes on a Blog Author application. */
  | "blog_author_application_changes_requested"
  /** Author Access Pack 04 — Blog Author application declined. */
  | "blog_author_application_declined"
  /** Pack 13A — Admin notified that a Blog Author application awaits review. */
  | "blog_author_application_review_requested"
  /** Pack 13B — Author publishing access administratively blocked. */
  | "blog_author_access_blocked"
  /** Pack 13B — Author publishing access restored. */
  | "blog_author_access_restored"
  /** Pack 16G — Admin enabled Trusted Publishing for an Author. */
  | "blog_author_trusted_publishing_enabled"
  /** Pack 16G — Admin disabled Trusted Publishing for an Author. */
  | "blog_author_trusted_publishing_disabled"
  /** Pack 13B — Publication soft-blocked from public surfaces. */
  | "blog_publication_blocked"
  /** Pack 13B — Publication soft-block cleared. */
  | "blog_publication_restored"
  /** Pack 14B — Admin notified that a Blog publication awaits editorial review. */
  | "blog_publication_review_requested"
  /** Editorial Review Pack 06 — Editor requested changes on a Blog publication. */
  | "blog_post_changes_requested"
  /** Editorial Review Pack 06 — Blog publication approved and published. */
  | "blog_post_published"
  /** Editorial Review Pack 06 — Blog publication editorially declined. */
  | "blog_post_declined"
  /** Blog Interaction Pack 07 — new top-level comment on a publication. */
  | "blog_comment_posted"
  /** Blog Interaction Pack 07 — reply to your Blog comment. */
  | "blog_comment_reply"
  /** Pack 12E2 — Editor access assigned to Participant. */
  | "editor_access_assigned"
  /** Pack 12E2 — existing Editor grant activated. */
  | "editor_access_activated"
  /** Pack 12E2 — Editor grant deactivated. */
  | "editor_access_deactivated"
  /** Pack 12E2 — Editor permissions updated. */
  | "editor_permissions_updated"
  /** Pack 12E2 — Editor geographic editing area updated. */
  | "editor_editing_area_updated";

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
    eventType: "implementation_commitment_proposed",
    description: "A Participant was proposed as responsible for an Implementation Commitment Action.",
    entityType: "implementation_commitment",
  },
  {
    eventType: "implementation_commitment_taken",
    description: "A Participant voluntarily took responsibility for an unassigned Implementation Commitment.",
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
  {
    eventType: "initiative_collaboration_interest_expressed",
    description: "A participant expressed readiness to collaborate on an initiative.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_interest_accepted",
    description: "An Initiative Author accepted a participant's collaboration request.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_interest_declined",
    description: "An Initiative Author declined a participant's collaboration request.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_allies_invitation_received",
    description: "A participant received an Allies invitation for an initiative.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_allies_invitation_accepted",
    description: "A participant accepted an Allies invitation for an initiative.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_allies_invitation_declined",
    description: "A participant declined an Allies invitation for an initiative.",
    entityType: "initiative",
  },
  {
    eventType: "direct_message_received",
    description: "A participant received a new Direct Collaboration message.",
    entityType: "direct_conversation",
  },
  {
    eventType: "initiative_collaboration_channel_message_received",
    description: "A participant received a new Initiative Collaboration Channel message.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_channel_system_event",
    description: "An important Initiative Collaboration Channel system event occurred.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_session_created",
    description: "A new Initiative Collaboration Session was scheduled.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_session_updated",
    description: "An Initiative Collaboration Session was edited or rescheduled.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_session_cancelled",
    description: "An Initiative Collaboration Session was cancelled.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_session_attendance_changed",
    description: "An Active Ally changed their Collaboration Session attendance response.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_collaboration_session_upcoming_reminder",
    description: "An Initiative Collaboration Session is about to begin.",
    entityType: "initiative",
  },
  {
    // Shared Document events actually span two entity types
    // (`direct_conversation` or `initiative`, chosen per upload — see
    // `shared-documents-notifications.ts`); `"initiative"` is recorded
    // here only because this registry format allows exactly one.
    eventType: "shared_document_uploaded",
    description: "A new Shared Document was uploaded to a communication context.",
    entityType: "initiative",
  },
  {
    eventType: "shared_document_replaced",
    description: "A Shared Document was replaced with a new version.",
    entityType: "initiative",
  },
  {
    eventType: "shared_document_removed",
    description: "A Shared Document was removed.",
    entityType: "initiative",
  },
  {
    eventType: "initiative_lifecycle_stage_published",
    description: "A lifecycle stage was formally published, opened, finalized, or fixed.",
    entityType: "initiative",
  },
  {
    eventType: "blog_author_application_submitted",
    description: "A Participant submitted a Blog Author application.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_application_approved",
    description: "A Blog Author application was approved.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_application_changes_requested",
    description: "An Editor requested changes on a Blog Author application.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_application_declined",
    description: "A Blog Author application was declined.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_application_review_requested",
    description: "Administrators were notified that a Blog Author application awaits review.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_access_blocked",
    description: "Author publishing access was administratively blocked.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_access_restored",
    description: "Author publishing access was restored after an administrative block.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_trusted_publishing_enabled",
    description: "An Administrator enabled Trusted Publishing for an Author.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_author_trusted_publishing_disabled",
    description: "An Administrator disabled Trusted Publishing for an Author.",
    entityType: "blog_author_application",
  },
  {
    eventType: "blog_publication_blocked",
    description: "A Blog publication was soft-blocked from public visibility.",
    entityType: "blog_post",
  },
  {
    eventType: "blog_publication_restored",
    description: "A Blog publication soft-block was cleared.",
    entityType: "blog_post",
  },
  {
    eventType: "blog_publication_review_requested",
    description: "Administrators were notified that a Blog publication awaits editorial review.",
    entityType: "blog_post",
  },
  {
    eventType: "blog_post_changes_requested",
    description: "An Editor requested changes on a Blog publication.",
    entityType: "blog_post",
  },
  {
    eventType: "blog_post_published",
    description: "A Blog publication was approved and published.",
    entityType: "blog_post",
  },
  {
    eventType: "blog_post_declined",
    description: "A Blog publication was editorially declined.",
    entityType: "blog_post",
  },
  {
    eventType: "blog_comment_posted",
    description: "A Participant commented on a Blog publication.",
    entityType: "blog_post",
  },
  {
    eventType: "blog_comment_reply",
    description: "A Participant replied to a Blog comment.",
    entityType: "blog_post",
  },
] as const;

export interface CivicIntegrationView {
  context: CivicContext;
  relatedRecords: RelatedRecord[];
  pipelineStatus: CivicPipelineStatus;
  breadcrumb: CivicBreadcrumbItem[];
  searchMetadata: CivicSearchMetadata | null;
}
