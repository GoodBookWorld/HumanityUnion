import type { CanonicalDomainEventEnvelope } from "../../../infrastructure/events/domain-event.js";
import { logger } from "../../../shared/observability/logger.js";
import { ParticipantActionValidationError } from "../participant-action.errors.js";
import { insertParticipantActionIfAbsent } from "../infrastructure/participant-action.repository.js";
import { mapPetitionSignedToParticipantAction } from "./petition-signed-to-participant-action.mapper.js";

/**
 * Recovery Task 27 Part 8 — consumer registration identity, following the
 * existing `<module>.<event>.v1` convention (see
 * `WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID`).
 */
export const PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID =
  "participant-action.petition-signed.v1" as const;

/**
 * Recovery Task 27 Part 8/11 — idempotent `PetitionSigned` consumer.
 *
 * Responsibilities, exactly: validate the envelope, map it to a Participant
 * Action, insert it idempotently, and complete. This function performs zero
 * Petition/Signature/Participant/Initiative/Member-status lookups, sends no
 * notifications, awards no Fair, updates no Member or Participant profile,
 * and writes no legacy Activity — every field it persists is read directly
 * off the already-durable envelope (Part 8, Part 14).
 *
 * The outer `processed-events` claim (dispatched by
 * `outbox.dispatcher.ts` before this handler is ever invoked) is the first
 * idempotency layer; the repository's `unique(sourceEventId)` index is the
 * second, storage-level layer (Part 11). Throwing here (e.g. on validation
 * failure or a genuine Mongo insert failure) leaves the source event
 * retryable — the dispatcher releases the processing claim and marks the
 * outbox record failed rather than published (see
 * `../../../infrastructure/outbox/outbox.dispatcher.ts`).
 */
export async function handlePetitionSignedForParticipantAction(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  try {
    const record = mapPetitionSignedToParticipantAction(envelope, new Date().toISOString());
    const outcome = await insertParticipantActionIfAbsent(record);

    logger.info("participant_action.projected", {
      component: "participant-action",
      consumerId: PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
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
      consumerId: PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID,
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
