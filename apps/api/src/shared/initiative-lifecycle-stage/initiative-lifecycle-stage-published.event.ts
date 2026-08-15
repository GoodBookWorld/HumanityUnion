import type { InitiativeLifecycleStagePublicationKind } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../infrastructure/events/domain-event.js";

export const INITIATIVE_LIFECYCLE_STAGE_AGGREGATE_TYPE = "InitiativeLifecycleStage" as const;

export interface InitiativeLifecycleStagePublishedPayload extends Record<string, unknown> {
  initiativeId: string;
  initiativeTitle: string;
  stageId: string;
  stageLabel: string;
  stageArtifactId: string;
  stageVersion: number;
  actorParticipantId: string;
  publicationKind: InitiativeLifecycleStagePublicationKind;
  relatedUrl: string;
  occurredAt: string;
}

/**
 * Deterministic per-transition event id: `(initiativeId, stageId,
 * stageVersion, publicationKind)` uniquely identifies one real publication
 * transition. Combined with the outbox's unique index on `eventId` (see
 * `mongo-indexes.ts`), this is what makes
 * `publishInitiativeLifecycleStage` idempotent-on-retry (Part 13/17) without
 * requiring every caller to independently guard against double-submission.
 */
export function buildInitiativeLifecycleStagePublishedEventId(input: {
  initiativeId: string;
  stageId: string;
  stageVersion: number;
  publicationKind: InitiativeLifecycleStagePublicationKind;
}): string {
  return `initiative-lifecycle-stage-published:${input.initiativeId}:${input.stageId}:${input.stageVersion}:${input.publicationKind}`;
}

export function createInitiativeLifecycleStagePublishedEvent(input: {
  initiativeId: string;
  initiativeTitle: string;
  stageId: string;
  stageLabel: string;
  stageArtifactId: string;
  stageVersion: number;
  actorParticipantId: string;
  publicationKind: InitiativeLifecycleStagePublicationKind;
  relatedUrl: string;
  occurredAt?: string;
  correlationId?: string;
}): DomainEvent<InitiativeLifecycleStagePublishedPayload> {
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  return createDomainEvent({
    eventId: buildInitiativeLifecycleStagePublishedEventId({
      initiativeId: input.initiativeId,
      stageId: input.stageId,
      stageVersion: input.stageVersion,
      publicationKind: input.publicationKind,
    }),
    eventName: CATALOGUE_EVENTS.initiativeLifecycleStagePublished,
    aggregateType: INITIATIVE_LIFECYCLE_STAGE_AGGREGATE_TYPE,
    aggregateId: input.initiativeId,
    payload: {
      initiativeId: input.initiativeId,
      initiativeTitle: input.initiativeTitle,
      stageId: input.stageId,
      stageLabel: input.stageLabel,
      stageArtifactId: input.stageArtifactId,
      stageVersion: input.stageVersion,
      actorParticipantId: input.actorParticipantId,
      publicationKind: input.publicationKind,
      relatedUrl: input.relatedUrl,
      occurredAt,
    },
    correlationId: input.correlationId,
    actorId: input.actorParticipantId,
    occurredAt,
  });
}
