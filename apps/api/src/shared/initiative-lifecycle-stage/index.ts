import { registerDomainEventHandler } from "../../infrastructure/integration/event-handler-registry.js";
import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import {
  handleInitiativeLifecycleStagePublishedNotification,
  INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
} from "./initiative-lifecycle-stage-notification.consumer.js";

let initiativeLifecycleStageHandlersRegistered = false;

export function resetInitiativeLifecycleStageHandlersForTests(): void {
  initiativeLifecycleStageHandlersRegistered = false;
}

/**
 * Initiative Lifecycle Part A Part 14 — registers the universal Active
 * Ally notification fan-out consumer, mirroring
 * `registerWorkspaceProjectionHandlers` / `registerParticipantActionHandlers`
 * exactly (same registry, same outbox, no second event bus).
 */
export function registerInitiativeLifecycleStageHandlers(): void {
  if (initiativeLifecycleStageHandlersRegistered) {
    return;
  }

  registerDomainEventHandler({
    consumerId: INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
    eventName: CATALOGUE_EVENTS.initiativeLifecycleStagePublished,
    handle: handleInitiativeLifecycleStagePublishedNotification,
  });

  initiativeLifecycleStageHandlersRegistered = true;
}

export {
  getInitiativeLifecycleStageDefinition,
  getNextInitiativeLifecycleStageId,
  getPreviousInitiativeLifecycleStageId,
  INITIATIVE_LIFECYCLE_STAGE_REGISTRY,
  isInitiativeLifecycleAuthorWorkspaceStage,
  isInitiativeLifecycleStageId,
} from "@hu/types";
export type {
  InitiativeLifecycleStageDefinition,
  InitiativeLifecycleStageId,
} from "@hu/types";
export {
  resolveInitiativeLifecyclePresentationMode,
  type ResolveInitiativeLifecyclePresentationModeInput,
} from "./initiative-lifecycle-author-mode.js";
export {
  buildInitiativeLifecycleStagePublishedEventId,
  createInitiativeLifecycleStagePublishedEvent,
  INITIATIVE_LIFECYCLE_STAGE_AGGREGATE_TYPE,
  type InitiativeLifecycleStagePublishedPayload,
} from "./initiative-lifecycle-stage-published.event.js";
export {
  publishInitiativeLifecycleStage,
  type PublishInitiativeLifecycleStageInput,
  type PublishInitiativeLifecycleStageOutcome,
  type PublishInitiativeLifecycleStageResult,
} from "./initiative-lifecycle-stage-publication.service.js";
export {
  assertLifecycleTransitionPostcondition,
  LIFECYCLE_NEXT_STAGE_CREATION_STRATEGY,
  resolveLifecycleStateAfterStagePublication,
  resolveNextStageAfterPublish,
  summarizeLifecycleTransitionPostcondition,
  type LifecycleTransitionPostconditionInput,
} from "./initiative-lifecycle-transition.contract.js";
export { buildInitiativeLifecycleStageNotificationCopy } from "./initiative-lifecycle-stage-notification-copy.js";
export {
  defaultInitiativeLifecycleStageNotificationDependencies,
  handleInitiativeLifecycleStagePublishedNotification,
  INITIATIVE_LIFECYCLE_STAGE_NOTIFICATION_CONSUMER_ID,
  validateInitiativeLifecycleStagePublishedEnvelope,
  type InitiativeLifecycleStageNotificationDependencies,
} from "./initiative-lifecycle-stage-notification.consumer.js";
