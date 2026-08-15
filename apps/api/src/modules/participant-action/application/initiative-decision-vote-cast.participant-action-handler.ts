import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { logger } from "../../../shared/observability/logger.js";
import { ParticipantActionValidationError } from "../participant-action.errors.js";
import { insertParticipantActionIfAbsent } from "../infrastructure/participant-action.repository.js";
import { mapInitiativeDecisionVoteCastToParticipantAction } from "./initiative-decision-vote-cast-to-participant-action.mapper.js";

/**
 * Recovery Task 33 Part 10 — consumer registration identity, following the
 * exact `<module>.<event>.v1` convention Task 27 established for
 * `PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID`. Stable across
 * deployments; changing this task's implementation code never silently
 * changes this ID — only a deliberate schema-version bump would introduce a
 * new `.v2` consumer ID.
 */
export const PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID =
  "participant-action.initiative-decision-vote-cast.v1" as const;

/**
 * Recovery Task 33 Part 9/11 — idempotent `InitiativeDecisionVoteCast`
 * consumer, mirroring `handlePetitionSignedForParticipantAction` exactly.
 *
 * Responsibilities, exactly: validate the envelope, map it to a Participant
 * Action, insert it idempotently, and complete. This function performs zero
 * Vote/Decision/Initiative/Participant/Member-status lookups, sends no
 * notifications, awards no Fair, updates no Member or Participant profile,
 * and writes no legacy Activity — every field it persists is read directly
 * off the already-durable envelope (Part 9, Part 15).
 *
 * The outer `processed-events` claim (dispatched by
 * `outbox.dispatcher.ts` before this handler is ever invoked) is the first
 * idempotency layer; the repository's `unique(sourceEventId)`/
 * `unique(participantActionId)` indexes are the second, storage-level layer
 * (Part 11). Throwing here (e.g. on validation failure or a genuine Mongo
 * insert/conflict failure) leaves the source event retryable — the
 * dispatcher releases the processing claim and marks the outbox record
 * failed rather than published.
 */
export async function handleInitiativeDecisionVoteCastForParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  try {
    const record = mapInitiativeDecisionVoteCastToParticipantAction(
      envelope,
      new Date().toISOString(),
    );
    const outcome = await insertParticipantActionIfAbsent(record);

    logger.info("participant_action.projected", {
      component: "participant-action",
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
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
      consumerId: PARTICIPANT_ACTION_INITIATIVE_DECISION_VOTE_CAST_CONSUMER_ID,
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
