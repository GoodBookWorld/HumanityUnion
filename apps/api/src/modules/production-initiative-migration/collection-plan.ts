import type { AncestryMethod, MigrationClassification } from "./types.js";

export interface CollectionCatalogEntry {
  collection: string;
  classification: MigrationClassification;
  ancestryMethod: AncestryMethod;
  notes?: string;
  /**
   * Single-field destination primary identity.
   * Only `primaryIdFields[0]` is used as the collision key (legacy contract).
   */
  primaryIdFields?: string[];
  /**
   * Composite destination primary identity — every listed field is required.
   * Takes precedence over `primaryIdFields`. Filter is AND of all fields.
   * Mongo ObjectId `_id` is never a domain identity here.
   */
  compositePrimaryIdFields?: readonly string[];
}

/**
 * Canonical civic collection classification (Task 06 + Pack 25 membership overlay).
 * Pack 02 allow-lists are intentionally NOT reused.
 */
export const CIVIC_COLLECTION_CATALOG: readonly CollectionCatalogEntry[] = [
  {
    collection: "initiatives",
    classification: "MUST_MIGRATE",
    ancestryMethod: "root",
    primaryIdFields: ["initiativeId", "_id"],
  },
  {
    collection: "initiative_analyses",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["analysisId"],
  },
  {
    collection: "initiative_improvement_proposals_collections",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    // Root identity is collectionId; proposalId exists only on nested proposals[].
    primaryIdFields: ["collectionId"],
  },
  {
    collection: "initiative_version_revisions",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["revisionId"],
  },
  {
    collection: "initiative_revision_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_discussion_completions",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_petition_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_decision_session_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_collective_decision_lifecycle_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_implementation_commitment_lifecycle_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_implementation_tracking_lifecycle_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_official_response_lifecycle_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_public_impact_lifecycle_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_civic_archive_lifecycle_drafts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "pk:initiativeId",
    primaryIdFields: ["initiativeId"],
  },
  {
    collection: "initiative_comments",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["commentId"],
  },
  {
    collection: "initiative_allies",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    // Domain uniqueness is (initiativeId, participantId) — never allyId / initiativeId alone.
    compositePrimaryIdFields: ["initiativeId", "participantId"],
  },
  {
    collection: "initiative_collaboration_channel_messages",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["messageId"],
  },
  {
    collection: "initiative_collaboration_sessions",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["sessionId"],
  },
  {
    collection: "initiative_collaboration_session_attendances",
    classification: "MUST_MIGRATE",
    ancestryMethod: "parent:sessionId",
    // Domain uniqueness is (sessionId, participantId) — never attendanceId.
    compositePrimaryIdFields: ["sessionId", "participantId"],
  },
  {
    collection: "shared_documents",
    classification: "MUST_MIGRATE",
    ancestryMethod: "optional:initiativeId",
    primaryIdFields: ["documentId"],
    notes: "Migrate only Initiative-scoped rows",
  },
  {
    collection: "decision_sessions",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["sessionId"],
  },
  {
    collection: "initiative_collective_decisions",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["decisionId"],
  },
  {
    collection: "initiative_decision_votes",
    classification: "MUST_MIGRATE",
    ancestryMethod: "parent:decisionId",
    primaryIdFields: ["voteId"],
  },
  {
    collection: "initiative_decision_vote_history",
    classification: "MUST_MIGRATE",
    ancestryMethod: "parent:decisionId",
    primaryIdFields: ["historyId"],
  },
  {
    collection: "public_choice_candidates",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["candidateId"],
  },
  {
    collection: "petitions",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:subject.initiativeId",
    primaryIdFields: ["petitionId"],
  },
  {
    collection: "petition_signatures",
    classification: "MUST_MIGRATE",
    ancestryMethod: "parent:petitionId",
    primaryIdFields: ["signatureId"],
  },
  {
    collection: "initiative_implementation_commitment_packages",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["packageId"],
  },
  {
    collection: "initiative_implementation_commitments",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["commitmentId"],
  },
  {
    collection: "initiative_implementation_tracking_packages",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["packageId"],
  },
  {
    collection: "initiative_implementation_trackings",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["trackingId"],
  },
  {
    collection: "implementation_tracking_updates",
    classification: "MUST_MIGRATE",
    ancestryMethod: "parent:trackingId",
    primaryIdFields: ["updateId"],
  },
  {
    collection: "initiative_official_response_packages",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["packageId"],
  },
  {
    collection: "initiative_official_response_package_records",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["responseId"],
  },
  {
    collection: "initiative_public_impact_reports",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["reportId"],
  },
  {
    collection: "initiative_public_impacts",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["impactId"],
  },
  {
    collection: "public_impact_evidence",
    classification: "MUST_MIGRATE",
    ancestryMethod: "parent:impactId",
    primaryIdFields: ["evidenceId"],
  },
  {
    collection: "initiative_civic_archive_versions",
    classification: "MUST_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["archiveVersionId"],
  },
  {
    collection: "media_upload_records",
    classification: "MUST_MIGRATE",
    ancestryMethod: "optional:initiativeId",
    primaryIdFields: ["mediaId"],
    notes: "Selected Initiative media + system-media-recovery owned historical records",
  },

  // CONDITIONAL
  {
    collection: "initiative_improvement_proposals",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["proposalId"],
    notes: "Legacy parallel to collections",
  },
  {
    collection: "initiative_comment_reactions",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["reactionId"],
  },
  {
    collection: "initiative_analysis_reactions",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["reactionId"],
  },
  {
    collection: "initiative_proposal_reactions",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["reactionId"],
  },
  {
    collection: "initiative_revision_reactions",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["reactionId"],
  },
  {
    collection: "initiative_collaboration_channel_reads",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["readId"],
  },
  {
    collection: "initiative_discussion_proposal_candidates",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["candidateId"],
  },
  {
    collection: "initiative_support_registered_signals",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["signalId"],
  },
  {
    collection: "initiative_support_visitor_signals",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["signalId"],
  },
  {
    collection: "initiative_support_bookmarks",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["bookmarkId"],
  },
  {
    collection: "public_choice_results_snapshots",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["snapshotId"],
    notes: "Prefer rebuild from votes when valid",
  },
  {
    collection: "petition_visitor_signals",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "parent:petitionId",
    primaryIdFields: ["signalId"],
  },
  {
    collection: "public_civic_archive_records",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["archiveId"],
  },
  {
    collection: "civic_action_packages",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["packageId"],
  },
  {
    collection: "civic_deliveries",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["deliveryId"],
  },
  {
    collection: "civic_delivery_recipients",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["recipientId"],
  },
  {
    collection: "official_responses",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["responseId"],
  },
  {
    collection: "civic_accountabilities",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["accountabilityId"],
  },
  {
    collection: "civic_accountability_events",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["eventId"],
  },
  {
    collection: "civic_compatibility_reviews",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["reviewId"],
  },
  {
    collection: "initiative_decision_session_recommendations",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["recommendationId"],
  },
  {
    collection: "participant_actions",
    classification: "CONDITIONAL_MIGRATE",
    ancestryMethod: "direct:initiativeId",
    primaryIdFields: ["actionId"],
    notes: "Workspace stats only; never via outbox replay",
  },

  // REBUILD / DERIVE
  {
    collection: "initiative_support_views",
    classification: "REBUILD_OR_DERIVE",
    ancestryMethod: "direct:initiativeId",
    notes: "Prefer empty / rebuild",
  },
  {
    collection: "workspace_projections",
    classification: "REBUILD_OR_DERIVE",
    ancestryMethod: "none",
    notes: "Not canonical Initiative card data — rebuild / leave empty",
  },
  {
    collection: "content_translations",
    classification: "REBUILD_OR_DERIVE",
    ancestryMethod: "none",
    notes: "Regenerate from sources after hydrate",
  },
  {
    collection: "public_initiative_cards_in_memory",
    classification: "REBUILD_OR_DERIVE",
    ancestryMethod: "none",
    notes: "rebuildProjectedInitiativeCards after Mongo hydrate",
  },

  // DO NOT MIGRATE
  {
    collection: "activities",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
    notes: "Legacy non-canonical root",
  },
  {
    collection: "discussions",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
    notes: "Legacy non-canonical root",
  },
  {
    collection: "proposals",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
    notes: "Legacy non-canonical root",
  },
  {
    collection: "decisions",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
    notes: "Legacy non-canonical root",
  },
  {
    collection: "outbox",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
    notes: "Would replay emails/integrations",
  },
  {
    collection: "processed_events",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "auth_sessions",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "email_verification_tokens",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "email_confirmation_codes",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "member_notifications",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "admin_notifications",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "membership_webhook_events",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "participant-scoped",
    notes: "Staging operational webhook audit",
  },
  {
    collection: "direct_conversations",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "direct_messages",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "blog_posts",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },
  {
    collection: "traffic_events",
    classification: "DO_NOT_MIGRATE",
    ancestryMethod: "none",
  },

  // Pack 25 membership overlay (participant-scoped, not Initiative-rooted)
  {
    collection: "memberships",
    classification: "MUST_MIGRATE",
    ancestryMethod: "participant-scoped",
    primaryIdFields: ["membershipId"],
    notes: "Only real business state (e.g. active_member); omit not_started",
  },
  {
    collection: "member_profiles.membershipPubliclyVisible",
    classification: "MUST_PRESERVE",
    ancestryMethod: "participant-scoped",
    notes: "Preserve boolean as stored on profiles",
  },
  {
    collection: "membership_contributions",
    classification: "CONDITIONAL_SANITIZED",
    ancestryMethod: "participant-scoped",
    primaryIdFields: ["contributionId"],
    notes: "Preserve HU payment status; strip Stripe Test operational IDs",
  },
  {
    collection: "member_badge_applications",
    classification: "MUST_MIGRATE_IF_PRESENT",
    ancestryMethod: "participant-scoped",
    primaryIdFields: ["applicationId"],
    notes: "Preserve payment/fulfillment; shippingDataPresent only in logs",
  },
  {
    collection: "member_badge_contributions",
    classification: "CONDITIONAL_SANITIZED",
    ancestryMethod: "participant-scoped",
    primaryIdFields: ["contributionId"],
  },
] as const;

