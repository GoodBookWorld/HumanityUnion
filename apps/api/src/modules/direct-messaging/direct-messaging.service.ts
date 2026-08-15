import { randomUUID } from "node:crypto";

import type {
  DirectConversation,
  DirectConversationDetail,
  DirectConversationListResponse,
  DirectMessageListResponse,
  DirectMessageProjection,
  DirectMessagingPolicy,
} from "@hu/types";

/**
 * Profile UX Pack 03 — Direct Collaboration Communication.
 *
 * Scope boundary (Part 24, restated here for anyone extending this
 * module): exactly two Participants per conversation, no group chat, no
 * public channels, no Initiative team chat, no typing indicators/presence/
 * detailed read receipts beyond a single durable per-Participant "read"
 * marker, no attachments (Part 16 — no production-safe generic attachment
 * pipeline exists yet; see "Profile UX Pack 03.1 — Secure Communication
 * Attachments Foundation" in the final report), and no realtime transport
 * (Part 18 — bounded polling only, documented in the Workspace
 * conversation view).
 */

import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import {
  findMemberProfileByPublicName,
  findMemberProfileByUserId,
} from "../member-profile/member-profile.repository.js";
import { runMongoTransaction } from "../../infrastructure/mongodb/mongo-transaction.js";
import {
  isNewDirectConversationAllowed,
  isSendIntoExistingConversationAllowed,
} from "./direct-messaging-eligibility.js";
import {
  emitDirectMessageNotification,
  markDirectMessageNotificationsRead,
} from "./direct-messaging-notifications.js";
import {
  DirectMessagingAccessDeniedError,
  DirectMessagingBlockedError,
  DirectMessagingConversationNotFoundError,
  DirectMessagingParticipantNotFoundError,
  DirectMessagingSelfMessageError,
} from "./direct-messaging.errors.js";
import {
  toDirectConversationDetail,
  toDirectConversationSummary,
  toDirectMessageProjection,
} from "./direct-messaging.projection.js";
import { buildDirectMessagePreview, validateDirectMessageText } from "./direct-messaging.validators.js";
import {
  buildDirectConversationId,
  sortedParticipantIds,
} from "./persistence/direct-messaging.mongo-document.js";
import {
  findDirectConversationById,
  findDirectMessageByClientMessageId,
  findDirectMessageById,
  insertDirectMessageDocument,
  isDuplicateDirectMessagingKeyError,
  listDirectConversationsForParticipant,
  listDirectMessagesBefore,
  listRecentDirectMessages,
  markDirectConversationReadForParticipant,
  openOrCreateDirectConversationDocument,
  recordNewDirectMessageOnConversation,
} from "./persistence/direct-messaging.repository.js";

const RECENT_MESSAGES_PAGE_SIZE = 30;
const OLDER_MESSAGES_PAGE_SIZE = 30;

/**
 * Communication UX Pack 03.7 Part 7/14 — exported so Shared Documents can
 * reuse Direct Messaging's own membership check for its "Direct
 * Conversation" context instead of re-implementing "is this Participant
 * one of the two conversation members" a second time.
 */
export async function requireConversationMembership(
  conversationId: string,
  participantId: string,
): Promise<DirectConversation> {
  const conversation = await findDirectConversationById(conversationId);

  if (!conversation) {
    throw new DirectMessagingConversationNotFoundError();
  }

  if (!conversation.participantIds.includes(participantId)) {
    throw new DirectMessagingAccessDeniedError();
  }

  return conversation;
}

/** Never throws on a missing/unresolvable recipient identity — see `sendDirectMessage`. */
async function findRecipientMessagingPolicy(
  recipientParticipantId: string,
): Promise<DirectMessagingPolicy | null> {
  try {
    const authUser = await findAuthUserByMemberId(recipientParticipantId);

    if (!authUser) {
      return null;
    }

    const profile = await findMemberProfileByUserId(authUser.userId);

    return profile ? profile.messagingPolicy : null;
  } catch {
    return null;
  }
}

/**
 * Communication UX Pack 03.2 Part 2/5 — the target Participant may be
 * identified either by their public `publicName` (public profile / Direct
 * Message notification entry points) or directly by `participantId`
 * (Workspace Ally entry point: Allies are not required to have a public
 * profile — `profileVisibility` defaults to `members_only` — so `publicName`
 * is not always available there). Either form resolves to the exact same
 * `MemberProfile` lookup the server already trusts; the client never
 * supplies the resulting `participantId` back to itself, and this remains
 * "frontend state is not authority" (Part 5 of Profile UX Pack 03): the
 * server, not the caller, is what turns either identifier into a real
 * Participant + `messagingPolicy`.
 */
