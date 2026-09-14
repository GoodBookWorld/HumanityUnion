/**
 * UX Evolution Pack 02.3 — Complete Discussion Action Visibility and
 * Comment Card Clarity.
 *
 * Pack 02G Task 08C.2 — action/status presentation returns stable label keys;
 * localized display is derived in the Web UI via next-intl.
 */
import type {
  InitiativeAllyStatus,
  PublicCommentAuthor,
  PublicCommentCollaborationState,
  PublicInitiativeDiscussionComment,
} from "@hu/types";

export type DiscussionFilter = "all" | "proposals" | "collaboration";

export const DISCUSSION_FILTER_IDS: readonly DiscussionFilter[] = [
  "all",
  "proposals",
  "collaboration",
];

/** @deprecated Prefer DISCUSSION_FILTER_IDS + localized labels. English fallback for older callers/tests. */
export const DISCUSSION_FILTERS: Array<{ id: DiscussionFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "proposals", label: "Proposals" },
  { id: "collaboration", label: "Collaboration" },
];

const COLLABORATION_FILTER_STATUSES: ReadonlySet<string> = new Set([
  "interest_pending",
  "invitation_pending",
  "active",
]);
const COLLABORATION_FILTER_EXCLUDED_STATUSES: ReadonlySet<string> = new Set([
  "none",
  "declined",
  "withdrawn",
  "removed",
]);

export type DiscussionChromeLabelKey =
  | "proposal"
  | "proposalAdded"
  | "proposalAddedChecked"
  | "marking"
  | "readyToCollaborate"
  | "recording"
  | "invitationPending"
  | "ally"
  | "inviteToAllies"
  | "inviting"
  | "invitationSent"
  | "invitationDeclined"
  | "requestClosed"
  | "helpful"
  | "notHelpful"
  | "filterHeadingProposals"
  | "filterHeadingCollaboration";

/** English reference map — tests and non-intl fallbacks only. */
export const DISCUSSION_CHROME_LABELS_EN: Record<DiscussionChromeLabelKey, string> = {
  proposal: "Proposal",
  proposalAdded: "Proposal Added",
  proposalAddedChecked: "✓ Proposal Added",
  marking: "Marking…",
  readyToCollaborate: "Ready to Collaborate",
  recording: "Recording…",
  invitationPending: "Invitation Pending",
  ally: "Ally",
  inviteToAllies: "Invite to Allies",
  inviting: "Inviting…",
  invitationSent: "Invitation Sent",
  invitationDeclined: "Invitation Declined",
  requestClosed: "Request closed",
  helpful: "Helpful",
  notHelpful: "Not Helpful",
  filterHeadingProposals: "Improvement ideas selected from the discussion.",
  filterHeadingCollaboration: "Participants interested in helping this Initiative.",
};

export function resolveDiscussionChromeLabel(key: DiscussionChromeLabelKey): string {
  return DISCUSSION_CHROME_LABELS_EN[key];
}

export function matchesDiscussionFilter(
  comment: PublicInitiativeDiscussionComment,
  filter: DiscussionFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "proposals") {
    return comment.collaboration?.proposalCandidateStatus === "candidate";
  }

  const status = comment.collaboration?.authorAllyStatus;

  if (!status || COLLABORATION_FILTER_EXCLUDED_STATUSES.has(status)) {
    return false;
  }

  return COLLABORATION_FILTER_STATUSES.has(status);
}

/** Part 8 — heading key shown above the filtered list for working-list filters. */
export function resolveFilterHeadingKey(filter: DiscussionFilter): DiscussionChromeLabelKey | null {
  if (filter === "proposals") {
    return "filterHeadingProposals";
  }

  if (filter === "collaboration") {
    return "filterHeadingCollaboration";
  }

  return null;
}

/** @deprecated Prefer resolveFilterHeadingKey + localized labels. */
export function resolveFilterHeading(filter: DiscussionFilter): string | null {
  const key = resolveFilterHeadingKey(filter);
  return key ? resolveDiscussionChromeLabel(key) : null;
}

