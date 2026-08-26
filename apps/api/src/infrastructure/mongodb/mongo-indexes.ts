import type { IndexDescription } from "mongodb";

import { MONGO_COLLECTIONS } from "./mongo-collections.js";
import { getMongoCollection } from "./mongo-database.js";
import { ensureCollectionIndexes } from "./mongo-snapshot-store.js";

const MODULE_INDEXES: ReadonlyArray<{
  collectionName: string;
  indexes: IndexDescription[];
}> = [
  {
    collectionName: MONGO_COLLECTIONS.initiatives,
    indexes: [{ key: { stewardId: 1 } }, { key: { status: 1 } }, { key: { updatedAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeAnalyses,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeImprovementProposals,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeVersionRevisions,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeRevisionDrafts,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.decisionSessions,
    indexes: [{ key: { initiativeId: 1 } }, { key: { stewardId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeCollectiveDecisions,
    indexes: [{ key: { initiativeId: 1 } }, { key: { stewardId: 1 } }, { key: { status: 1 } }],
  },
  {
    // Recovery Task 31 — dedicated, transaction-capable authoritative
    // collection (no longer a whole-collection snapshot mirror). The dead
    // `{ status: 1 }` index was removed: `InitiativeDecisionVote` has no
    // `status` field. `unique(voteId)` and `unique(decisionId,
    // participantId)` are the database-enforced concurrency authority
    // (Gate 5); with a deterministic `voteId` the two are equivalent in
    // practice, but both are declared explicitly per Part 3/7.
    collectionName: MONGO_COLLECTIONS.initiativeDecisionVotes,
    indexes: [
      { key: { voteId: 1 }, unique: true, name: "initiative_decision_votes_vote_id_unique" },
      {
        // Pack 02B — partial unique so visitor rows (no participantId) do not collide.
        key: { decisionId: 1, participantId: 1 },
        unique: true,
        name: "initiative_decision_votes_decision_participant_unique_v2",
        partialFilterExpression: { participantId: { $exists: true, $type: "string" } },
      },
      {
        key: { decisionId: 1, visitorKey: 1 },
        unique: true,
        name: "initiative_decision_votes_decision_visitor_unique",
        partialFilterExpression: { visitorKey: { $exists: true, $type: "string" } },
      },
      { key: { decisionId: 1 }, name: "initiative_decision_votes_decision_id" },
      { key: { participantId: 1 }, name: "initiative_decision_votes_participant_id" },
      { key: { visitorKey: 1 }, name: "initiative_decision_votes_visitor_key" },
      { key: { decisionId: 1, choice: 1 }, name: "initiative_decision_votes_decision_choice" },
      {
        key: { initiativeId: 1, candidateId: 1 },
        name: "initiative_decision_votes_initiative_candidate",
      },
      {
        key: { expireAt: 1 },
        expireAfterSeconds: 0,
        name: "initiative_decision_votes_expire_at_ttl",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
    indexes: [
      {
        key: { historyId: 1 },
        unique: true,
        name: "initiative_decision_vote_history_history_id_unique",
      },
      {
        key: { voteId: 1, changedAt: 1 },
        name: "initiative_decision_vote_history_vote_id_changed_at",
      },
      {
        key: { decisionId: 1, changedAt: 1 },
        name: "initiative_decision_vote_history_decision_id_changed_at",
      },
      {
        key: { participantId: 1, changedAt: 1 },
        name: "initiative_decision_vote_history_participant_id_changed_at",
      },
      {
        key: { visitorKey: 1, changedAt: 1 },
        name: "initiative_decision_vote_history_visitor_key_changed_at",
      },
      {
        key: { expireAt: 1 },
        expireAfterSeconds: 0,
        name: "initiative_decision_vote_history_expire_at_ttl",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.publicChoiceCandidates,
    indexes: [
      {
        key: { candidateId: 1 },
        unique: true,
        name: "public_choice_candidates_candidate_id_unique",
      },
      { key: { initiativeId: 1 }, name: "public_choice_candidates_initiative_id" },
      {
        key: { initiativeId: 1, sortOrder: 1 },
        name: "public_choice_candidates_initiative_sort",
      },
      {
        key: { expireAt: 1 },
        expireAfterSeconds: 0,
        name: "public_choice_candidates_expire_at_ttl",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.mediaResources,
    indexes: [
      {
        key: { id: 1 },
        unique: true,
        name: "media_resources_id_unique",
      },
      {
        key: { resourceType: 1, scopeType: 1, countryCode: 1, active: 1 },
        name: "media_resources_type_scope_country_active",
      },
      {
        key: { sortOrder: 1 },
        name: "media_resources_sort_order",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.countryAffiliations,
    indexes: [
      {
        key: { entryId: 1 },
        unique: true,
        name: "country_affiliations_entry_id_unique",
      },
      {
        key: { countryCode: 1, entryType: 1, active: 1 },
        name: "country_affiliations_country_type_active",
      },
      {
        key: { sortOrder: 1 },
        name: "country_affiliations_sort_order",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.publicChoiceResultsSnapshots,
    indexes: [
      {
        key: { snapshotId: 1 },
        unique: true,
        name: "public_choice_results_snapshots_snapshot_id_unique",
      },
      {
        key: { decisionId: 1 },
        unique: true,
        name: "public_choice_results_snapshots_decision_id_unique",
      },
      { key: { initiativeId: 1 }, name: "public_choice_results_snapshots_initiative_id" },
      {
        key: { expiresAt: 1 },
        expireAfterSeconds: 0,
        name: "public_choice_results_snapshots_expires_at_ttl",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.participationAreas,
    indexes: [{ key: { participantId: 1 } }, { key: { communitySlug: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.participationAreaTransitions,
    indexes: [{ key: { participantId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicActionPackages,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { decisionId: 1 } },
      { key: { capId: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicDeliveries,
    indexes: [
      { key: { capId: 1 } },
      { key: { initiativeId: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicDeliveryRecipients,
    indexes: [{ key: { deliveryId: 1 } }, { key: { capId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.officialResponses,
    indexes: [
      { key: { capId: 1 } },
      { key: { initiativeId: 1 } },
      { key: { deliveryId: 1 } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.officialResponseIdentities,
    indexes: [{ key: { capId: 1 } }, { key: { updatedAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicAccountabilities,
    indexes: [
      { key: { capId: 1 } },
      { key: { initiativeId: 1 } },
      { key: { decisionId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicAccountabilityEvents,
    indexes: [
      { key: { accountabilityId: 1 } },
      { key: { recordedByParticipantId: 1 } },
      { key: { occurredAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeImplementationCommitments,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { decisionId: 1 } },
      { key: { participantId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeImplementationTrackings,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { commitmentId: 1 } },
      { key: { participantId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.implementationTrackingUpdates,
    indexes: [{ key: { trackingId: 1 } }, { key: { authorId: 1 } }, { key: { createdAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativePublicImpacts,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { trackingId: 1 } },
      { key: { participantId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.publicImpactEvidence,
    indexes: [{ key: { impactId: 1 } }, { key: { authorId: 1 } }, { key: { createdAt: -1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.publicCivicArchiveRecords,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { impactId: 1 } },
      { key: { stewardId: 1 } },
      { key: { status: 1 } },
      { key: { updatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.publicNewsArticles,
    indexes: [
      {
        key: { normalizedArticleUrl: 1 },
        unique: true,
        name: "public_news_normalized_article_url_unique",
      },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "public_news_expires_at_ttl" },
      { key: { publishedAt: -1 }, name: "public_news_published_at" },
      { key: { status: 1, publishedAt: -1 }, name: "public_news_status_published_at" },
      { key: { sourceName: 1 }, name: "public_news_source_name" },
      { key: { language: 1 }, name: "public_news_language" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicCompatibilityReviews,
    indexes: [
      { key: { initiativeId: 1 } },
      { key: { requestedByStewardId: 1 } },
      { key: { generatedAt: -1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.authUsers,
    indexes: [
      { key: { email: 1 }, unique: true, name: "auth_user_email_unique" },
      { key: { status: 1 }, name: "auth_user_status" },
      { key: { createdAt: -1 }, name: "auth_user_created_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.authSessions,
    indexes: [
      { key: { sessionId: 1 }, unique: true, name: "auth_session_id_unique" },
      { key: { userId: 1 }, name: "auth_session_user_id" },
      { key: { expiresAt: 1 }, name: "auth_session_expires_at" },
      { key: { revokedAt: 1 }, name: "auth_session_revoked_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.memberships,
    indexes: [
      { key: { userId: 1 }, unique: true, name: "membership_user_id_unique" },
      {
        key: { memberNumber: 1 },
        unique: true,
        partialFilterExpression: { memberNumber: { $exists: true, $type: "string" } },
        name: "membership_member_number_unique_v2",
      },
      { key: { status: 1, updatedAt: -1 }, name: "membership_status_updated_at" },
      { key: { applicationStatus: 1 }, name: "membership_application_status" },
      { key: { profileId: 1 }, name: "membership_profile_id" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.membershipContributions,
    indexes: [
      { key: { contributionId: 1 }, unique: true, name: "membership_contribution_id_unique" },
      { key: { membershipId: 1, createdAt: -1 }, name: "membership_contribution_membership_id" },
      { key: { userId: 1, createdAt: -1 }, name: "membership_contribution_user_id" },
      {
        key: { stripeCheckoutSessionId: 1 },
        unique: true,
        partialFilterExpression: { stripeCheckoutSessionId: { $type: "string" } },
        name: "membership_contribution_checkout_session_unique",
      },
      {
        key: { stripePaymentIntentId: 1 },
        sparse: true,
        name: "membership_contribution_payment_intent",
      },
      { key: { status: 1, updatedAt: -1 }, name: "membership_contribution_status" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.membershipWebhookEvents,
    indexes: [
      {
        key: { stripeEventId: 1 },
        unique: true,
        name: "membership_webhook_stripe_event_id_unique",
      },
      { key: { stripeEventType: 1, receivedAt: -1 }, name: "membership_webhook_event_type" },
      { key: { membershipId: 1 }, name: "membership_webhook_membership_id" },
      { key: { userId: 1 }, name: "membership_webhook_user_id" },
      { key: { processingStatus: 1 }, name: "membership_webhook_processing_status" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.memberBadgeContributions,
    indexes: [
      {
        key: { badgeContributionId: 1 },
        unique: true,
        name: "member_badge_contribution_id_unique",
      },
      {
        key: { badgeRequestNumber: 1 },
        unique: true,
        name: "member_badge_request_number_unique",
      },
      { key: { userId: 1, createdAt: -1 }, name: "member_badge_contribution_user_id" },
      { key: { membershipId: 1, createdAt: -1 }, name: "member_badge_contribution_membership_id" },
      {
        key: { stripeCheckoutSessionId: 1 },
        unique: true,
        partialFilterExpression: { stripeCheckoutSessionId: { $type: "string" } },
        name: "member_badge_checkout_session_unique",
      },
      {
        key: { stripePaymentIntentId: 1 },
        sparse: true,
        name: "member_badge_payment_intent",
      },
      { key: { contributionStatus: 1, updatedAt: -1 }, name: "member_badge_contribution_status" },
      { key: { fulfillmentStatus: 1 }, name: "member_badge_fulfillment_status" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.memberProfiles,
    indexes: [
      { key: { userId: 1 }, unique: true, name: "member_profile_user_id_unique" },
      { key: { publicName: 1 }, unique: true, name: "member_profile_public_name_unique" },
      { key: { country: 1 }, name: "member_profile_country" },
      { key: { region: 1 }, name: "member_profile_region" },
      { key: { community: 1 }, name: "member_profile_community" },
      { key: { participationAreaId: 1 }, name: "member_profile_participation_area_id" },
      { key: { profileVisibility: 1 }, name: "member_profile_visibility" },
      // SEO Pack 11 — sitemap enumeration of active public profiles.
      {
        key: { profileVisibility: 1, status: 1 },
        name: "member_profile_visibility_status",
      },
      { key: { updatedAt: -1 }, name: "member_profile_updated_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.emailAuditRecords,
    indexes: [
      { key: { emailId: 1 }, unique: true, name: "email_audit_id_unique" },
      { key: { template: 1 }, name: "email_audit_template" },
      { key: { status: 1 }, name: "email_audit_status" },
      { key: { createdAt: -1 }, name: "email_audit_created_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.emailVerificationTokens,
    indexes: [
      { key: { tokenHash: 1 }, unique: true, name: "email_verification_token_hash_unique" },
      { key: { userId: 1 }, name: "email_verification_token_user_id" },
      { key: { purpose: 1 }, name: "email_verification_token_purpose" },
      { key: { expiresAt: 1 }, name: "email_verification_token_expires_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.emailConfirmationCodes,
    indexes: [
      { key: { confirmationId: 1 }, unique: true, name: "email_confirmation_id_unique" },
      { key: { userId: 1 }, name: "email_confirmation_user_id" },
      { key: { status: 1 }, name: "email_confirmation_status" },
      { key: { purpose: 1 }, name: "email_confirmation_purpose" },
      { key: { expiresAt: 1 }, name: "email_confirmation_expires_at" },
      {
        key: { userId: 1, purpose: 1, status: 1 },
        name: "email_confirmation_user_purpose_status",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.emailConfirmationSendLog,
    indexes: [
      { key: { userId: 1 }, name: "email_confirmation_send_user_id" },
      { key: { email: 1 }, name: "email_confirmation_send_email" },
      { key: { sentAt: -1 }, name: "email_confirmation_send_sent_at" },
      { key: { ipKey: 1 }, name: "email_confirmation_send_ip_key" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.betaInvites,
    indexes: [
      { key: { inviteId: 1 }, unique: true, name: "beta_invite_id_unique" },
      { key: { email: 1 }, name: "beta_invite_email" },
      { key: { codeHash: 1 }, unique: true, name: "beta_invite_code_hash_unique" },
      { key: { status: 1 }, name: "beta_invite_status" },
      { key: { expiresAt: 1 }, name: "beta_invite_expires_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicNominationVotes,
    indexes: [
      { key: { nominationId: 1 } },
      { key: { participantId: 1 } },
      { key: { choice: 1 } },
      { key: { createdAt: 1 } },
      { key: { updatedAt: 1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicNominationVoteHistory,
    indexes: [
      { key: { nominationId: 1 } },
      { key: { participantId: 1 } },
      { key: { changedAt: 1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.civicNominationVotingSessions,
    indexes: [{ key: { nominationId: 1 } }, { key: { status: 1 } }, { key: { closesAt: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeComments,
    indexes: [
      { key: { initiativeId: 1, status: 1, createdAt: -1 } },
      { key: { authorUserId: 1, createdAt: -1 } },
      { key: { commentId: 1 }, unique: true, name: "initiative_comment_id_unique" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeCommentReactions,
    indexes: [
      {
        key: { commentId: 1, actorUserId: 1 },
        unique: true,
        name: "initiative_comment_reaction_unique",
      },
      { key: { initiativeId: 1, commentId: 1 } },
      { key: { commentId: 1, reaction: 1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeAnalysisReactions,
    indexes: [
      {
        key: { analysisId: 1, actorUserId: 1 },
        unique: true,
        name: "initiative_analysis_reaction_unique",
      },
      { key: { initiativeId: 1, analysisId: 1 } },
      { key: { analysisId: 1, reaction: 1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeSupportRegisteredSignals,
    indexes: [
      {
        key: { initiativeId: 1, actorUserId: 1 },
        unique: true,
        name: "initiative_support_registered_unique",
      },
      { key: { initiativeId: 1, signal: 1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeSupportVisitorSignals,
    indexes: [
      {
        key: { initiativeId: 1, visitorKey: 1 },
        unique: true,
        name: "initiative_support_visitor_unique",
      },
      { key: { initiativeId: 1, signal: 1 } },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeSupportBookmarks,
    indexes: [
      {
        key: { initiativeId: 1, userId: 1 },
        unique: true,
        name: "initiative_support_bookmark_unique",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeSupportViews,
    indexes: [
      {
        key: { initiativeId: 1, viewerKey: 1 },
        unique: true,
        name: "initiative_support_view_unique",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.memberNotifications,
    indexes: [
      { key: { recipientUserId: 1, createdAt: -1 }, name: "member_notification_recipient_created" },
      { key: { recipientProfileId: 1, createdAt: -1 }, name: "member_notification_profile_created" },
      { key: { recipientUserId: 1, status: 1 }, name: "member_notification_recipient_status" },
      { key: { createdAt: -1 }, name: "member_notification_created" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.adminNotifications,
    indexes: [
      {
        key: { recipientAdminUserId: 1, createdAt: -1 },
        name: "admin_notification_recipient_created",
      },
      {
        key: { recipientAdminUserId: 1, sourceEventId: 1 },
        unique: true,
        sparse: true,
        name: "admin_notification_recipient_source_event_unique",
      },
      {
        key: { expireAt: 1 },
        expireAfterSeconds: 0,
        name: "admin_notification_expire_at_ttl",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.adminOperationalIncidents,
    indexes: [
      {
        key: { dedupeKey: 1 },
        unique: true,
        name: "admin_operational_incident_dedupe_unique",
      },
      {
        key: { expireAt: 1 },
        expireAfterSeconds: 0,
        name: "admin_operational_incident_expire_at_ttl",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.members,
    indexes: [
      { key: { memberId: 1 }, unique: true, name: "members_member_id_unique" },
      { key: { identityId: 1 }, unique: true, name: "members_identity_id_unique" },
      { key: { uniqueName: 1 }, unique: true, name: "members_unique_name_unique" },
      { key: { createdAt: -1 }, name: "members_created_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.activities,
    indexes: [
      { key: { activityId: 1 }, unique: true, name: "activities_activity_id_unique" },
      { key: { creatorMemberId: 1 }, name: "activities_creator_member_id" },
      { key: { status: 1 }, name: "activities_status" },
      { key: { createdAt: -1 }, name: "activities_created_at" },
      { key: { visibility: 1 }, name: "activities_visibility" },
      { key: { activityType: 1 }, name: "activities_activity_type" },
      { key: { aggregateVersion: 1 }, name: "activities_aggregate_version" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.discussions,
    indexes: [
      { key: { discussionId: 1 }, unique: true, name: "discussions_discussion_id_unique" },
      { key: { activityId: 1 }, name: "discussions_activity_id" },
      { key: { creatorMemberId: 1 }, name: "discussions_creator_member_id" },
      { key: { createdAt: -1 }, name: "discussions_created_at" },
      { key: { status: 1 }, name: "discussions_status" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.proposals,
    indexes: [
      { key: { proposalId: 1 }, unique: true, name: "proposals_proposal_id_unique" },
      { key: { activityId: 1 }, name: "proposals_activity_id" },
      { key: { discussionId: 1 }, name: "proposals_discussion_id" },
      { key: { creatorMemberId: 1 }, name: "proposals_creator_member_id" },
      { key: { status: 1 }, name: "proposals_status" },
      { key: { createdAt: -1 }, name: "proposals_created_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.decisions,
    indexes: [
      { key: { decisionId: 1 }, unique: true, name: "decisions_decision_id_unique" },
      { key: { proposalId: 1 }, unique: true, name: "decisions_proposal_id_unique" },
      { key: { activityId: 1 }, name: "decisions_activity_id" },
      { key: { creatorMemberId: 1 }, name: "decisions_creator_member_id" },
      { key: { status: 1 }, name: "decisions_status" },
      { key: { createdAt: -1 }, name: "decisions_created_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.petitions,
    indexes: [
      { key: { petitionId: 1 }, unique: true, name: "petitions_petition_id_unique" },
      {
        key: { collectiveDecisionId: 1 },
        unique: true,
        name: "petitions_collective_decision_id_unique",
      },
      { key: { "subject.initiativeId": 1 }, name: "petitions_subject_initiative_id" },
      { key: { status: 1 }, name: "petitions_status" },
      { key: { createdAt: -1 }, name: "petitions_created_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.petitionSignatures,
    indexes: [
      { key: { signatureId: 1 }, unique: true, name: "petition_signatures_signature_id_unique" },
      {
        key: { petitionId: 1, memberId: 1 },
        unique: true,
        name: "petition_signatures_petition_member_unique",
      },
      { key: { petitionId: 1, signedAt: 1 }, name: "petition_signatures_petition_signed_at" },
      { key: { initiativeId: 1 }, name: "petition_signatures_initiative_id" },
      // Pack 19C.2B — Participant Petition statistics (`listActiveSignaturesByMemberId`).
      { key: { memberId: 1, status: 1 }, name: "petition_signatures_member_status" },
    ],
  },
  {
    // Initiative Lifecycle — Part F. One Petition Lifecycle draft per
    // Initiative, mirroring `initiativeRevisionDrafts`.
    collectionName: MONGO_COLLECTIONS.initiativePetitionDrafts,
    indexes: [{ key: { initiativeId: 1 } }, { key: { authorId: 1 } }],
  },
  {
    // Phase 04 — Discussion completion marker (Center-tab surface; no parallel Discussion domain).
    collectionName: MONGO_COLLECTIONS.initiativeDiscussionCompletions,
    indexes: [{ key: { initiativeId: 1 }, unique: true }],
  },
  {
    // Initiative Lifecycle — Part F, Section 7/8. One "civic interest"
    // signal per (petition, visitor cookie) — never a `Signature`, never
    // counted toward `SupportMetrics`.
    collectionName: MONGO_COLLECTIONS.petitionVisitorSignals,
    indexes: [
      {
        key: { petitionId: 1, visitorKey: 1 },
        unique: true,
        name: "petition_visitor_signals_petition_visitor_unique",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.workspaceProjections,
    indexes: [
      { key: { memberId: 1 }, unique: true, name: "workspace_projections_member_id_unique" },
      { key: { workspaceId: 1 }, unique: true, name: "workspace_projections_workspace_id_unique" },
      { key: { updatedAt: -1 }, name: "workspace_projections_updated_at" },
      { key: { projectionVersion: 1 }, name: "workspace_projections_projection_version" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.outbox,
    indexes: [
      { key: { eventId: 1 }, unique: true, name: "outbox_event_id_unique" },
      { key: { status: 1, createdAt: 1 }, name: "outbox_status_created_at" },
      { key: { aggregateType: 1, aggregateId: 1 }, name: "outbox_aggregate_ref" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.processedEvents,
    indexes: [
      {
        key: { consumerId: 1, eventId: 1 },
        unique: true,
        name: "processed_events_consumer_event_unique",
      },
      { key: { processedAt: -1 }, name: "processed_events_processed_at" },
    ],
  },
  {
    // Recovery Task 27 Part 6 — Participant Action Ledger. Indexes are
    // limited to what the accepted near-term projections (Part 19) and
    // focused tests (Part 21) actually require.
    collectionName: MONGO_COLLECTIONS.participantActions,
    indexes: [
      {
        key: { participantActionId: 1 },
        unique: true,
        name: "participant_actions_participant_action_id_unique",
      },
      {
        key: { sourceEventId: 1 },
        unique: true,
        name: "participant_actions_source_event_id_unique",
      },
      {
        key: { participantId: 1, occurredAt: -1 },
        name: "participant_actions_participant_id_occurred_at",
      },
      {
        key: { initiativeId: 1, occurredAt: -1 },
        name: "participant_actions_initiative_id_occurred_at",
      },
      {
        key: { participantId: 1, initiativeId: 1, occurredAt: -1 },
        name: "participant_actions_participant_initiative_occurred_at",
      },
      {
        key: { sourceType: 1, sourceId: 1 },
        name: "participant_actions_source_type_source_id",
      },
      {
        key: { actionType: 1, occurredAt: -1 },
        name: "participant_actions_action_type_occurred_at",
      },
    ],
  },
  {
    // UX Evolution Pack 02.1 — a single mutable-status row per
    // (initiativeId, participantId) pair is the entire uniqueness
    // authority: it is what gives "one current Ally relationship per
    // Initiative + Participant" for free (interest, invitation, acceptance,
    // and decline are status transitions on that one row, never separate
    // documents). Every exact-key access pattern is served by this one
    // compound index — the initiativeId-prefixed scan (optionally filtered
    // by status in the query) is also covered by it.
    //
    // Profile UX Pack 01 — the Workspace "Collaborations" count and the
    // cross-initiative "which Allies rows belong to this Participant" read
    // (used to build the Workspace Allies widget) both query by
    // `participantId` alone, across initiatives. The second index below
    // exists specifically for that access pattern.
    collectionName: MONGO_COLLECTIONS.initiativeAllies,
    indexes: [
      {
        key: { initiativeId: 1, participantId: 1 },
        unique: true,
        name: "initiative_allies_initiative_participant_unique",
      },
      {
        key: { participantId: 1, status: 1 },
        name: "initiative_allies_participant_status",
      },
    ],
  },
  {
    // UX Evolution Pack 02.1 — `sourceCommentId` is the sole uniqueness
    // authority ("one discussion comment -> at most one active Proposal
    // Candidate"). Pack 19C.2B adds `sourceParticipantId`+`status` for
    // Participant Proposal statistics (`listProposalCandidatesBySourceParticipantId`).
    collectionName: MONGO_COLLECTIONS.initiativeDiscussionProposalCandidates,
    indexes: [
      {
        key: { sourceCommentId: 1 },
        unique: true,
        name: "initiative_discussion_proposal_candidates_source_comment_unique",
      },
      {
        key: { sourceParticipantId: 1, status: 1 },
        name: "initiative_discussion_proposal_candidates_source_participant_status",
      },
    ],
  },
  {
    // Profile UX Pack 03 Part 4 — `pairKey` (the deterministic
    // `min(participantIdA, participantIdB)::max(...)` natural key) is the
    // database-enforced uniqueness authority for "only one active direct
    // conversation per unordered Participant pair" (Part 3): every
    // creation goes through one atomic `findOneAndUpdate(..., { upsert:
    // true })` against this unique index, never an application-level
    // check-then-write.
    collectionName: MONGO_COLLECTIONS.directConversations,
    indexes: [
      { key: { conversationId: 1 }, unique: true, name: "direct_conversations_conversation_id_unique" },
      { key: { pairKey: 1 }, unique: true, name: "direct_conversations_pair_key_unique" },
      { key: { participantIds: 1, lastMessageAt: -1 }, name: "direct_conversations_participant_last_message" },
      { key: { lastMessageAt: -1 }, name: "direct_conversations_last_message_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.directMessages,
    indexes: [
      { key: { messageId: 1 }, unique: true, name: "direct_messages_message_id_unique" },
      { key: { conversationId: 1, createdAt: 1 }, name: "direct_messages_conversation_created_at" },
      { key: { senderParticipantId: 1, createdAt: 1 }, name: "direct_messages_sender_created_at" },
      {
        // Part 21 #2 — idempotent send retry: a duplicate `clientMessageId`
        // within the same conversation+sender never creates a second
        // message. Sparse/partial so messages sent without a
        // `clientMessageId` never collide with each other.
        key: { conversationId: 1, senderParticipantId: 1, clientMessageId: 1 },
        unique: true,
        name: "direct_messages_client_message_id_unique",
        partialFilterExpression: { clientMessageId: { $exists: true } },
      },
    ],
  },
  {
    // Communication UX Pack 03.5 — one persistent Collaboration Channel per
    // Initiative (never a separate "channel" document; the Initiative id
    // itself is the channel's identity). Chronological history and cursor
    // pagination both key off `(initiativeId, createdAt)`.
    collectionName: MONGO_COLLECTIONS.initiativeCollaborationChannelMessages,
    indexes: [
      {
        key: { messageId: 1 },
        unique: true,
        name: "initiative_collaboration_channel_messages_message_id_unique",
      },
      {
        key: { initiativeId: 1, createdAt: 1 },
        name: "initiative_collaboration_channel_messages_initiative_created_at",
      },
    ],
  },
  {
    // Part 6 — one per-viewer read marker per (initiativeId, participantId).
    // Unlike Direct Messaging's embedded `reads` array (fixed 2
    // Participants), the Channel's membership changes over time, so each
    // read marker is its own upserted row rather than a pre-seeded array
    // element.
    collectionName: MONGO_COLLECTIONS.initiativeCollaborationChannelReads,
    indexes: [
      {
        key: { initiativeId: 1, participantId: 1 },
        unique: true,
        name: "initiative_collaboration_channel_reads_initiative_participant_unique",
      },
    ],
  },
  {
    // Communication UX Pack 03.6 Part 1 — one schedule per Initiative;
    // `scheduledAtUtc` (derived, never independently editable) drives both
    // the chronological list order and the Part 3 status derivation.
    collectionName: MONGO_COLLECTIONS.initiativeCollaborationSessions,
    indexes: [
      {
        key: { sessionId: 1 },
        unique: true,
        name: "initiative_collaboration_sessions_session_id_unique",
      },
      {
        key: { initiativeId: 1, scheduledAtUtc: 1 },
        name: "initiative_collaboration_sessions_initiative_scheduled_at",
      },
    ],
  },
  {
    // Part 6 — one attendance row per (session, participant); read
    // patterns are always "all attendance for one session" (prefix scan on
    // this same unique index, no separate index needed).
    collectionName: MONGO_COLLECTIONS.initiativeCollaborationSessionAttendances,
    indexes: [
      {
        key: { sessionId: 1, participantId: 1 },
        unique: true,
        name: "initiative_collaboration_session_attendances_session_participant_unique",
      },
      {
        // Part 14 — supports the one batched "every attendance row across
        // this Initiative's Sessions" read used when building the Session
        // list view, avoiding a per-session query (N+1).
        key: { initiativeId: 1 },
        name: "initiative_collaboration_session_attendances_initiative_id",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.sharedDocuments,
    indexes: [
      {
        key: { documentId: 1 },
        unique: true,
        name: "shared_documents_document_id_unique",
      },
      {
        key: { documentFamilyId: 1, version: 1 },
        name: "shared_documents_family_version",
      },
      {
        key: { conversationId: 1, isLatestVersion: 1, uploadedAt: -1 },
        name: "shared_documents_conversation_latest_uploaded_at",
      },
      {
        // Collaboration Channel documents (`initiativeId` only, no `sessionId`).
        key: { contextType: 1, initiativeId: 1, isLatestVersion: 1, uploadedAt: -1 },
        name: "shared_documents_channel_latest_uploaded_at",
      },
      {
        // Collaboration Session documents (`initiativeId` + `sessionId`).
        key: { sessionId: 1, isLatestVersion: 1, uploadedAt: -1 },
        name: "shared_documents_session_latest_uploaded_at",
      },
    ],
  },
  {
    // Production Deployment Pack 02 — durable media metadata (survives API restart).
    collectionName: MONGO_COLLECTIONS.mediaUploadRecords,
    indexes: [
      {
        key: { mediaId: 1 },
        unique: true,
        name: "media_upload_records_media_id_unique",
      },
      {
        key: { ownerUserId: 1, createdAt: -1 },
        name: "media_upload_records_owner_created_at",
      },
      {
        key: { initiativeId: 1, createdAt: -1 },
        name: "media_upload_records_initiative_created_at",
      },
      {
        key: { mediaUrl: 1 },
        name: "media_upload_records_media_url",
      },
    ],
  },
  {
    // Language Architecture Pack 02 — version-aware unique translation identity.
    collectionName: MONGO_COLLECTIONS.contentTranslations,
    indexes: [
      {
        key: {
          sourceKind: 1,
          sourceRecordId: 1,
          sourceVersion: 1,
          targetLanguage: 1,
        },
        unique: true,
        name: "content_translations_identity_unique",
      },
      {
        key: { sourceKind: 1, sourceRecordId: 1, stale: 1 },
        name: "content_translations_source_stale",
      },
    ],
  },
  {
    // Blog Implementation Pack 02 — publishing domain.
    collectionName: MONGO_COLLECTIONS.blogPosts,
    indexes: [
      { key: { postId: 1 }, unique: true, name: "blog_posts_post_id_unique" },
      { key: { slug: 1 }, unique: true, name: "blog_posts_slug_unique" },
      { key: { status: 1, publishedAt: -1 }, name: "blog_posts_status_published_at" },
      {
        key: { authorParticipantId: 1, updatedAt: -1 },
        name: "blog_posts_author_updated_at",
      },
      { key: { categoryId: 1, publishedAt: -1 }, name: "blog_posts_category_published_at" },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.blogCategories,
    indexes: [
      { key: { categoryId: 1 }, unique: true, name: "blog_categories_category_id_unique" },
      { key: { slug: 1 }, unique: true, name: "blog_categories_slug_unique" },
      { key: { status: 1, name: 1 }, name: "blog_categories_status_name" },
    ],
  },
  {
    // Pack 21A — Blog email subscribers (unique per normalized email + type).
    collectionName: MONGO_COLLECTIONS.blogSubscribers,
    indexes: [
      {
        key: { emailNormalized: 1, subscriptionType: 1 },
        unique: true,
        name: "blog_subscribers_email_type_unique",
      },
      { key: { subscriberId: 1 }, unique: true, name: "blog_subscribers_subscriber_id_unique" },
      { key: { confirmTokenHash: 1 }, name: "blog_subscribers_confirm_token_hash" },
      { key: { unsubscribeTokenHash: 1 }, name: "blog_subscribers_unsubscribe_token_hash" },
      { key: { status: 1, subscribedAt: -1 }, name: "blog_subscribers_status_subscribed_at" },
      // Pack 21C — Admin directory default sort (newest created first).
      { key: { createdAt: -1 }, name: "blog_subscribers_created_at" },
    ],
  },
  {
    // Pack 21B — single Blog subscription welcome settings document.
    collectionName: MONGO_COLLECTIONS.blogSubscriptionSettings,
    indexes: [
      {
        key: { settingsId: 1 },
        unique: true,
        name: "blog_subscription_settings_id_unique",
      },
    ],
  },
  {
    // Pack 21D — one delivery fact per (post, subscriber); preserves sent for dedupe.
    collectionName: MONGO_COLLECTIONS.blogPublicationDeliveries,
    indexes: [
      {
        key: { postId: 1, subscriberId: 1 },
        unique: true,
        name: "blog_publication_deliveries_post_subscriber_unique",
      },
      {
        key: { deliveryId: 1 },
        unique: true,
        name: "blog_publication_deliveries_delivery_id_unique",
      },
      { key: { postId: 1, status: 1 }, name: "blog_publication_deliveries_post_status" },
      { key: { createdAt: 1 }, name: "blog_publication_deliveries_created_at" },
    ],
  },
  {
    // Pack 21E — Admin selected-subscriber messages.
    collectionName: MONGO_COLLECTIONS.blogAdminSubscriberMessages,
    indexes: [
      {
        key: { adminMessageId: 1 },
        unique: true,
        name: "blog_admin_subscriber_messages_id_unique",
      },
      { key: { createdAt: -1 }, name: "blog_admin_subscriber_messages_created_at" },
    ],
  },
  {
    // Pack 21E — one delivery fact per (adminMessage, subscriber).
    collectionName: MONGO_COLLECTIONS.blogAdminSubscriberMessageDeliveries,
    indexes: [
      {
        key: { adminMessageId: 1, subscriberId: 1 },
        unique: true,
        name: "blog_admin_message_deliveries_message_subscriber_unique",
      },
      {
        key: { deliveryId: 1 },
        unique: true,
        name: "blog_admin_message_deliveries_delivery_id_unique",
      },
      {
        key: { adminMessageId: 1, status: 1 },
        name: "blog_admin_message_deliveries_message_status",
      },
      { key: { createdAt: 1 }, name: "blog_admin_message_deliveries_created_at" },
    ],
  },
  {
    // Pack 17C — one document per official social network.
    collectionName: MONGO_COLLECTIONS.platformSocialAccounts,
    indexes: [
      {
        key: { networkId: 1 },
        unique: true,
        name: "platform_social_accounts_network_id_unique",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.blogCapabilityGrants,
    indexes: [
      {
        key: { participantId: 1 },
        unique: true,
        name: "blog_capability_grants_participant_unique",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.blogAuthorApplications,
    indexes: [
      {
        key: { applicationId: 1 },
        unique: true,
        name: "blog_author_applications_application_id_unique",
      },
      {
        key: { participantId: 1, status: 1 },
        name: "blog_author_applications_participant_status",
      },
    ],
  },
  {
    // Blog Interaction Pack 07 — comments (one-level replies).
    collectionName: MONGO_COLLECTIONS.blogComments,
    indexes: [
      { key: { commentId: 1 }, unique: true, name: "blog_comments_comment_id_unique" },
      {
        key: { postId: 1, status: 1, parentCommentId: 1, createdAt: 1 },
        name: "blog_comments_post_status_parent_created",
      },
      { key: { postId: 1, createdAt: 1 }, name: "blog_comments_post_created" },
      { key: { parentCommentId: 1, createdAt: 1 }, name: "blog_comments_parent_created" },
    ],
  },
  {
    // Blog Interaction Pack 07 — one reaction per Participant per post.
    collectionName: MONGO_COLLECTIONS.blogReactions,
    indexes: [
      { key: { reactionId: 1 }, unique: true, name: "blog_reactions_reaction_id_unique" },
      {
        key: { postId: 1, actorParticipantId: 1 },
        unique: true,
        name: "blog_reactions_post_actor_unique",
      },
      { key: { postId: 1, reaction: 1 }, name: "blog_reactions_post_kind" },
    ],
  },
  {
    // Admin Foundation Pack 02 — generalized capability grants (dual-read).
    collectionName: MONGO_COLLECTIONS.platformCapabilityGrants,
    indexes: [
      { key: { grantId: 1 }, unique: true, name: "platform_capability_grants_grant_id_unique" },
      {
        key: { participantId: 1, capability: 1, scopeType: 1, scopeId: 1 },
        name: "platform_capability_grants_participant_capability_scope",
      },
      {
        key: { participantId: 1, revokedAt: 1 },
        name: "platform_capability_grants_participant_revoked",
      },
    ],
  },
  {
    // Admin Foundation Pack 02 — append-only administration audit log.
    collectionName: MONGO_COLLECTIONS.administrationAuditLog,
    indexes: [
      { key: { auditId: 1 }, unique: true, name: "administration_audit_audit_id_unique" },
      {
        key: { targetType: 1, targetId: 1, createdAt: 1 },
        name: "administration_audit_target_created",
      },
      {
        key: { actorParticipantId: 1, createdAt: -1 },
        name: "administration_audit_actor_created",
      },
      { key: { action: 1, createdAt: -1 }, name: "administration_audit_action_created" },
    ],
  },
  {
    // Pack 11C — platform traffic events (90-day TTL on expireAt).
    collectionName: MONGO_COLLECTIONS.trafficEvents,
    indexes: [
      { key: { eventId: 1 }, unique: true, name: "traffic_events_event_id_unique" },
      {
        key: { visitorId: 1, pathname: 1, navigationId: 1 },
        unique: true,
        name: "traffic_events_visitor_path_nav_unique",
        partialFilterExpression: { navigationId: { $exists: true, $type: "string" } },
      },
      { key: { occurredAt: -1 }, name: "traffic_events_occurred_at" },
      { key: { occurredAt: 1, pathname: 1 }, name: "traffic_events_occurred_path" },
      { key: { occurredAt: 1, sessionId: 1 }, name: "traffic_events_occurred_session" },
      { key: { occurredAt: 1, visitorId: 1 }, name: "traffic_events_occurred_visitor" },
      { key: { occurredAt: 1, referrerType: 1 }, name: "traffic_events_occurred_referrer" },
      { key: { occurredAt: 1, countryCode: 1 }, name: "traffic_events_occurred_country" },
      {
        key: { expireAt: 1 },
        expireAfterSeconds: 0,
        name: "traffic_events_expire_at_ttl",
      },
    ],
  },
  {
    collectionName: MONGO_COLLECTIONS.trafficSessions,
    indexes: [
      { key: { sessionId: 1 }, unique: true, name: "traffic_sessions_session_id_unique" },
      { key: { visitorId: 1, lastSeenAt: -1 }, name: "traffic_sessions_visitor_last_seen" },
      { key: { startedAt: -1 }, name: "traffic_sessions_started_at" },
      {
        key: { expireAt: 1 },
        expireAfterSeconds: 0,
        name: "traffic_sessions_expire_at_ttl",
      },
    ],
  },
  {
    // Pack 11D — long-lived daily aggregates (no TTL).
    collectionName: MONGO_COLLECTIONS.trafficDailyAggregates,
    indexes: [
      { key: { aggregateKey: 1 }, unique: true, name: "traffic_daily_aggregates_key_unique" },
      { key: { day: 1, dimension: 1 }, name: "traffic_daily_aggregates_day_dimension" },
      { key: { dimension: 1, day: 1 }, name: "traffic_daily_aggregates_dimension_day" },
    ],
  },
  {
    // Pack 11D — opaque visitor first-seen / last-seen-day for exact all-time uniques.
    collectionName: MONGO_COLLECTIONS.trafficVisitorRegistry,
    indexes: [
      { key: { visitorId: 1 }, unique: true, name: "traffic_visitor_registry_visitor_unique" },
      { key: { firstSeenAt: 1 }, name: "traffic_visitor_registry_first_seen" },
    ],
  },
  {
    // Pack 12A — one Editor grant per Participant (activate/deactivate in place).
    collectionName: MONGO_COLLECTIONS.editorGrants,
    indexes: [
      { key: { editorGrantId: 1 }, unique: true, name: "editor_grants_grant_id_unique" },
      { key: { participantId: 1 }, unique: true, name: "editor_grants_participant_unique" },
      { key: { status: 1, updatedAt: -1 }, name: "editor_grants_status_updated" },
      {
        key: { "geographicScope.level": 1, "geographicScope.countryCode": 1 },
        name: "editor_grants_scope_country",
      },
    ],
  },
];

/**
 * Recovery Task 31 Part 7 — one-time, idempotent removal of the dead
 * `{ status: 1 }` index on `initiative_decision_votes` (default Mongo name
 * `status_1`): `InitiativeDecisionVote` has no `status` field, and
 * `ensureCollectionIndexes` only ever creates indexes, never drops ones no
 * longer declared. Safe to call unconditionally on every startup — a
 * missing index (already dropped, or never created in a fresh database) is
 * not an error (Mongo error code 27, `IndexNotFound`), and neither is a
 * collection that does not exist yet at all — e.g. a freshly created
 * isolated test database, or a brand-new deployment (Mongo error code 26,
 * `NamespaceNotFound`).
 */
async function dropDeadInitiativeDecisionVoteStatusIndex(): Promise<void> {
  try {
    await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).dropIndex("status_1");
  } catch (error) {
    const mongoError = error as { code?: number; codeName?: string };

    if (
      mongoError.code === 27 ||
      mongoError.codeName === "IndexNotFound" ||
      mongoError.code === 26 ||
      mongoError.codeName === "NamespaceNotFound"
    ) {
      return;
    }

    throw error;
  }
}

/**
 * Pack 02B — replace non-partial unique(decisionId, participantId) so visitor
 * rows without participantId do not collide on null. Safe if already dropped.
 */
async function dropLegacyDecisionParticipantUniqueIndex(): Promise<void> {
  try {
    await getMongoCollection(MONGO_COLLECTIONS.initiativeDecisionVotes).dropIndex(
      "initiative_decision_votes_decision_participant_unique",
    );
  } catch (error) {
    const mongoError = error as { code?: number; codeName?: string };

    if (
      mongoError.code === 27 ||
      mongoError.codeName === "IndexNotFound" ||
      mongoError.code === 26 ||
      mongoError.codeName === "NamespaceNotFound"
    ) {
      return;
    }

    throw error;
  }
}

export async function ensureMongoIndexes(): Promise<void> {
  await dropDeadInitiativeDecisionVoteStatusIndex();
  await dropLegacyDecisionParticipantUniqueIndex();

  for (const entry of MODULE_INDEXES) {
    await ensureCollectionIndexes(entry.collectionName, entry.indexes);
  }
}
