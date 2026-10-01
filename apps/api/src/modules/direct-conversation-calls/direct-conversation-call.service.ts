import { randomUUID } from "node:crypto";

import type { DirectConversation, DirectConversationCall, DirectConversationCallConnection } from "@hu/types";

import { requireConversationMembership } from "../direct-messaging/direct-messaging.service.js";
import { resolveLiveKitConfig } from "../../config/livekit.config.js";
import {
  DIRECT_CONVERSATION_CALL_HISTORY_LIMIT,
  resolveDirectConversationCallInvitationTtlMs,
} from "./direct-conversation-call.config.js";
import {
  DirectConversationCallConflictError,
  DirectConversationCallExpiredError,
  DirectConversationCallNotFoundError,
  DirectConversationCallTransitionError,
  DirectConversationCallValidationError,
} from "./direct-conversation-call.errors.js";
import { assertDirectConversationCallCreateRateLimit } from "./direct-conversation-call.rate-limit.js";
import { mintLiveKitParticipantToken } from "./livekit-access.js";
import { releaseLiveKitRoomAfterEnd } from "./livekit-room.js";
import {
  findDirectConversationCallById,
  findLiveDirectConversationCall,
  insertDirectConversationCall,
  isDuplicateDirectConversationCallKeyError,
  listOverdueInvitedDirectConversationCalls,
  listTerminalDirectConversationCalls,
  pruneTerminalDirectConversationCalls,
  transitionDirectConversationCall,
} from "./persistence/direct-conversation-call.repository.js";

export interface DirectConversationCallCommand {
  conversationId: string;
  participantId: string;
  callId: string;
}

function requireConversationId(conversationId: string): string {
  const normalized = conversationId.trim();

  if (!normalized) {
    throw new DirectConversationCallValidationError("A conversation is required.");
  }

  return normalized;
}

function requireCallId(callId: string): string {
  const normalized = callId.trim();

  if (!normalized) {
    throw new DirectConversationCallValidationError("A call is required.");
  }

  return normalized;
}

async function authorizeConversation(
  conversationId: string,
  participantId: string,
): Promise<DirectConversation> {
  return requireConversationMembership(requireConversationId(conversationId), participantId);
}

/**
 * Overdue invitations become `missed` here. A conditional update loses to a
 * concurrent accept, which is the intended outcome.
 *
 * Terminal missed rows are the later member_notifications emission point.
 * VC-03 does not write notifications.
 */
async function reconcileOverdueInvitations(conversationId: string, now: string): Promise<void> {
  const overdue = await listOverdueInvitedDirectConversationCalls(conversationId, now);

  for (const call of overdue) {
    const missed = await transitionDirectConversationCall({
      callId: call.callId,
      fromStatus: "invited",
      expiresAtLte: now,
      toStatus: "missed",
      updatedAt: now,
      endedAt: now,
    });

    if (missed) {
      await pruneTerminalDirectConversationCalls(conversationId);
    }
  }
}

async function requireCallForMember(
  conversationId: string,
  callId: string,
  participantId: string,
): Promise<DirectConversationCall> {
  await authorizeConversation(conversationId, participantId);
  const call = await findDirectConversationCallById(requireCallId(callId));

  if (!call || call.conversationId !== conversationId) {
    throw new DirectConversationCallNotFoundError();
  }

  if (!call.participantIds.includes(participantId)) {
    throw new DirectConversationCallNotFoundError();
  }

  return call;
}

export async function createDirectConversationCall(input: {
  conversationId: string;
  initiatorParticipantId: string;
}): Promise<DirectConversationCall> {
  const conversation = await authorizeConversation(
    input.conversationId,
    input.initiatorParticipantId,
  );
  assertDirectConversationCallCreateRateLimit(input.initiatorParticipantId);

  const now = new Date();
  const nowIso = now.toISOString();
  await reconcileOverdueInvitations(conversation.conversationId, nowIso);

  const call: DirectConversationCall = {
    callId: `direct-conversation-call-${randomUUID()}`,
    contextType: "direct_conversation",
    conversationId: conversation.conversationId,
    participantIds: [...conversation.participantIds],
    initiatorParticipantId: input.initiatorParticipantId,
    status: "invited",
    createdAt: nowIso,
    updatedAt: nowIso,
    expiresAt: new Date(now.getTime() + resolveDirectConversationCallInvitationTtlMs()).toISOString(),
  };

  try {
    await insertDirectConversationCall(call);
  } catch (error) {
    if (isDuplicateDirectConversationCallKeyError(error)) {
      throw new DirectConversationCallConflictError();
    }

    throw error;
  }

  return call;
}

export async function getCurrentDirectConversationCall(
  conversationId: string,
  participantId: string,
): Promise<DirectConversationCall | null> {
  const conversation = await authorizeConversation(conversationId, participantId);
  await reconcileOverdueInvitations(conversation.conversationId, new Date().toISOString());
  return findLiveDirectConversationCall(conversation.conversationId);
}

