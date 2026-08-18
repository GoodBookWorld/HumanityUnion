/**
 * UX Evolution Pack 02.3 — Complete Discussion Action Visibility and
 * Comment Card Clarity.
 *
 * Pure, framework-free presentation logic for the Discussion comment card:
 * which controls are visible, which are disabled/"completed", which label
 * and status indicators to show, and how the discussion filters behave.
 *
 * Extracted out of `PublicDiscussionPanel.tsx` / `CommentActions` so this
 * decision logic — the actual source of the "missing button" and "hidden
 * completed state" bugs this pack fixes — can be unit tested directly with
 * Node's built-in test runner (the same tool already used across
 * `apps/api`), without introducing a new frontend test framework.
 *
 * These functions never grant an ability the backend does not already
 * allow: every flag they branch on (`canMarkProposal`,
 * `canReadyToCollaborate`, `canInviteToAllies`, `viewerAllyStatus`,
 * `authorAllyStatus`, `isViewerInitiativeSteward`, `isViewerAuthor`) is
 * computed server-side by `attachCollaborationStateToComments`. This module
 * only decides *how to render* that already-authorized state.
 */
import type {
  InitiativeAllyStatus,
  PublicCommentAuthor,
  PublicCommentCollaborationState,
  PublicInitiativeDiscussionComment,
} from "@hu/types";

export type DiscussionFilter = "all" | "proposals" | "collaboration";

export const DISCUSSION_FILTERS: Array<{ id: DiscussionFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "proposals", label: "Proposals" },
  { id: "collaboration", label: "Collaboration" },
];

/**
 * Part 8 — "Collaboration" is a working list of participants who are
 * currently interested in, invited to, or already part of the Initiative
 * team. `none` (never expressed interest) and `declined` (opted out) are
 * intentionally excluded, per spec. `withdrawn` / `removed` do not exist as
 * persisted statuses today (see `InitiativeAllyStatus`); they are named
 * defensively so this set stays correct if such statuses are ever added
 * without anyone having to remember to update this file.
 */
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

/** Part 8 — heading shown above the filtered list for the two working-list filters. */
export function resolveFilterHeading(filter: DiscussionFilter): string | null {
  if (filter === "proposals") {
    return "Improvement ideas selected from the discussion.";
  }

  if (filter === "collaboration") {
    return "Participants interested in helping this Initiative.";
  }

  return null;
}

/**
 * Part 7 — Profile UX Pack 01 Part 2/8 status labels shown on each
 * Collaboration working-list entry. Never the raw internal status value.
 */
export function resolveCollaborationStatusLabel(status: InitiativeAllyStatus): string {
  switch (status) {
    case "interest_pending":
      return "Ready to Collaborate";
    case "invitation_pending":
      return "Invitation Sent";
    case "active":
      return "Ally";
    case "declined":
      return "Request closed";
    default:
      return "Ready to Collaborate";
  }
}

export interface CollaborationReviewActionState {
  /** Whether Accept/Decline should render for this entry at all. */
  visible: boolean;
  /** Whether the rendered controls are non-interactive (an action is in flight). */
  disabled: boolean;
}

/**
 * Profile UX Pack 01 Parts 2/5/6/7 — the Initiative Author may Accept or
 * Decline only a request still `interest_pending`, and only when they are
 * this Initiative's steward. `invitation_pending` (the reverse,
 * steward-initiated invite flow) is intentionally excluded here — that
 * direction is reviewed by the invited Participant, not the steward.
 */
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

export interface AuthorLinkPresentation {
  isLink: boolean;
  href?: string;
}

/**
 * Part 2 — the author name is a link only when the backend resolved a
 * `profileUrl` (active profile, public visibility). Never invents a route;
 * never renders a broken link.
 */
export function resolveAuthorLinkPresentation(author: PublicCommentAuthor): AuthorLinkPresentation {
  if (author.profileUrl) {
    return { isLink: true, href: author.profileUrl };
  }

  return { isLink: false };
}

export interface CommentAuthorBadges {
  /** Part 5 — the comment's author is this Initiative's steward. */
  isInitiativeAuthor: boolean;
  /** Part 5 — the comment's author is the signed-in viewer. */
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
  /** Whether the control should be rendered at all. */
  visible: boolean;
  /** Whether the rendered control is non-interactive (muted/"completed"). */
  disabled: boolean;
  label: string;
}

/**
 * UX Evolution Pack 02.4 Part 5 — user-facing wording only. The internal
 * domain/type name (`InitiativeDiscussionProposalCandidate`,
 * `proposalCandidateStatus: "candidate"`, the Mongo collection, etc.) is
 * unchanged; only what a Participant reads on screen changes from the
 * internal-sounding "Proposal Candidate" to "Proposal Added".
 */
const PROPOSAL_ADDED_LABEL = "Proposal Added";

/**
 * Part 7 — Proposal. Once a Proposal Candidate already exists for this
 * comment, the control stays visible in a muted, disabled "✓ Proposal
 * Added" state rather than disappearing.
 */
export function resolveProposalActionState(
  collaboration: PublicCommentCollaborationState | undefined,
  busy: boolean,
): CommentActionButtonState {
  if (!collaboration) {
    return { visible: false, disabled: true, label: "Proposal" };
  }

  if (collaboration.proposalCandidateStatus === "candidate") {
    return { visible: true, disabled: true, label: `✓ ${PROPOSAL_ADDED_LABEL}` };
  }

  if (!collaboration.canMarkProposal) {
    return { visible: false, disabled: true, label: "Proposal" };
  }

  return { visible: true, disabled: busy, label: busy ? "Marking…" : "Proposal" };
}

