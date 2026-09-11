/**
 * Presentation-only notification copy: eventType → WEB_UI `notifications.types.*`
 * → locale. Persisted English title/message remain for API backward compatibility
 * and as fallback for unknown/legacy event types.
 */

/** Exhaustive set of CivicNotificationEventType keys from NOTIFICATION_TEMPLATES. */
export const KNOWN_NOTIFICATION_EVENT_TYPES = [
  "initiative_published",
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
  "civic_nomination_submitted",
  "civic_nomination_published",
  "civic_nomination_withdrawn",
  "civic_nomination_voting_opened",
  "civic_nomination_vote_cast",
  "civic_nomination_voting_closed",
  "initiative_interest_match",
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
  "initiative_lifecycle_stage_published",
  "blog_author_application_submitted",
  "blog_author_application_approved",
  "blog_author_application_changes_requested",
  "blog_author_application_declined",
  "blog_author_application_review_requested",
  "blog_author_access_blocked",
  "blog_author_access_restored",
  "blog_author_trusted_publishing_enabled",
  "blog_author_trusted_publishing_disabled",
  "blog_publication_blocked",
  "blog_publication_restored",
  "blog_publication_review_requested",
  "blog_post_changes_requested",
  "blog_post_published",
  "blog_post_declined",
  "blog_comment_posted",
  "blog_comment_reply",
  "editor_access_assigned",
  "editor_access_activated",
  "editor_access_deactivated",
  "editor_permissions_updated",
  "editor_editing_area_updated",
] as const;

export type KnownNotificationEventType = (typeof KNOWN_NOTIFICATION_EVENT_TYPES)[number];

const KNOWN_EVENT_TYPE_SET: ReadonlySet<string> = new Set(KNOWN_NOTIFICATION_EVENT_TYPES);

/** next-intl translator scoped to `notifications` (or a compatible shape). */
export type NotificationsTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has: (key: string) => boolean;
};

export function resolveNotificationPresentation(
  notification: { eventType: string; title: string; message: string },
  t: NotificationsTranslator,
): { title: string; message: string } {
  if (!KNOWN_EVENT_TYPE_SET.has(notification.eventType)) {
    return { title: notification.title, message: notification.message };
  }

  const titleKey = `types.${notification.eventType}.title`;
  const messageKey = `types.${notification.eventType}.message`;

  return {
    title: t.has(titleKey) ? t(titleKey) : notification.title,
    message: t.has(messageKey) ? t(messageKey) : notification.message,
  };
}

export function resolveNotificationPriorityLabel(
  priority: string,
  t: NotificationsTranslator,
): string {
  const key = `priorities.${priority}`;
  return t.has(key) ? t(key) : priority;
}