export async function listDirectConversationCallHistory(
  conversationId: string,
  participantId: string,
): Promise<DirectConversationCall[]> {
  const conversation = await authorizeConversation(conversationId, participantId);
  await reconcileOverdueInvitations(conversation.conversationId, new Date().toISOString());
  return listTerminalDirectConversationCalls(
    conversation.conversationId,
    DIRECT_CONVERSATION_CALL_HISTORY_LIMIT,
  );
}

export async function acceptDirectConversationCall(
  input: DirectConversationCallCommand,
): Promise<DirectConversationCall> {
  const conversationId = requireConversationId(input.conversationId);
  await authorizeConversation(conversationId, input.participantId);
  const now = new Date().toISOString();
  await reconcileOverdueInvitations(conversationId, now);

  const call = await requireCallForMember(conversationId, input.callId, input.participantId);

  if (call.initiatorParticipantId === input.participantId) {
    throw new DirectConversationCallTransitionError("The caller cannot accept their own invitation.");
  }

  if (call.status === "missed" || (call.status === "invited" && call.expiresAt <= now)) {
    throw new DirectConversationCallExpiredError();
  }

  if (call.status !== "invited") {
    throw new DirectConversationCallTransitionError();
  }

  const accepted = await transitionDirectConversationCall({
    callId: call.callId,
    fromStatus: "invited",
    expiresAtGt: now,
    toStatus: "accepted",
    updatedAt: now,
    acceptedAt: now,
  });

  if (accepted) {
    return accepted;
  }

  const current = await findDirectConversationCallById(call.callId);

  if (!current || current.status === "missed" || current.expiresAt <= now) {
    throw new DirectConversationCallExpiredError();
  }

  throw new DirectConversationCallTransitionError();
}

export async function declineDirectConversationCall(
  input: DirectConversationCallCommand,
): Promise<DirectConversationCall> {
  const conversationId = requireConversationId(input.conversationId);
  await authorizeConversation(conversationId, input.participantId);
  const now = new Date().toISOString();
  await reconcileOverdueInvitations(conversationId, now);

  const call = await requireCallForMember(conversationId, input.callId, input.participantId);

  if (call.initiatorParticipantId === input.participantId) {
    throw new DirectConversationCallTransitionError("The caller cannot decline their own invitation.");
  }

  if (call.status === "missed" || (call.status === "invited" && call.expiresAt <= now)) {
    throw new DirectConversationCallExpiredError();
  }

  if (call.status !== "invited") {
    throw new DirectConversationCallTransitionError();
  }

  const declined = await transitionDirectConversationCall({
    callId: call.callId,
    fromStatus: "invited",
    expiresAtGt: now,
    toStatus: "declined",
    updatedAt: now,
    endedAt: now,
  });

  if (!declined) {
    const current = await findDirectConversationCallById(call.callId);

    if (!current || current.status === "missed" || current.expiresAt <= now) {
      throw new DirectConversationCallExpiredError();
    }

    throw new DirectConversationCallTransitionError();
  }

  await pruneTerminalDirectConversationCalls(conversationId);
  return declined;
}

export async function endDirectConversationCall(
  input: DirectConversationCallCommand,
): Promise<DirectConversationCall> {
  const conversationId = requireConversationId(input.conversationId);
  await authorizeConversation(conversationId, input.participantId);
  const now = new Date().toISOString();
  await reconcileOverdueInvitations(conversationId, now);

  const call = await requireCallForMember(conversationId, input.callId, input.participantId);

  if (call.status !== "accepted") {
    throw new DirectConversationCallTransitionError();
  }

  const ended = await transitionDirectConversationCall({
    callId: call.callId,
    fromStatus: "accepted",
    toStatus: "ended",
    updatedAt: now,
    endedAt: now,
  });

  if (!ended) {
    throw new DirectConversationCallTransitionError();
  }

  await pruneTerminalDirectConversationCalls(conversationId);
  await releaseLiveKitRoomAfterEnd(ended.callId);
  return ended;
}

/**
 * Issues a LiveKit connection only after the VC-03 call is accepted.
 * Room, identity, URL, and grants come from the server. The request body
 * cannot supply them.
 */
export async function issueDirectConversationCallConnection(input: {
  conversationId: string;
  callId: string;
  participantId: string;
}): Promise<DirectConversationCallConnection> {
  const conversationId = requireConversationId(input.conversationId);
  await authorizeConversation(conversationId, input.participantId);
  const now = new Date().toISOString();
  await reconcileOverdueInvitations(conversationId, now);

  const call = await requireCallForMember(conversationId, input.callId, input.participantId);

  if (call.status === "missed" || (call.status === "invited" && call.expiresAt <= now)) {
    throw new DirectConversationCallExpiredError();
  }

  if (call.status !== "accepted") {
    throw new DirectConversationCallTransitionError();
  }

  const config = resolveLiveKitConfig();
  const token = await mintLiveKitParticipantToken({
    config,
    callId: call.callId,
    participantId: input.participantId,
  });

  return { token, url: config.url };
}
