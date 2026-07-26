import type { IndexDescription } from "mongodb";

import { MONGO_COLLECTIONS } from "./mongo-collections.js";
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
    collectionName: MONGO_COLLECTIONS.initiativeDecisionVotes,
    indexes: [{ key: { decisionId: 1 } }, { key: { participantId: 1 } }, { key: { status: 1 } }],
  },
  {
    collectionName: MONGO_COLLECTIONS.initiativeDecisionVoteHistory,
    indexes: [{ key: { decisionId: 1 } }, { key: { participantId: 1 } }],
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
];

export async function ensureMongoIndexes(): Promise<void> {
  for (const entry of MODULE_INDEXES) {
    await ensureCollectionIndexes(entry.collectionName, entry.indexes);
  }
}
