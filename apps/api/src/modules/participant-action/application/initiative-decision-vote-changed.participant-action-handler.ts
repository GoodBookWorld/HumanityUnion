import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { logger } from "../../../shared/observability/logger.js";
import { ParticipantActionValidationError } from "../participant-action.errors.js";
import { insertParticipantActionIfAbsent } from "../infrastructure/participant-action.repository.js";
import { mapInitiativeDecisionVoteChangedToParticipantAction } from "./initiative-decision-vote-changed-to-participant-action.mapper.js";

/**
 * Recovery Task 33 Part 10 — consumer registration identity, following the
 * exact `<module>.<event>.v1` convention. Distinct from, and never colliding
 * with, `PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID`
 * (different event name in the suffix) or
 * `PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID`.
 */
export const PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID =
  "participant-action.initiative-decision-vote-changed.v1" as const;

/**
 * Recovery Task 33 Part 9/11/13/14 — idempotent, append-only
 * `InitiativeDecisionVoteChanged` consumer.
 *
 * Every real change is projected as its own new, independently-addressable
 * Participant Action — this handler never looks up, mutates, deletes,
 * supersedes, or invalidates the earlier Cast Participant Action or any
 * earlier Changed Participant Action (Part 13), and never requires the Cast
 * action to already exist (Part 14: `insertParticipantActionIfAbsent` is a
 * bare insert keyed only on this event's own deterministic identity — it
 * performs no read-then-branch against any other action).
 *
 * Responsibilities, exactly: validate the envelope, map it to a Participant
 * Action, insert it idempotently, and complete. This function performs zero
 * Vote/Decision/Initiative/Participant/Member-status lookups, sends no
 * notifications, awards no Fair, updates no Member or Participant profile,
 * and writes no legacy Activity.
 */
export async function handleInitiativeDecisionVoteChangedForParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  // Pack 02B — Visitors never create Participant Actions.
  if (
    typeof envelope.payload.participantId !== "string" ||
    envelope.payload.participantId.trim() === ""
  ) {
    logger.info("participant_action.skipped_visitor_vote", {
      component: "participant-action",
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
      eventId: envelope.eventId,
    });
    return;
  }

  try {
    const record = mapInitiativeDecisionVoteChangedToParticipantAction(
      envelope,
      new Date().toISOString(),
    );
    const outcome = await insertParticipantActionIfAbsent(record);

    logger.info("participant_action.projected", {
      component: "participant-action",
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
      eventId: envelope.eventId,
      participantActionId: record.participantActionId,
      participantId: record.participantId,
      initiativeId: record.initiativeId,
      actionType: record.actionType,
      outcome,
    });
  } catch (error) {
    logger.error("participant_action.projection_failed", {
      component: "participant-action",
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CHANGED_CONSUMER_ID,
      eventId: envelope.eventId,
      errorCode:
        error instanceof ParticipantActionValidationError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}
