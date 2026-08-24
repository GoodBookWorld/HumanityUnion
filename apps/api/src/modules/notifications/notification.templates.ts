import type { CivicNotificationEventType } from "@hu/types";
import type { MemberNotificationPriority } from "@hu/types";

export interface NotificationTemplate {
  title: string;
  message: string;
  priority: MemberNotificationPriority;
}

export const NOTIFICATION_TEMPLATES: Record<CivicNotificationEventType, NotificationTemplate> = {
  initiative_published: {
    title: "Initiative published",
    message: "Your initiative was published.",
    priority: "important",
  },
  analysis_published: {
    title: "Collaborative analysis published",
    message: "A collaborative analysis was published for your initiative.",
    priority: "normal",
  },
  proposal_submitted: {
    title: "Improvement proposal submitted",
    message: "A new improvement proposal was submitted.",
    priority: "important",
  },
  proposal_decided: {
    title: "Proposal reviewed",
    message: "Your proposal was reviewed.",
    priority: "important",
  },
  revision_published: {
    title: "Initiative revision published",
    message: "An initiative revision was published.",
    priority: "normal",
  },
  decision_opened: {
    title: "Collective decision open",
    message: "A collective decision is open.",
    priority: "critical",
  },
  decision_closed: {
    title: "Collective decision closed",
    message: "Collective decision result is available.",
    priority: "important",
  },
  civic_action_package_issued: {
    title: "Civic Action Package ready",
    message: "Civic Action Package is ready.",
    priority: "important",
  },
  official_response_received: {
    title: "Official response recorded",
    message: "An official response was recorded.",
    priority: "important",
  },
  official_response_verified: {
    title: "Official response verified",
    message: "An official response was verified.",
    priority: "normal",
  },
  civic_accountability_event_added: {
    title: "Accountability timeline updated",
    message: "Accountability timeline was updated.",
    priority: "normal",
  },
  civic_accountability_closed: {
    title: "Accountability timeline closed",
    message: "A civic accountability timeline was closed.",
    priority: "informational",
  },
  commitment_published: {
    title: "Implementation commitment published",
    message: "An implementation commitment was published.",
    priority: "normal",
  },
  tracking_updated: {
    title: "Implementation tracking updated",
    message: "Implementation tracking was updated.",
    priority: "informational",
  },
  impact_verified: {
    title: "Public impact verified",
    message: "Your public impact was verified.",
    priority: "important",
  },
  archive_published: {
    title: "Archive record published",
    message: "Archive record was published.",
    priority: "informational",
  },
  civic_nomination_submitted: {
    title: "Civic nomination submitted",
    message: "Your civic nomination was submitted for review.",
    priority: "important",
  },
  civic_nomination_published: {
    title: "Civic nomination published",
    message: "Your civic nomination poster was published.",
    priority: "important",
  },
  civic_nomination_withdrawn: {
    title: "Civic nomination withdrawn",
    message: "Your civic nomination was withdrawn.",
    priority: "informational",
  },
  civic_nomination_voting_opened: {
    title: "Civic nomination voting opened",
    message: "Transparent support voting opened on your civic nomination poster.",
    priority: "important",
  },
  civic_nomination_vote_cast: {
    title: "Civic nomination vote recorded",
    message: "Your civic nomination support vote was recorded.",
    priority: "informational",
  },
  civic_nomination_voting_closed: {
    title: "Civic nomination voting closed",
    message: "Transparent support voting closed on your civic nomination poster.",
    priority: "important",
  },
  initiative_interest_match: {
    title: "New initiative matches your interests",
    message: "A new initiative matches one of your saved interests.",
    priority: "informational",
  },
  member_badge_contribution_confirmed: {
    title: "Official Member item request confirmed",
    message: "Your official Humanity Union Member item request has been confirmed.",
    priority: "important",
  },
  member_badge_shipped: {
    title: "Official Member item shipped",
    message: "Your official Humanity Union Member item request has shipped.",
    priority: "important",
  },
  member_badge_delivered: {
    title: "Official Member item delivered",
    message: "Your official Humanity Union Member item request was delivered.",
    priority: "informational",
  },
  member_badge_contribution_refunded: {
    title: "Additional Member contribution refunded",
    message: "Your additional Member item contribution was refunded.",
    priority: "important",
  },
  initiative_comment_posted: {
    title: "New initiative comment",
    message: "A new comment was posted on your initiative discussion.",
    priority: "normal",
  },
  initiative_comment_reply: {
    title: "Reply to your comment",
    message: "Someone replied to your comment in an initiative discussion.",
    priority: "normal",
  },
  initiative_collaboration_interest_expressed: {
    title: "New collaboration interest",
    message: "A participant expressed readiness to collaborate on your initiative.",
    priority: "normal",
  },
  initiative_collaboration_interest_accepted: {
    title: "Collaboration request accepted",
    message: "Your collaboration request was accepted. You are now an Ally of this initiative.",
    priority: "normal",
  },
  initiative_collaboration_interest_declined: {
    title: "Collaboration request update",
    message: "Your collaboration request was not accepted at this time.",
    priority: "informational",
  },
  initiative_allies_invitation_received: {
    title: "Allies invitation",
    message: "You were invited to become an Ally on an initiative.",
    priority: "important",
  },
  initiative_allies_invitation_accepted: {
    title: "Allies invitation accepted",
    message: "A participant accepted your Allies invitation.",
    priority: "normal",
  },
  initiative_allies_invitation_declined: {
    title: "Allies invitation declined",
    message: "A participant declined your Allies invitation.",
    priority: "informational",
  },
  direct_message_received: {
    title: "New message",
    message: "You received a new Direct Collaboration message.",
    priority: "normal",
  },
  initiative_collaboration_channel_message_received: {
    title: "New Collaboration Channel message",
    message: "You received a new message in an Initiative Collaboration Channel.",
    priority: "normal",
  },
  initiative_collaboration_channel_system_event: {
    title: "Collaboration Channel update",
    message: "There is a new collaboration update in an Initiative Collaboration Channel.",
    priority: "informational",
  },
  initiative_collaboration_session_created: {
    title: "New Collaboration Session scheduled",
    message: "A new Collaboration Session was scheduled for an Initiative.",
    priority: "important",
  },
  initiative_collaboration_session_updated: {
    title: "Collaboration Session updated",
    message: "A Collaboration Session was edited or rescheduled.",
    priority: "important",
  },
  initiative_collaboration_session_cancelled: {
    title: "Collaboration Session cancelled",
    message: "A Collaboration Session was cancelled.",
    priority: "important",
  },
  initiative_collaboration_session_attendance_changed: {
    title: "Attendance updated",
    message: "An Active Ally updated their attendance for a Collaboration Session.",
    priority: "normal",
  },
  initiative_collaboration_session_upcoming_reminder: {
    title: "Collaboration Session starting soon",
    message: "A Collaboration Session you are part of is starting soon.",
    priority: "important",
  },
  shared_document_uploaded: {
    title: "New document shared",
    message: "A new document was shared in a conversation you are part of.",
    priority: "normal",
  },
  shared_document_replaced: {
    title: "Document replaced",
    message: "A shared document was replaced with a new version.",
    priority: "normal",
  },
  shared_document_removed: {
    title: "Document removed",
    message: "A shared document was removed.",
    priority: "informational",
  },
  /**
   * Initiative Lifecycle Part A Part 15 — never actually used via
   * `getNotificationTemplate` in production: the
   * `initiative-lifecycle-stage` notification consumer always builds
   * dynamic, stage-specific copy with
   * `buildInitiativeLifecycleStageNotificationCopy` (same convention as
   * Collaboration Channel/Session notifications). This entry exists only
   * because `NOTIFICATION_TEMPLATES` is an exhaustive
   * `Record<CivicNotificationEventType, …>`.
   */
  initiative_lifecycle_stage_published: {
    title: "Initiative stage published",
    message: "A lifecycle stage of an Initiative you collaborate on was published.",
    priority: "normal",
  },
  blog_author_application_submitted: {
    title: "Application received",
    message:
      "Your Author application has been received. We will review it and respond as soon as possible.",
    priority: "informational",
  },
  blog_author_application_approved: {
    title: "Author application accepted",
    message:
      "Your Author application has been accepted. You can now use the Author tools in your Workspace.",
    priority: "important",
  },
  blog_author_application_changes_requested: {
    title: "Blog Author application needs changes",
    message: "An Editor requested changes on your Blog Author application.",
    priority: "important",
  },
  blog_author_application_declined: {
    title: "Author application update",
    message: "Your Author application was not accepted at this time.",
    priority: "informational",
  },
  blog_author_application_review_requested: {
    title: "New Author application",
    message: "A Participant submitted an Author application.",
    priority: "important",
  },
  blog_author_access_blocked: {
    title: "Author access blocked",
    message:
      "Your Author access has been blocked. Please contact the administrator.",
    priority: "important",
  },
  blog_author_access_restored: {
    title: "Author access restored",
    message: "Your Author access has been restored. You can use Author tools in your Workspace again.",
    priority: "important",
  },
  blog_author_trusted_publishing_enabled: {
    title: "Trusted Publishing enabled",
    message:
      "An Administrator enabled Publish without manual review for your Author account. Future submissions may publish or schedule directly when eligible.",
    priority: "important",
  },
  blog_author_trusted_publishing_disabled: {
    title: "Trusted Publishing disabled",
    message:
      "An Administrator disabled Publish without manual review for your Author account. Future submissions require editorial review again.",
    priority: "important",
  },
  blog_publication_blocked: {
    title: "Publication unavailable",
    message: "One of your Blog publications is no longer publicly available.",
    priority: "important",
  },
  blog_publication_restored: {
    title: "Publication restored",
    message: "Your Blog publication visibility has been restored according to its publication status.",
    priority: "informational",
  },
  blog_publication_review_requested: {
    title: "Publication submitted for review",
    message: "An Author submitted a publication for review.",
    priority: "important",
  },
  blog_post_changes_requested: {
    title: "Publication returned for changes",
    message: "Changes were requested for your Blog publication. Open Publishing to revise and resubmit.",
    priority: "important",
  },
  blog_post_published: {
    title: "Publication approved",
    message: "Your Blog publication has been approved and published (or scheduled).",
    priority: "important",
  },
  blog_post_declined: {
    title: "Publication not accepted",
    message: "Your Blog publication was not accepted. Open Publishing for details.",
    priority: "informational",
  },
  blog_comment_posted: {
    title: "New comment on your Blog publication",
    message: "A Participant commented on your Blog publication.",
    priority: "informational",
  },
  blog_comment_reply: {
    title: "New reply to your Blog comment",
    message: "A Participant replied to your Blog comment.",
    priority: "informational",
  },
  editor_access_assigned: {
    title: "Editor access assigned",
    message:
      "You can now use the Editor Panel for your assigned editing area and permissions.",
    priority: "important",
  },
  editor_access_activated: {
    title: "Editor access activated",
    message: "Your Editor access has been activated. Open the Editor Panel to continue.",
    priority: "important",
  },
  editor_access_deactivated: {
    title: "Editor access deactivated",
    message: "Your Editor access has been deactivated.",
    priority: "important",
  },
  editor_permissions_updated: {
    title: "Editor permissions updated",
    message: "Your Editor permissions were updated.",
    priority: "normal",
  },
  editor_editing_area_updated: {
    title: "Editor editing area updated",
    message: "Your Editor editing area was updated.",
    priority: "normal",
  },
};

export function getNotificationTemplate(
  eventType: CivicNotificationEventType,
): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[eventType];
}
