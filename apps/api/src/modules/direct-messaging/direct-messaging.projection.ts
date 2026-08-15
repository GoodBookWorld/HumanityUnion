import type {
  DirectConversation,
  DirectConversationDetail,
  DirectConversationParticipantProjection,
  DirectConversationSharedContext,
  DirectConversationSummary,
  DirectMessage,
  DirectMessageProjection,
} from "@hu/types";

import { resolvePublicAuthorsForParticipantIds } from "../initiative-discussion-collaboration/public-participant-identity.projection.js";
import { listWorkspaceAlliesForParticipant } from "../initiative-discussion-collaboration/workspace-allies.service.js";

import { listDirectConversationsForParticipant } from "./persistence/direct-messaging.repository.js";

function otherParticipantId(conversation: DirectConversation, viewerParticipantId: string): string {
  return conversation.participantIds.find((id) => id !== viewerParticipantId) ?? conversation.participantIds[0]!;
}

function isUnreadForViewer(conversation: DirectConversation, viewerParticipantId: string): boolean {
  if (conversation.lastMessageSenderParticipantId === viewerParticipantId) {
    return false;
  }

  if (!conversation.lastMessageSenderParticipantId) {
    return false;
  }

  const readState = conversation.reads.find((entry) => entry.participantId === viewerParticipantId);

  if (!readState || !readState.lastReadAt) {
    return true;
  }

  return readState.lastReadAt < conversation.lastMessageAt;
}

/**
 * Communication UX Pack 03.2 Part 5 — the single batch query behind the
 * Workspace Allies unread marker. Reuses the exact same durable Direct
 * Messaging read state (`conversation.reads` / `lastMessageSenderParticipantId`
 * via `isUnreadForViewer`, identical to `toDirectConversationSummary`'s
 * `unread` field) rather than inventing a second unread definition. One
 * indexed `listDirectConversationsForParticipant` call covers every Ally
 * shown on the Workspace page — never one query per Ally (Part 5/19).
 */
export async function listUnreadDirectMessageSenderParticipantIds(
  viewerParticipantId: string,
): Promise<Set<string>> {
  const conversations = await listDirectConversationsForParticipant(viewerParticipantId);
  const unreadSenderIds = new Set<string>();

  for (const conversation of conversations) {
    if (isUnreadForViewer(conversation, viewerParticipantId)) {
      unreadSenderIds.add(otherParticipantId(conversation, viewerParticipantId));
    }
  }

  return unreadSenderIds;
}

/**
 * Part 14 — contextual-only metadata, computed from the exact same Active
 * Allies relationship the "Active Allies" Privacy policy uses
 * (`areParticipantsActiveAllies`), never a second/new relationship model.
 * `sharedInitiativeCount` counts both directions (Allies-of-viewer +
 * Allies-of-other), since either Participant may steward the shared
 * Initiative.
 */
export async function resolveSharedContext(
  participantIdA: string,
  participantIdB: string,
): Promise<DirectConversationSharedContext | undefined> {
  const [alliesOfA, alliesOfB] = await Promise.all([
    listWorkspaceAlliesForParticipant(participantIdA),
    listWorkspaceAlliesForParticipant(participantIdB),
  ]);

  const fromA = alliesOfA.find((entry) => entry.participantId === participantIdB)?.sharedInitiativeCount ?? 0;
  const fromB = alliesOfB.find((entry) => entry.participantId === participantIdA)?.sharedInitiativeCount ?? 0;
  const sharedInitiativeCount = fromA + fromB;

  if (sharedInitiativeCount === 0) {
    return undefined;
  }

  return { isActiveAlly: true, sharedInitiativeCount };
}

export async function resolveConversationParticipantProjection(
  participantId: string,
): Promise<DirectConversationParticipantProjection> {
  const authors = await resolvePublicAuthorsForParticipantIds([participantId]);
  const author = authors.get(participantId) ?? { displayName: "Participant" };

  return {
    participantId,
    displayName: author.displayName,
    avatarUrl: author.avatarUrl,
    profileUrl: author.profileUrl,
  };
}

export function toDirectMessageProjection(
  message: DirectMessage,
  viewerParticipantId: string,
): DirectMessageProjection {
  return {
    messageId: message.messageId,
    conversationId: message.conversationId,
    senderParticipantId: message.senderParticipantId,
    text: message.text,
    createdAt: message.createdAt,
    isOwnMessage: message.senderParticipantId === viewerParticipantId,
  };
}

export async function toDirectConversationSummary(
  conversation: DirectConversation,
  viewerParticipantId: string,
  options: { includeSharedContext?: boolean } = {},
): Promise<DirectConversationSummary> {
  const otherId = otherParticipantId(conversation, viewerParticipantId);
  const [otherParticipant, sharedContext] = await Promise.all([
    resolveConversationParticipantProjection(otherId),
    options.includeSharedContext === false
      ? Promise.resolve(undefined)
      : resolveSharedContext(viewerParticipantId, otherId),
  ]);

  return {
    conversationId: conversation.conversationId,
    otherParticipant,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    lastMessageSenderParticipantId: conversation.lastMessageSenderParticipantId,
    unread: isUnreadForViewer(conversation, viewerParticipantId),
    sharedContext,
  };
}

export async function toDirectConversationDetail(
  conversation: DirectConversation,
  viewerParticipantId: string,
  page: { messages: DirectMessage[]; hasMoreOlderMessages: boolean },
): Promise<DirectConversationDetail> {
  const otherId = otherParticipantId(conversation, viewerParticipantId);
  const [otherParticipant, sharedContext] = await Promise.all([
    resolveConversationParticipantProjection(otherId),
    resolveSharedContext(viewerParticipantId, otherId),
  ]);

  return {
    conversationId: conversation.conversationId,
    otherParticipant,
    sharedContext,
    messages: page.messages.map((message) => toDirectMessageProjection(message, viewerParticipantId)),
    hasMoreOlderMessages: page.hasMoreOlderMessages,
  };
}