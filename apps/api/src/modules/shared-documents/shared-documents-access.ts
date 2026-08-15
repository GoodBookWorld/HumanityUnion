import type { SharedDocumentContextRef } from "@hu/types";

import {
  DirectMessagingAccessDeniedError,
  DirectMessagingConversationNotFoundError,
  requireConversationMembership,
} from "../direct-messaging/index.js";
import { findCollaborationSessionById } from "../initiative-collaboration-sessions/index.js";
import {
  InitiativeCollaborationChannelAccessDeniedError,
  InitiativeCollaborationChannelNotFoundError,
  resolveInitiativeCollaborationChannelAccess,
} from "../initiative-collaboration-channel/index.js";
import { listActiveAlliesByInitiative } from "../initiative-discussion-collaboration/initiative-ally.store.js";

import { SharedDocumentAccessDeniedError, SharedDocumentContextNotFoundError } from "./shared-documents.errors.js";

/**
 * Communication UX Pack 03.7 Part 7/14 — the single authorization
 * dispatcher every Shared Documents operation goes through. Each context
 * reuses that context's *own, already-established* authorization
 * boundary rather than a new permission model:
 *
 * - Direct Conversation → `requireConversationMembership` (Direct
 *   Messaging's own participant check).
 * - Collaboration Channel / Collaboration Session → Author or Active
 *   Ally, resolved by the exact same `resolveInitiativeCollaborationChannelAccess`
 *   both the Channel (Pack 03.5) and Sessions (Pack 03.6) already use —
 *   Sessions never gets a second, competing permission rule (Part 7 gives
 *   Sessions the identical Author/Active-Ally boundary as the Channel).
 */
export interface SharedDocumentContextAccess {
  relatedEntityType: "direct_conversation" | "initiative";
  relatedEntityId: string;
  relatedUrl: string;
  /** Every other current member of this context — never the actor — for notification fan-out (Part 10). */
  otherParticipantIds: string[];
}

async function listOtherActiveAllyAndStewardIds(
  initiativeId: string,
  stewardId: string,
  excludeParticipantId: string,
): Promise<string[]> {
  const activeAllies = await listActiveAlliesByInitiative(initiativeId);
  const uniqueIds = new Set(activeAllies.map((ally) => ally.participantId).filter((id) => id !== stewardId));

  return [stewardId, ...uniqueIds].filter((id) => id !== excludeParticipantId);
}

export async function resolveSharedDocumentContextAccess(
  context: SharedDocumentContextRef,
  participantId: string,
): Promise<SharedDocumentContextAccess> {
  if (context.contextType === "direct_conversation") {
    try {
      const conversation = await requireConversationMembership(context.conversationId, participantId);

      return {
        relatedEntityType: "direct_conversation",
        relatedEntityId: context.conversationId,
        relatedUrl: `/workspace/messages/${context.conversationId}`,
        otherParticipantIds: conversation.participantIds.filter((id) => id !== participantId),
      };
    } catch (error) {
      if (error instanceof DirectMessagingConversationNotFoundError) {
        throw new SharedDocumentContextNotFoundError();
      }

      if (error instanceof DirectMessagingAccessDeniedError) {
        throw new SharedDocumentAccessDeniedError();
      }

      throw error;
    }
  }

  if (context.contextType === "collaboration_channel") {
    const access = await resolveChannelAuthorization(context.initiativeId, participantId);

    return {
      relatedEntityType: "initiative",
      relatedEntityId: context.initiativeId,
      /**
       * Communication UX Pack 03.9 Part 12 — deep-links into Initiative
       * Group Chat mode on Workspace Messages, the same destination the
       * Channel's own notifications now use.
       */
      relatedUrl: `/workspace/messages?mode=initiative&initiativeId=${encodeURIComponent(context.initiativeId)}&section=channel`,
      otherParticipantIds: await listOtherActiveAllyAndStewardIds(
        context.initiativeId,
        access.stewardId,
        participantId,
      ),
    };
  }

  if (context.contextType === "collaboration_session") {
    const access = await resolveChannelAuthorization(context.initiativeId, participantId);
    const session = await findCollaborationSessionById(context.initiativeId, context.sessionId);

    if (!session) {
      throw new SharedDocumentContextNotFoundError();
    }

    return {
      relatedEntityType: "initiative",
      relatedEntityId: context.initiativeId,
      /**
       * Communication UX Pack 03.9 Part 12 — deep-links into Initiative Group
       * Chat mode on Workspace Messages, the same destination Sessions'
       * own notifications now use.
       */
      relatedUrl: `/workspace/messages?mode=initiative&initiativeId=${encodeURIComponent(context.initiativeId)}&section=sessions`,
      otherParticipantIds: await listOtherActiveAllyAndStewardIds(
        context.initiativeId,
        access.stewardId,
        participantId,
      ),
    };
  }

  /**
   * Initiative Lifecycle — Part K, Section 7. Official Response
   * attachments reuse the exact same Author-or-Active-Ally boundary as
   * the Collaboration Channel — never a new permission model — because
   * Official Responses are authored on the Initiative's own Lifecycle
   * Stage Workspace, the same place the Channel already resolves access
   * for.
   */
  const access = await resolveChannelAuthorization(context.initiativeId, participantId);

  return {
    relatedEntityType: "initiative",
    relatedEntityId: context.initiativeId,
    relatedUrl: `/initiatives/public/${encodeURIComponent(context.initiativeId)}#official-responses`,
    otherParticipantIds: await listOtherActiveAllyAndStewardIds(
      context.initiativeId,
      access.stewardId,
      participantId,
    ),
  };
}

async function resolveChannelAuthorization(initiativeId: string, participantId: string) {
  try {
    return await resolveInitiativeCollaborationChannelAccess(initiativeId, participantId);
  } catch (error) {
    if (error instanceof InitiativeCollaborationChannelNotFoundError) {
      throw new SharedDocumentContextNotFoundError();
    }

    if (error instanceof InitiativeCollaborationChannelAccessDeniedError) {
      throw new SharedDocumentAccessDeniedError();
    }

    throw error;
  }
}