export interface DirectConversationTargetIdentity {
  publicName?: string;
  participantId?: string;
}

async function resolveDirectMessagingTargetIdentity(
  target: DirectConversationTargetIdentity,
): Promise<{ targetParticipantId: string; messagingPolicy: DirectMessagingPolicy }> {
  if (target.publicName) {
    const targetProfile = await findMemberProfileByPublicName(target.publicName);

    if (!targetProfile) {
      throw new DirectMessagingParticipantNotFoundError();
    }

    const targetAuthUser = await findAuthUserById(targetProfile.userId);

    if (!targetAuthUser) {
      throw new DirectMessagingParticipantNotFoundError();
    }

    return { targetParticipantId: targetAuthUser.memberId, messagingPolicy: targetProfile.messagingPolicy };
  }

  if (target.participantId) {
    const targetAuthUser = await findAuthUserByMemberId(target.participantId);

    if (!targetAuthUser) {
      throw new DirectMessagingParticipantNotFoundError();
    }

    const targetProfile = await findMemberProfileByUserId(targetAuthUser.userId);

    if (!targetProfile) {
      throw new DirectMessagingParticipantNotFoundError();
    }

    return { targetParticipantId: targetAuthUser.memberId, messagingPolicy: targetProfile.messagingPolicy };
  }

  throw new DirectMessagingParticipantNotFoundError();
}

/**
 * Part 6/7/21 #1/#6 — resolves the target Participant (Part 2/5 above),
 * enforces self-message and Privacy policy checks, then opens or creates
 * the single deterministic conversation for the pair. A blocked attempt
 * persists nothing (Part 21 #6): the policy check runs strictly before any
 * write.
 *
 * The `string` overload is preserved exactly as before (equivalent to
 * `{ publicName: target }`) so every existing caller — the public-profile
 * `DirectMessageAction` entry point and the full existing test suite —
 * keeps working unchanged.
 */
export async function openOrCreateDirectConversation(
  requesterParticipantId: string,
  target: string | DirectConversationTargetIdentity,
): Promise<DirectConversationDetail> {
  const targetIdentity: DirectConversationTargetIdentity =
    typeof target === "string" ? { publicName: target } : target;

  const { targetParticipantId, messagingPolicy } = await resolveDirectMessagingTargetIdentity(targetIdentity);

  if (targetParticipantId === requesterParticipantId) {
    throw new DirectMessagingSelfMessageError();
  }

  const allowed = await isNewDirectConversationAllowed(
    requesterParticipantId,
    targetParticipantId,
    messagingPolicy,
  );

  if (!allowed) {
    throw new DirectMessagingBlockedError();
  }

  const [participantIdA, participantIdB] = sortedParticipantIds(requesterParticipantId, targetParticipantId);
  const conversationId = buildDirectConversationId(participantIdA, participantIdB);
  const now = new Date().toISOString();

  const { conversation } = await openOrCreateDirectConversationDocument({
    conversationId,
    participantIds: [participantIdA, participantIdB],
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    status: "active",
    reads: [participantIdA, participantIdB].map((participantId) => ({
      participantId,
      lastReadAt: null,
      lastReadMessageId: null,
    })),
  });

  const page = await listRecentDirectMessages(conversation.conversationId, RECENT_MESSAGES_PAGE_SIZE);

  return toDirectConversationDetail(conversation, requesterParticipantId, {
    messages: page.messages.slice().reverse(),
    hasMoreOlderMessages: page.hasMore,
  });
}

export async function listMyDirectConversations(
  participantId: string,
): Promise<DirectConversationListResponse> {
  const conversations = await listDirectConversationsForParticipant(participantId);

  const summaries = await Promise.all(
    conversations.map((conversation) => toDirectConversationSummary(conversation, participantId)),
  );

  return { conversations: summaries };
}

export async function getDirectConversationDetail(
  conversationId: string,
  participantId: string,
): Promise<DirectConversationDetail> {
  const conversation = await requireConversationMembership(conversationId, participantId);
  const page = await listRecentDirectMessages(conversation.conversationId, RECENT_MESSAGES_PAGE_SIZE);

  return toDirectConversationDetail(conversation, participantId, {
    messages: page.messages.slice().reverse(),
    hasMoreOlderMessages: page.hasMore,
  });
}

/**
 * The pagination anchor is always a `messageId` the caller already
 * received in a prior page. Launch Readiness Pack 06 — resolve the anchor
 * by exact id lookup instead of re-scanning up to 500 recent messages.
 * Page queries still use the anchor's `(createdAt, messageId)` compound cursor.
 */
async function findAnchorMessage(
  conversationId: string,
  messageId: string,
): Promise<{ createdAt: string; messageId: string } | null> {
  const found = await findDirectMessageById(conversationId, messageId);

  return found ? { createdAt: found.createdAt, messageId: found.messageId } : null;
}

