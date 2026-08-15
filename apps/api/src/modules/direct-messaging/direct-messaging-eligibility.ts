import type { DirectMessagingPolicy } from "@hu/types";

import { listWorkspaceAlliesForParticipant } from "../initiative-discussion-collaboration/workspace-allies.service.js";

export interface DirectMessagingEligibilityDependencies {
  listWorkspaceAlliesForParticipant: typeof listWorkspaceAlliesForParticipant;
}

const defaultDirectMessagingEligibilityDependencies: DirectMessagingEligibilityDependencies = {
  listWorkspaceAlliesForParticipant,
};

/**
 * "Active Allies" (Part 6/14) reuses the exact same, already-documented
 * relationship `listWorkspaceAlliesForParticipant` already computes (an
 * ACTIVE `InitiativeAlly` row between a steward and a collaborator) — it
 * does not invent a new peer/friendship graph. Two Participants are
 * considered Active Allies here when either one stewards an Initiative the
 * other is an active Ally on, checked in both directions since the
 * relationship is not symmetrized in the underlying store.
 */
export async function areParticipantsActiveAllies(
  participantIdA: string,
  participantIdB: string,
  deps: DirectMessagingEligibilityDependencies = defaultDirectMessagingEligibilityDependencies,
): Promise<boolean> {
  if (participantIdA === participantIdB) {
    return false;
  }

  const [alliesOfA, alliesOfB] = await Promise.all([
    deps.listWorkspaceAlliesForParticipant(participantIdA),
    deps.listWorkspaceAlliesForParticipant(participantIdB),
  ]);

  return (
    alliesOfA.some((entry) => entry.participantId === participantIdB) ||
    alliesOfB.some((entry) => entry.participantId === participantIdA)
  );
}

/**
 * Single source of truth for "may `viewerParticipantId` start a brand-new
 * conversation with `ownerParticipantId`, given `ownerPolicy`" (Part 5/6) —
 * used by both the read-only Public Profile Message-button projection
 * (Part 7) and the authoritative open-conversation write path, so the
 * control a viewer sees and the server's authorization decision can never
 * disagree. Server-side only; never trusts a client-supplied decision.
 */
export async function isNewDirectConversationAllowed(
  viewerParticipantId: string | undefined,
  ownerParticipantId: string,
  ownerPolicy: DirectMessagingPolicy,
  deps: DirectMessagingEligibilityDependencies = defaultDirectMessagingEligibilityDependencies,
): Promise<boolean> {
  if (!viewerParticipantId || viewerParticipantId === ownerParticipantId) {
    return false;
  }

  switch (ownerPolicy) {
    case "nobody":
      return false;
    case "registered_participants":
      return true;
    case "active_allies":
      return areParticipantsActiveAllies(viewerParticipantId, ownerParticipantId, deps);
    default:
      return false;
  }
}

/**
 * Part 6 — "existing conversation history remains visible; new messages
 * are blocked if the recipient has changed the setting to Nobody." A
 * downgrade to a stricter-but-not-`nobody` policy (e.g. Registered
 * Participants -> Active Allies) never retroactively blocks an already
 * existing conversation; only `nobody` does.
 */
export function isSendIntoExistingConversationAllowed(recipientPolicy: DirectMessagingPolicy): boolean {
  return recipientPolicy !== "nobody";
}