export function resolveCollaborationStatusLabelKey(
  status: InitiativeAllyStatus,
): DiscussionChromeLabelKey {
  switch (status) {
    case "interest_pending":
      return "readyToCollaborate";
    case "invitation_pending":
      return "invitationSent";
    case "active":
      return "ally";
    case "declined":
      return "requestClosed";
    default:
      return "readyToCollaborate";
  }
}

/** @deprecated Prefer resolveCollaborationStatusLabelKey + localized labels. */
export function resolveCollaborationStatusLabel(status: InitiativeAllyStatus): string {
  return resolveDiscussionChromeLabel(resolveCollaborationStatusLabelKey(status));
}

export interface CollaborationReviewActionState {
  visible: boolean;
  disabled: boolean;
}

export function resolveCollaborationReviewActionState(
  status: InitiativeAllyStatus,
  isViewerInitiativeSteward: boolean,
  busy: boolean,
): CollaborationReviewActionState {
  if (!isViewerInitiativeSteward || status !== "interest_pending") {
    return { visible: false, disabled: true };
  }

  return { visible: true, disabled: busy };
}

export interface CollaborationInvitationAcceptActionState {
  visible: boolean;
  disabled: boolean;
}

export function resolveCollaborationInvitationAcceptState(input: {
  status: InitiativeAllyStatus;
  isOwnRow: boolean;
  isViewerInitiativeSteward: boolean;
  busy: boolean;
}): CollaborationInvitationAcceptActionState {
  if (input.isViewerInitiativeSteward || !input.isOwnRow) {
    return { visible: false, disabled: true };
  }

  if (input.status !== "invitation_pending") {
    return { visible: false, disabled: true };
  }

  return { visible: true, disabled: input.busy };
}

export interface AuthorLinkPresentation {
  isLink: boolean;
  href?: string;
}

export function resolveAuthorLinkPresentation(author: PublicCommentAuthor): AuthorLinkPresentation {
  if (author.profileUrl) {
    return { isLink: true, href: author.profileUrl };
  }

  return { isLink: false };
}

export interface CommentAuthorBadges {
  isInitiativeAuthor: boolean;
  isYou: boolean;
}

export function resolveAuthorBadges(
  collaboration: PublicCommentCollaborationState | undefined,
): CommentAuthorBadges {
  return {
    isInitiativeAuthor: Boolean(collaboration?.isAuthorInitiativeSteward),
    isYou: Boolean(collaboration?.isViewerAuthor),
  };
}

export interface CommentActionButtonState {
  visible: boolean;
  disabled: boolean;
  labelKey: DiscussionChromeLabelKey;
}

export function resolveProposalActionState(
  collaboration: PublicCommentCollaborationState | undefined,
  busy: boolean,
): CommentActionButtonState {
  if (!collaboration) {
    return { visible: false, disabled: true, labelKey: "proposal" };
  }

  if (collaboration.proposalCandidateStatus === "candidate") {
    return { visible: true, disabled: true, labelKey: "proposalAddedChecked" };
  }

  if (!collaboration.canMarkProposal) {
    return { visible: false, disabled: true, labelKey: "proposal" };
  }

  return { visible: true, disabled: busy, labelKey: busy ? "marking" : "proposal" };
}

export function resolveReadyToCollaborateActionState(
  collaboration: PublicCommentCollaborationState | undefined,
  busy: boolean,
): CommentActionButtonState {
  if (!collaboration) {
    return { visible: false, disabled: true, labelKey: "readyToCollaborate" };
  }

  if (collaboration.isViewerInitiativeSteward) {
    return { visible: false, disabled: true, labelKey: "readyToCollaborate" };
  }

  switch (collaboration.viewerAllyStatus) {
    case "interest_pending":
      return { visible: true, disabled: true, labelKey: "readyToCollaborate" };
    case "invitation_pending":
      return { visible: false, disabled: true, labelKey: "invitationPending" };
    case "active":
      return { visible: true, disabled: true, labelKey: "ally" };
    default:
      break;
  }

  if (!collaboration.canReadyToCollaborate) {
    return { visible: false, disabled: true, labelKey: "readyToCollaborate" };
  }

  return {
    visible: true,
    disabled: busy,
    labelKey: busy ? "recording" : "readyToCollaborate",
  };
}