export async function listOlderDirectMessages(
  conversationId: string,
  participantId: string,
  beforeMessageId: string,
): Promise<DirectMessageListResponse> {
  const conversation = await requireConversationMembership(conversationId, participantId);
  const anchor = await findAnchorMessage(conversation.conversationId, beforeMessageId);

  if (!anchor) {
    return { messages: [], hasMoreOlderMessages: false };
  }

  const page = await listDirectMessagesBefore(conversation.conversationId, anchor, OLDER_MESSAGES_PAGE_SIZE);

  return {
    messages: page.messages
      .slice()
      .reverse()
      .map((message) => toDirectMessageProjection(message, participantId)),
    hasMoreOlderMessages: page.hasMore,
  };
}

export interface SendDirectMessageInput {
  conversationId: string;
  senderParticipantId: string;
  text: unknown;
  clientMessageId?: string;
}

/**
 * Part 11/21 — validates, then persists the message and the conversation's
 * last-message/unread metadata atomically inside one Mongo transaction.
 * Idempotent retries (same `clientMessageId`) never create a second
 * message (Part 21 #2/#7), and a blocked send persists nothing (Part 21
 * #7): the recipient Privacy check runs before any write.
 */
export async function sendDirectMessage(input: SendDirectMessageInput): Promise<DirectMessageProjection> {
  const normalizedText = validateDirectMessageText(input.text);
  const conversation = await requireConversationMembership(
    input.conversationId,
    input.senderParticipantId,
  );

  const recipientParticipantId = conversation.participantIds.find(
    (id) => id !== input.senderParticipantId,
  )!;

  const recipientPolicy = await findRecipientMessagingPolicy(recipientParticipantId);

  if (recipientPolicy && !isSendIntoExistingConversationAllowed(recipientPolicy)) {
    throw new DirectMessagingBlockedError();
  }

  if (input.clientMessageId) {
    const existing = await findDirectMessageByClientMessageId(
      conversation.conversationId,
      input.senderParticipantId,
      input.clientMessageId,
    );

    if (existing) {
      return toDirectMessageProjection(existing, input.senderParticipantId);
    }
  }

  const now = new Date().toISOString();
  const message = {
    messageId: randomUUID(),
    conversationId: conversation.conversationId,
    senderParticipantId: input.senderParticipantId,
    text: normalizedText,
    createdAt: now,
    status: "sent" as const,
    clientMessageId: input.clientMessageId,
  };

  try {
    await runMongoTransaction(async (session) => {
      await insertDirectMessageDocument(message, { session });
      await recordNewDirectMessageOnConversation(
        {
          conversationId: conversation.conversationId,
          senderParticipantId: input.senderParticipantId,
          messageId: message.messageId,
          createdAt: now,
          preview: buildDirectMessagePreview(normalizedText),
        },
        { session },
      );

      return true;
    });
  } catch (error) {
    if (isDuplicateDirectMessagingKeyError(error) && input.clientMessageId) {
      const existing = await findDirectMessageByClientMessageId(
        conversation.conversationId,
        input.senderParticipantId,
        input.clientMessageId,
      );

      if (existing) {
        return toDirectMessageProjection(existing, input.senderParticipantId);
      }
    }

    throw error;
  }

  emitDirectMessageNotification({
    recipientParticipantId,
    senderParticipantId: input.senderParticipantId,
    conversationId: conversation.conversationId,
  });

  return toDirectMessageProjection(message, input.senderParticipantId);
}

/**
 * Part 12 — idempotent mark-read: always marks "up to the conversation's
 * currently-known last message" rather than a client-supplied cursor, so
 * repeated calls (even overlapping ones) converge on the same or a more
 * current terminal state and never regress.
 */
export async function markDirectConversationRead(
  conversationId: string,
  participantId: string,
): Promise<void> {
  const conversation = await requireConversationMembership(conversationId, participantId);

  await markDirectConversationReadForParticipant({
    conversationId: conversation.conversationId,
    participantId,
    lastReadAt: conversation.lastMessageAt,
    lastReadMessageId: conversation.lastMessageId ?? "",
  });

  try {
    // UX Completion Pack 04 Part 7 — keeps the header bell / Notification
    // Center unread counts converged with the conversation's own durable
    // unread marker (Part 5 above). Best-effort like every other
    // notification side-effect in this module: a failure here must never
    // fail the mark-read request itself, since the conversation's own read
    // state (just persisted above) is the durable source of truth.
    await markDirectMessageNotificationsRead({ participantId, conversationId: conversation.conversationId });
  } catch {
    // Non-fatal — see comment above.
  }
}