/**
 * Part 7 — Ready to Collaborate. Reflects the VIEWER's own Ally status
 * (this action always targets `(initiativeId, viewer)`, never the
 * comment's author), so its completed-state label is the same for every
 * comment in a given response.
 *
 * Initiative Authors/stewards never see this control (server also rejects
 * self-interest). Invited Participants use Accept/Decline instead
 * (`resolveAlliesInvitationResponseState`).
 */
export function resolveReadyToCollaborateActionState(
  collaboration: PublicCommentCollaborationState | undefined,
  busy: boolean,
): CommentActionButtonState {
  if (!collaboration) {
    return { visible: false, disabled: true, label: "Ready to Collaborate" };
  }

  if (collaboration.isViewerInitiativeSteward) {
    return { visible: false, disabled: true, label: "Ready to Collaborate" };
  }

  switch (collaboration.viewerAllyStatus) {
    case "interest_pending":
      return { visible: true, disabled: true, label: "Ready to Collaborate" };
    case "invitation_pending":
      // Accept/Decline are rendered by resolveAlliesInvitationResponseState.
      return { visible: false, disabled: true, label: "Invitation Pending" };
    case "active":
      return { visible: true, disabled: true, label: "Ally" };
    default:
      break;
  }

  if (!collaboration.canReadyToCollaborate) {
    return { visible: false, disabled: true, label: "Ready to Collaborate" };
  }

  return { visible: true, disabled: busy, label: busy ? "Recording…" : "Ready to Collaborate" };
}

export interface AlliesInvitationResponseActionState {
  visible: boolean;
  disabled: boolean;
}

/**
 * Invited Participant responds to a steward-initiated Allies invitation
 * (`invitation_pending` on the viewer's own Ally row). Reuses the canonical
 * `respondToAlliesInvitation` API — no second model.
 */
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

/**
 * Part 7 — Invite to Allies. Visible to the Initiative steward only, and
 * only once the author has expressed interest (or later, for the completed
 * states) — never for the steward's own comments (self-invite impossible).
 */
export function resolveInviteToAlliesActionState(
  collaboration: PublicCommentCollaborationState | undefined,
  busy: boolean,
): CommentActionButtonState {
  if (!collaboration) {
    return { visible: false, disabled: true, label: "Invite to Allies" };
  }

  if (!collaboration.isViewerInitiativeSteward || collaboration.isViewerAuthor) {
    return { visible: false, disabled: true, label: "Invite to Allies" };
  }

  switch (collaboration.authorAllyStatus) {
    case "invitation_pending":
      return { visible: true, disabled: true, label: "Invitation Sent" };
    case "active":
      return { visible: true, disabled: true, label: "Ally" };
    case "interest_pending":
      return { visible: true, disabled: busy, label: busy ? "Inviting…" : "Invite to Allies" };
    default:
      // "none" (author never expressed interest) or "declined": nothing to
      // invite yet — keep hidden rather than guessing re-invite semantics
      // that neither Pack 02 nor 02.3 specifies.
      return { visible: false, disabled: true, label: "Invite to Allies" };
  }
}

/**
 * Part 9 — status indicators shown between the comment body and the action
 * row. Only ever reflects real persisted state; never a raw status value.
 */
export function resolveStatusIndicators(
  collaboration: PublicCommentCollaborationState | undefined,
): string[] {
  if (!collaboration) {
    return [];
  }

  const indicators: string[] = [];

  if (collaboration.proposalCandidateStatus === "candidate") {
    indicators.push(PROPOSAL_ADDED_LABEL);
  }

  switch (collaboration.authorAllyStatus) {
    case "interest_pending":
      indicators.push("Ready to Collaborate");
      break;
    case "invitation_pending":
      indicators.push("Invitation Sent");
      break;
    case "active":
      indicators.push("Ally");
      break;
    case "declined":
      indicators.push("Invitation Declined");
      break;
    default:
      break;
  }

  return indicators;
}

export type DiscussionActionId =
  | "helpful"
  | "not-helpful"
  | "proposal"
  | "ready-to-collaborate"
  | "invite-to-allies";

export interface DiscussionActionDefinition {
  id: DiscussionActionId;
  label: string;
  icon: string;
}

/**
 * Part 6 — the required action row order and icon paths, defined once so
 * both the rendered component and its tests read from the same source of
 * truth instead of two copies that could silently drift apart.
 */
export const DISCUSSION_ACTION_DEFINITIONS: readonly DiscussionActionDefinition[] = [
  { id: "helpful", label: "Helpful", icon: "/icons/workspace/like.svg" },
  { id: "not-helpful", label: "Not Helpful", icon: "/icons/workspace/dislike.svg" },
  { id: "proposal", label: "Proposal", icon: "/icons/workspace/initiatives.svg" },
  {
    id: "ready-to-collaborate",
    label: "Ready to Collaborate",
    icon: "/icons/workspace/collective-decisions.svg",
  },
  { id: "invite-to-allies", label: "Invite to Allies", icon: "/icons/workspace/participation.svg" },
];
