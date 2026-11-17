/**
 * HU-NOTIF-02C.1 — strict email-eligible event-type allowlist.
 * Excludes DM, private collab content, admin-only, security/auth, RRP.
 */

import type { CivicNotificationEventType } from "@hu/types";

const EMAIL_ELIGIBLE_EVENT_TYPES = new Set<CivicNotificationEventType>([
  "initiative_published",
  "initiative_interest_match",
  "analysis_published",
  "proposal_submitted",
  "proposal_decided",
  "revision_published",
  "decision_opened",
  "decision_closed",
  "civic_action_package_issued",
  "official_response_received",
  "official_response_verified",
  "civic_accountability_event_added",
  "civic_accountability_closed",
  "commitment_published",
  "implementation_commitment_proposed",
  "implementation_commitment_taken",
  "tracking_updated",
  "impact_verified",
  "archive_published",
  "initiative_lifecycle_stage_published",
  "civic_nomination_published",
  "civic_nomination_voting_opened",
  "civic_nomination_voting_closed",
  "member_badge_contribution_confirmed",
  "member_badge_shipped",
  "member_badge_delivered",
  "member_badge_contribution_refunded",
  "initiative_comment_posted",
  "initiative_comment_reply",
  "initiative_collaboration_interest_expressed",
  "initiative_collaboration_interest_accepted",
  "initiative_collaboration_interest_declined",
  "initiative_allies_invitation_received",
  "initiative_allies_invitation_accepted",
  "initiative_allies_invitation_declined",
  "blog_author_application_approved",
  "blog_author_application_changes_requested",
  "blog_author_application_declined",
  "blog_author_access_blocked",
  "blog_author_access_restored",
  "blog_author_trusted_publishing_enabled",
  "blog_author_trusted_publishing_disabled",
  "blog_publication_blocked",
  "blog_publication_restored",
  "blog_post_changes_requested",
  "blog_post_published",
  "blog_post_declined",
]);

const PRIVACY_EXCLUDED_EVENT_TYPES = new Set<CivicNotificationEventType>([
  "direct_message_received",
  "initiative_collaboration_channel_message_received",
  "initiative_collaboration_channel_system_event",
  "initiative_collaboration_session_created",
  "initiative_collaboration_session_updated",
  "initiative_collaboration_session_cancelled",
  "initiative_collaboration_session_attendance_changed",
  "initiative_collaboration_session_upcoming_reminder",
  "shared_document_uploaded",
  "shared_document_replaced",
  "shared_document_removed",
  "blog_author_application_review_requested",
  "blog_publication_review_requested",
]);

export function isMemberNotificationEmailEventAllowlisted(
  eventType: CivicNotificationEventType,
): boolean {
  if (PRIVACY_EXCLUDED_EVENT_TYPES.has(eventType)) {
    return false;
  }
  return EMAIL_ELIGIBLE_EVENT_TYPES.has(eventType);
}

export function listMemberNotificationEmailAllowlistedEventTypes(): readonly CivicNotificationEventType[] {
  return [...EMAIL_ELIGIBLE_EVENT_TYPES];
}
