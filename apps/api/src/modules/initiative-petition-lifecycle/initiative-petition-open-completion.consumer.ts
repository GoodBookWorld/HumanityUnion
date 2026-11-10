import type { CanonicalDomainEventEnvelope } from "../../infrastructure/events/domain-event.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { validateInitiativeLifecycleStagePublishedEnvelope } from "../../shared/initiative-lifecycle-stage/initiative-lifecycle-stage-notification.consumer.js";
import { logger } from "../../shared/observability/logger.js";
import { completeWorkingDraftPetitionOpening } from "./initiative-petition-lifecycle.service.js";

/**
 * HU-LC-05C.4C.2A — completes Published → Open for a working-draft Petition
 * publication. The publication event commits in the same transaction as the
 * publication, so this outbox consumer runs after commit — after a crash or
 * restart too (boot recovery and the safety sweep redeliver pending events).
 * The dispatcher's (consumerId, eventId) claim runs it at most once per event;
 * the operation itself is idempotent.
 */
export const INITIATIVE_PETITION_OPEN_COMPLETION_CONSUMER_ID =
  "initiative-petition.open-completion.v1";

export async function handleInitiativePetitionOpenCompletion(
  envelope: CanonicalDomainEventEnvelope,
): Promise<void> {
  const payload = validateInitiativeLifecycleStagePublishedEnvelope(envelope);

  if (payload.stageId !== "petition" || payload.publicationKind !== "published") {
    return;
  }

  const outcome = await completeWorkingDraftPetitionOpening({
    initiativeId: payload.initiativeId,
    petitionId: payload.stageArtifactId,
    publicationVersion: payload.stageVersion,
  });

  logger.info("initiative_petition.open_completion", {
    component: "initiative-petition-lifecycle",
    consumerId: INITIATIVE_PETITION_OPEN_COMPLETION_CONSUMER_ID,
    eventId: envelope.eventId,
    initiativeId: payload.initiativeId,
    petitionId: payload.stageArtifactId,
    outcome,
  });
}

let registered = false;

export function registerInitiativePetitionOpenCompletionHandler(): void {
  if (registered) {
    return;
  }

  registerDomainEventHandler({
    consumerId: INITIATIVE_PETITION_OPEN_COMPLETION_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.initiativeLifecycleStagePublished,
    handle: handleInitiativePetitionOpenCompletion,
  });
  registered = true;
}

export function resetInitiativePetitionOpenCompletionHandlerForTests(): void {
  registered = false;
}
