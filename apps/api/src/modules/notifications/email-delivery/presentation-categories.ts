/**
 * HU-NOTIF-02C.3 — fixed presentation categories for allowlisted events.
 * Unknown / private events fail closed (null).
 */

import type { CivicNotificationEventType } from "@hu/types";

import { isMemberNotificationEmailEventAllowlisted } from "./allowlist.js";

export type MemberNotificationEmailPresentationCategory =
  | "civic_initiative_update"
  | "decision_petition_update"
  | "contribution_status"
  | "author_publication_status"
  | "collaboration_invitation"
  | "civic_accountability_update"
  | "nomination_update";

const EVENT_TO_CATEGORY: Partial<
  Record<CivicNotificationEventType, MemberNotificationEmailPresentationCategory>
> = {
  initiative_published: "civic_initiative_update",
  initiative_interest_match: "civic_initiative_update",
  analysis_published: "civic_initiative_update",
  proposal_submitted: "civic_initiative_update",
  proposal_decided: "civic_initiative_update",
  revision_published: "civic_initiative_update",
  commitment_published: "civic_initiative_update",
  implementation_commitment_proposed: "civic_initiative_update",
  implementation_commitment_taken: "civic_initiative_update",
  tracking_updated: "civic_initiative_update",
  impact_verified: "civic_initiative_update",
  archive_published: "civic_initiative_update",
  initiative_lifecycle_stage_published: "civic_initiative_update",
  initiative_comment_posted: "civic_initiative_update",
  initiative_comment_reply: "civic_initiative_update",

  decision_opened: "decision_petition_update",
  decision_closed: "decision_petition_update",
  civic_action_package_issued: "decision_petition_update",
  official_response_received: "decision_petition_update",
  official_response_verified: "decision_petition_update",

  civic_accountability_event_added: "civic_accountability_update",
  civic_accountability_closed: "civic_accountability_update",

  civic_nomination_published: "nomination_update",
  civic_nomination_voting_opened: "nomination_update",
  civic_nomination_voting_closed: "nomination_update",

  member_badge_contribution_confirmed: "contribution_status",
  member_badge_shipped: "contribution_status",
  member_badge_delivered: "contribution_status",
  member_badge_contribution_refunded: "contribution_status",

  blog_author_application_approved: "author_publication_status",
  blog_author_application_changes_requested: "author_publication_status",
  blog_author_application_declined: "author_publication_status",
  blog_author_access_blocked: "author_publication_status",
  blog_author_access_restored: "author_publication_status",
  blog_author_trusted_publishing_enabled: "author_publication_status",
  blog_author_trusted_publishing_disabled: "author_publication_status",
  blog_publication_blocked: "author_publication_status",
  blog_publication_restored: "author_publication_status",
  blog_post_changes_requested: "author_publication_status",
  blog_post_published: "author_publication_status",
  blog_post_declined: "author_publication_status",

  initiative_collaboration_interest_expressed: "collaboration_invitation",
  initiative_collaboration_interest_accepted: "collaboration_invitation",
  initiative_collaboration_interest_declined: "collaboration_invitation",
  initiative_allies_invitation_received: "collaboration_invitation",
  initiative_allies_invitation_accepted: "collaboration_invitation",
  initiative_allies_invitation_declined: "collaboration_invitation",
};

export function resolveMemberNotificationEmailPresentationCategory(
  eventType: string,
): MemberNotificationEmailPresentationCategory | null {
  if (!isMemberNotificationEmailEventAllowlisted(eventType as CivicNotificationEventType)) {
    return null;
  }
  return EVENT_TO_CATEGORY[eventType as CivicNotificationEventType] ?? null;
}
