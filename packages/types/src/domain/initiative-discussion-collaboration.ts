/**
 * UX Evolution Pack 02 — Discussion Collaboration Foundation.
 *
 * "Allies" are Initiative-scoped collaboration relationships: a Participant
 * collaborating on ONE specific Initiative. An Ally is not a friend, a
 * follower, a general social contact, or automatically an Ally on any other
 * Initiative. The Initiative author/steward is distinct from an Ally even
 * when also collaborating in the working group.
 *
 * A single mutable-status row exists per (initiativeId, participantId) pair
 * — this is what gives the module its "one current Ally relationship per
 * Initiative + Participant" uniqueness rule for free, without a separate
 * dedupe step: expressing interest, inviting, accepting, and declining are
 * all status transitions on that one row, not separate records.
 */
import type { PublicCommentAuthor } from "./initiative-comment.js";

export type InitiativeAllyStatus =
  | "interest_pending"
  | "invitation_pending"
  | "active"
  | "declined";

export interface InitiativeAlly {
  initiativeId: string;
  participantId: string;
  status: InitiativeAllyStatus;
  requestedByParticipantId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Narrow boundary introduced because a Discussion comment has no
 * Collaborative Analysis ancestor while `initiative-improvement-proposal`
 * requires one (mandatory `analysisId`). A Proposal Candidate preserves the
 * comment's provenance without weakening or duplicating that contract; see
 * UX Evolution Pack 02 Part 6.
 */
export interface InitiativeDiscussionProposalCandidate {
  candidateId: string;
  initiativeId: string;
  sourceCommentId: string;
  /** Participant identity of the comment's author at candidate creation time. */
  sourceParticipantId: string;
  /** Participant who clicked "Proposal" (usually, but not necessarily, the author). */
  creatorParticipantId: string;
  /** Snapshot of the comment body at candidate creation time. */
  commentText: string;
  status: "candidate";
  createdAt: string;
}

export type PublicCommentProposalCandidateStatus = "none" | "candidate";

/** Per-comment collaboration state and viewer-scoped permission flags. */
export interface PublicCommentCollaborationState {
  proposalCandidateStatus: PublicCommentProposalCandidateStatus;
  /** Current Initiative-scoped Ally status of the COMMENT AUTHOR, not the viewer. */
  authorAllyStatus: InitiativeAllyStatus | "none";
  /**
   * UX Evolution Pack 02.3 — current Initiative-scoped Ally status of the
   * VIEWER (not the comment author). "Ready to Collaborate" is an
   * Initiative-scoped action, not a comment-scoped one, so this is the same
   * value for every comment in a given response; it is carried per-comment
   * (rather than as a top-level field) so the completed/disabled "Ready to
   * Collaborate" / "Invitation Pending" / "Ally" state can be rendered next
   * to any comment's action row without extra plumbing.
   */
  viewerAllyStatus: InitiativeAllyStatus | "none";
  /** True when the comment's author is this Initiative's steward. Drives the "Initiative Author" badge. */
  isAuthorInitiativeSteward: boolean;
  /** True when the comment's author is the current viewer. Drives the "You" badge. */
  isViewerAuthor: boolean;
  /**
   * True when the current viewer is this Initiative's steward. Needed
   * because `canInviteToAllies` is deliberately false once an invitation is
   * already pending/accepted — this flag lets the UI keep showing (in a
   * muted, disabled state) the "Invite to Allies" row for the steward even
   * when the action itself is no longer available.
   */
  isViewerInitiativeSteward: boolean;
  canMarkProposal: boolean;
  canReadyToCollaborate: boolean;
  canInviteToAllies: boolean;
  /**
   * UX Evolution Pack 02.4 Part 7 — the comment author's stable
   * Initiative-scoped Participant identity. Needed by the frontend
   * Collaboration filter to deduplicate one entry per real Participant
   * (uniqueness key `initiativeId + participantId`) even when that
   * Participant has posted several comments; `null` only when the author
   * could not be resolved to a Participant identity at all.
   */
  authorParticipantId: string | null;
}

/**
 * Profile UX Pack 01 — one compact, review-ready entry for the Initiative
 * Author's Collaboration working list. Sourced directly from the
 * `InitiativeAlly` store (not derived from Discussion comments), so a
 * Participant who expressed interest without ever posting a comment still
 * appears exactly once — deduplication key `initiativeId + participantId`.
 * Never carries private identity fields or full comment content.
 */
export interface PublicInitiativeCollaborationParticipant {
  participantId: string;
  status: InitiativeAllyStatus;
  author: PublicCommentAuthor;
}

/** Response shape for the Collaboration working-list read (Part 2 / Part 8). */
export interface PublicInitiativeCollaborationParticipantsResult {
  participants: PublicInitiativeCollaborationParticipant[];
  isViewerInitiativeSteward: boolean;
  /**
   * Authenticated viewer's participant id when known — used so an invited
   * Participant can Accept on their own `invitation_pending` row. Null for
   * guests. Never used as progression authority.
   */
  viewerParticipantId: string | null;
}

/**
 * Communication UX Pack 03.3 — one row in the Initiative "Active Allies"
 * widget (the Initiative Author or an active Ally). Identity fields
 * (`displayName`/`avatarUrl`/`profileUrl`) are always public-safe (Part 2),
 * sourced from the same projection used for Discussion comment authors.
 * `participantId`, `canMessage`, and `hasUnreadMessages` are
 * authenticated-viewer-scoped (Part 20) and are omitted entirely (rather
 * than `false`) for a guest viewer, so a public response can never leak
 * viewer-specific state into a shared/public cache.
 */
export interface InitiativeActiveAllyEntry {
  /**
   * Only present for an authenticated viewer — required by the frontend
   * Message action to open/create a Direct Conversation (Part 2/20). Never
   * sent to a guest.
   */
  participantId?: string;
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
  role: "author" | "ally";
  /**
   * Authenticated-viewer-scoped: whether the viewer is currently allowed to
   * open a new Direct Conversation with this Participant, computed by the
   * exact same `isNewDirectConversationAllowed` authority the write path
   * uses (Part 12). Omitted for guests (no Message action is ever shown).
   */
  canMessage?: boolean;
  /**
   * Authenticated-viewer-scoped: whether the viewer has unread Direct
   * Messages from this Participant, sourced from the same durable Direct
   * Messaging read state as the Workspace Allies widget (Part 13). Omitted
   * for guests.
   */
  hasUnreadMessages?: boolean;
}

/**
 * Communication UX Pack 03.3 Part 2 — the Initiative Active Allies widget's
 * one public-safe, batch-resolved projection: the Initiative Author plus
 * every `active` Ally for this one Initiative, ordered Author-first
 * (Part 4). `activeAlliesCount` never includes the Author (Part 16).
 * `viewerRole` and `canViewTeam` are always present (safe for guests);
 * per-entry `participantId`/`canMessage`/`hasUnreadMessages` are the only
 * authenticated-only fields (Part 20).
 */
export interface InitiativeActiveAlliesProjection {
  initiativeId: string;
  author: InitiativeActiveAllyEntry;
  allies: InitiativeActiveAllyEntry[];
  activeAlliesCount: number;
  viewerRole: "guest" | "author" | "active_ally" | "participant";
  canViewTeam: boolean;
}
