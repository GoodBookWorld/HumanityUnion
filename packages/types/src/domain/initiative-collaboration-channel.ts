/**
 * Communication UX Pack 03.5 — Initiative Collaboration Channel.
 *
 * Each Initiative owns exactly one persistent, text-only Collaboration
 * Channel (Part 1/9): never split by lifecycle stage, never recreated
 * between stages, and completely independent from Personal Direct
 * Messaging (Part 1) — a different domain entity, a different persistence
 * boundary, a different authorization rule (Part 2: Author + Active
 * Allies only, never guests, never non-Allies, never publicly visible).
 *
 * The read-state *concept* is borrowed from Direct Messaging (Part 6:
 * "reuse ... where appropriate. Do not duplicate logic.") — a per-viewer
 * last-read marker compared against the channel's most recent message —
 * but is not the same persisted shape, because a Direct Conversation has a
 * fixed pair of Participants while a Collaboration Channel's membership
 * (Active Allies) changes over the Initiative's lifetime.
 */

export type InitiativeCollaborationChannelMessageType = "participant_message" | "system_event";

/**
 * Reserved, closed set of system-event kinds (Part 5/10). Only
 * `ally_joined` has a real producer in this pack (Part 12); the rest are
 * clean extension points for future packs (Collaboration Sessions,
 * Petition, Collective Decision) to post into this same channel without
 * inventing a new message type or a new authorization/read-state model.
 */
export type InitiativeCollaborationSystemEventKind =
  | "ally_joined"
  | "collaboration_accepted"
  | "session_scheduled"
  | "petition_published"
  | "collective_decision_updated";

/** Durable record — never exposed directly to the frontend (see the *View projection below). */
export interface InitiativeCollaborationChannelMessage {
  messageId: string;
  initiativeId: string;
  type: InitiativeCollaborationChannelMessageType;
  /** Present only for `type: "participant_message"`. */
  senderParticipantId?: string;
  /** Present only for `type: "system_event"`. */
  systemEventKind?: InitiativeCollaborationSystemEventKind;
  text: string;
  createdAt: string;
}

export interface InitiativeCollaborationChannelMessageSender {
  participantId: string;
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
  role: "author" | "ally";
}

/**
 * Channel-member-safe projection returned to the frontend. `sender` is
 * present only for `type: "participant_message"`; a `system_event` never
 * carries a Participant identity (Part 5 — "visually distinct").
 */
export interface InitiativeCollaborationChannelMessageView {
  messageId: string;
  type: InitiativeCollaborationChannelMessageType;
  sender?: InitiativeCollaborationChannelMessageSender;
  systemEventKind?: InitiativeCollaborationSystemEventKind;
  text: string;
  createdAt: string;
  /** Drives the "own message" bubble alignment; always `false` for a system event. */
  isOwnMessage: boolean;
}

export interface InitiativeCollaborationChannelHistoryResult {
  initiativeId: string;
  messages: InitiativeCollaborationChannelMessageView[];
  hasMoreOlderMessages: boolean;
}

/** Part 6 — per-viewer last-read marker (the "concept" borrowed from Direct Messaging read state). */
export interface InitiativeCollaborationChannelReadState {
  initiativeId: string;
  participantId: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
}

/**
 * Header + unread summary for the Channel panel (Part 4/6/8) — everything
 * the sidebar-swap decision and the Channel header need, sourced entirely
 * from data this widget already resolves once (never a second Active
 * Allies read, Part 13).
 */
export interface InitiativeCollaborationChannelSummary {
  initiativeId: string;
  initiativeTitle: string;
  /** Author + active Allies (Part 4 "Participant count") — never includes guests/non-Allies. */
  participantCount: number;
  unreadCount: number;
  viewerRole: "author" | "active_ally";
}