export function getCollectionCatalogEntry(
  collection: string,
): CollectionCatalogEntry | undefined {
  return CIVIC_COLLECTION_CATALOG.find((row) => row.collection === collection);
}

export function listCollectionsByClassification(
  classification: MigrationClassification,
): CollectionCatalogEntry[] {
  return CIVIC_COLLECTION_CATALOG.filter((row) => row.classification === classification);
}

export const PROJECTION_PLAN_STATIC = [
  {
    artifact: "public_initiative_cards_in_memory",
    classification: "REBUILD_OR_DERIVE" as const,
    strategy: "rebuildProjectedInitiativeCards after Mongo hydrate",
  },
  {
    artifact: "workspace_projections",
    classification: "REBUILD_OR_DERIVE" as const,
    strategy: "Do not copy; rebuild later if needed — not canonical Initiative cards",
  },
  {
    artifact: "content_translations",
    classification: "REBUILD_OR_DERIVE" as const,
    strategy: "Prefer regenerate from migrated sources",
  },
  {
    artifact: "outbox",
    classification: "DO_NOT_MIGRATE" as const,
    strategy: "Never copy — would replay emails/integrations",
  },
  {
    artifact: "processed_events",
    classification: "DO_NOT_MIGRATE" as const,
    strategy: "Never copy",
  },
  {
    artifact: "auth_sessions_tokens_codes",
    classification: "DO_NOT_MIGRATE" as const,
    strategy: "Never copy secrets / env-local auth material",
  },
  {
    artifact: "notifications",
    classification: "DO_NOT_MIGRATE" as const,
    strategy: "Never copy staging operational notifications",
  },
  {
    artifact: "membership_webhook_events",
    classification: "DO_NOT_MIGRATE" as const,
    strategy: "Never copy staging Stripe webhook audit",
  },
];
