/**
 * VC-03 — durable 1:1 Call for an existing Direct Conversation.
 *
 * The Call is not a Direct Message and not a Collaboration Session.
 * `participantIds` is an array so a later private conference (max 6) can
 * use the same record shape. This module only ever writes the two
 * Participants loaded from the Direct Conversation.
 */

export type DirectConversationCallContextType = "direct_conversation";

/** Outstanding or established. At most one of these may exist per conversation. */
export type DirectConversationCallLiveStatus = "invited" | "accepted";

/** Finished. These are the only rows eligible for latest-20 history and pruning. */
export type DirectConversationCallTerminalStatus = "declined" | "ended" | "missed";

export type DirectConversationCallStatus =
  | DirectConversationCallLiveStatus
  | DirectConversationCallTerminalStatus;

/**
 * Public call contract. Media, signaling, and credentials are intentionally
 * absent. `durationMs` is derived at read time when both `acceptedAt` and
 * `endedAt` exist; it is not stored.
 */
export interface DirectConversationCall {
  callId: string;
  contextType: DirectConversationCallContextType;
  conversationId: string;
  participantIds: string[];
  initiatorParticipantId: string;
  status: DirectConversationCallStatus;
  createdAt: string;
  updatedAt: string;
  /** Outstanding invitations are not acceptable at or after this instant. */
  expiresAt: string;
  acceptedAt?: string;
  endedAt?: string;
  durationMs?: number;
}

export interface DirectConversationCallConnection {
  token: string;
  url: string;
}

export interface DirectConversationCallCurrentResponse {
  call: DirectConversationCall | null;
}

export interface DirectConversationCallHistoryResponse {
  calls: DirectConversationCall[];
}
