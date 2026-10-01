/**
 * VC-03 — invitation window and history cap live in one place.
 * 60 seconds matches an ordinary incoming-call ring. There is no
 * background sweeper: overdue invitations are reconciled on the next
 * call read or mutation for that conversation.
 */

export const DIRECT_CONVERSATION_CALL_INVITATION_TTL_MS = 60_000;

export const DIRECT_CONVERSATION_CALL_HISTORY_LIMIT = 20;

/** Per initiator. Stops invite spam without a new dependency or a worker. */
export const DIRECT_CONVERSATION_CALL_CREATE_MAX_ATTEMPTS = 8;

export const DIRECT_CONVERSATION_CALL_CREATE_WINDOW_MS = 60_000;

let invitationTtlOverrideMs: number | null = null;

export function resolveDirectConversationCallInvitationTtlMs(): number {
  return invitationTtlOverrideMs ?? DIRECT_CONVERSATION_CALL_INVITATION_TTL_MS;
}

/** Tests only. Pass null to restore the production window. */
export function setDirectConversationCallInvitationTtlMsForTests(ttlMs: number | null): void {
  invitationTtlOverrideMs = ttlMs;
}
