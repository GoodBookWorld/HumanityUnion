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
};

export function getNotificationTemplate(
  eventType: CivicNotificationEventType,
): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[eventType];
}
