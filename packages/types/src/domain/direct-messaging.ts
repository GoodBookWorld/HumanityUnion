/**
 * Profile UX Pack 03 — Direct Collaboration Communication.
 *
 * Canonical field is `participantId` throughout (never `memberId`, even
 * though today `participantId === memberId` at the auth boundary — see
 * `resolveRequestIdentity`). A conversation always has exactly two
 * Participants: no group chat, no public channels, no Initiative team
 * chat. This is a deliberately small, civic-collaboration-scoped domain,
 * not a general messenger.
 */

/** "Who can message me?" — a Member Profile Privacy control (Part 6). */
export type DirectMessagingPolicy = "active_allies" | "registered_participants" | "nobody";

export type DirectConversationStatus = "active";

/**
 * Per-Participant durable read marker (Part 12). Every conversation always
 * has exactly one entry per Participant, created at conversation creation
 * time — this lets "mark read" always be a plain update (never an upsert),
 * which keeps the operation trivially idempotent and race-free.
 */
export interface DirectConversationReadState {
  participantId: string;
  lastReadAt: string | null;
  lastReadMessageId: string | null;
}

/** Authoritative Mongo-backed record for one two-Participant conversation. */
export interface DirectConversation {
  conversationId: string;
  /** Always exactly two entries, sorted ascending — the uniqueness/natural key input (Part 3). */
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
  /** Defaults to `createdAt` until the first message is sent — never `null`, to keep list ordering simple. */
  lastMessageAt: string;
  lastMessageId?: string;
  lastMessageSenderParticipantId?: string;
  /** Short, truncated preview only — never the full message body duplicated without bound. */
  lastMessagePreview?: string;
  status: DirectConversationStatus;
  reads: DirectConversationReadState[];
}

export type DirectMessageStatus = "sent";

/** Authoritative Mongo-backed record for one message inside one conversation. */
export interface DirectMessage {
  messageId: string;
  conversationId: string;
  senderParticipantId: string;
  text: string;
  createdAt: string;
  /** Present only if editing is ever implemented — this pack never sets it. */
  editedAt?: string;
  status: DirectMessageStatus;
  /** Optional client-supplied idempotency key (Part 21 #2) — retried sends with the same key never duplicate. */
  clientMessageId?: string;
}

/** Public-safe identity for the "other" Participant in a conversation (Part 20). */
export interface DirectConversationParticipantProjection {
  participantId: string;
  displayName: string;
  avatarUrl?: string;
  profileUrl?: string;
}

/** Contextual-only Initiative Ally metadata (Part 14) — never a second thread, never authority. */
export interface DirectConversationSharedContext {
  isActiveAlly: boolean;
  sharedInitiativeCount: number;
}

/** One row of the Workspace conversation list (Part 9/20). */
export interface DirectConversationSummary {
  conversationId: string;
  otherParticipant: DirectConversationParticipantProjection;
  lastMessageAt: string;
  lastMessagePreview?: string;
  lastMessageSenderParticipantId?: string;
  /** Durable, per-viewer unread marker — never a detailed read receipt. */
  unread: boolean;
  sharedContext?: DirectConversationSharedContext;
}

export interface DirectConversationListResponse {
  conversations: DirectConversationSummary[];
}

/** One message as projected to a specific viewer (Part 20). */
export interface DirectMessageProjection {
  messageId: string;
  conversationId: string;
  senderParticipantId: string;
  text: string;
  createdAt: string;
  isOwnMessage: boolean;
}

export interface DirectMessageListResponse {
  /** Oldest to newest (Part 10). */
  messages: DirectMessageProjection[];
  hasMoreOlderMessages: boolean;
}

/** Full conversation screen payload: identity + shared context + first bounded page of history. */
export interface DirectConversationDetail {
  conversationId: string;
  otherParticipant: DirectConversationParticipantProjection;
  sharedContext?: DirectConversationSharedContext;
  messages: DirectMessageProjection[];
  hasMoreOlderMessages: boolean;
}