export interface AlliesInvitationResponseActionState {
  visible: boolean;
  disabled: boolean;
}

export function resolveAlliesInvitationResponseState(
  collaboration: PublicCommentCollaborationState | undefined,
  busy: boolean,
): AlliesInvitationResponseActionState {
  if (!collaboration || collaboration.isViewerInitiativeSteward) {
    return { visible: false, disabled: true };
  }

  if (collaboration.viewerAllyStatus !== "invitation_pending") {
    return { visible: false, disabled: true };
  }

  return { visible: true, disabled: busy };
}

export function resolveInviteToAlliesActionState(
  collaboration: PublicCommentCollaborationState | undefined,
  busy: boolean,
): CommentActionButtonState {
  if (!collaboration) {
    return { visible: false, disabled: true, labelKey: "inviteToAllies" };
  }

  if (!collaboration.isViewerInitiativeSteward || collaboration.isViewerAuthor) {
    return { visible: false, disabled: true, labelKey: "inviteToAllies" };
  }

  switch (collaboration.authorAllyStatus) {
    case "invitation_pending":
      return { visible: true, disabled: true, labelKey: "invitationSent" };
    case "active":
      return { visible: true, disabled: true, labelKey: "ally" };
    case "interest_pending":
      return {
        visible: true,
        disabled: busy,
        labelKey: busy ? "inviting" : "inviteToAllies",
      };
    default:
      return { visible: false, disabled: true, labelKey: "inviteToAllies" };
  }
}

export function resolveStatusIndicatorKeys(
  collaboration: PublicCommentCollaborationState | undefined,
): DiscussionChromeLabelKey[] {
  if (!collaboration) {
    return [];
  }

  const indicators: DiscussionChromeLabelKey[] = [];

  if (collaboration.proposalCandidateStatus === "candidate") {
    indicators.push("proposalAdded");
  }

  switch (collaboration.authorAllyStatus) {
    case "interest_pending":
      indicators.push("readyToCollaborate");
      break;
    case "invitation_pending":
      indicators.push("invitationSent");
      break;
    case "active":
      indicators.push("ally");
      break;
    case "declined":
      indicators.push("invitationDeclined");
      break;
    default:
      break;
  }

  return indicators;
}

/** @deprecated Prefer resolveStatusIndicatorKeys + localized labels. */
export function resolveStatusIndicators(
  collaboration: PublicCommentCollaborationState | undefined,
): string[] {
  return resolveStatusIndicatorKeys(collaboration).map(resolveDiscussionChromeLabel);
}

export type DiscussionActionId =
  | "helpful"
  | "not-helpful"
  | "proposal"
  | "ready-to-collaborate"
  | "invite-to-allies";

export interface DiscussionActionDefinition {
  id: DiscussionActionId;
  labelKey: DiscussionChromeLabelKey;
  icon: string;
}

export const DISCUSSION_ACTION_DEFINITIONS: readonly DiscussionActionDefinition[] = [
  { id: "helpful", labelKey: "helpful", icon: "/icons/workspace/like.svg" },
  { id: "not-helpful", labelKey: "notHelpful", icon: "/icons/workspace/dislike.svg" },
  { id: "proposal", labelKey: "proposal", icon: "/icons/workspace/initiatives.svg" },
  {
    id: "ready-to-collaborate",
    labelKey: "readyToCollaborate",
    icon: "/icons/workspace/collective-decisions.svg",
  },
  { id: "invite-to-allies", labelKey: "inviteToAllies", icon: "/icons/workspace/participation.svg" },
];
