/**
 * Pack 22E.1 — InitiativePublished domain event (projected/public publish).
 */
import type { InitiativeLifecycleProfile } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import { enqueueDomainEvent } from "../../../infrastructure/outbox/outbox.repository.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";

export const INITIATIVE_AGGREGATE_TYPE = "Initiative" as const;

export interface InitiativePublishedPayload extends Record<string, unknown> {
  initiativeId: string;
  title: string;
  actorParticipantId: string;
  actorLabel: string | null;
  lifecycleProfile: InitiativeLifecycleProfile;
  electionTitle: string;
  publishedAt: string;
}

export function buildInitiativePublishedEventId(initiativeId: string): string {
  return `initiative-published:${initiativeId}`;
}

export function createInitiativePublishedEvent(input: {
  initiativeId: string;
  title: string;
  actorParticipantId: string;
  actorLabel?: string | null;
  lifecycleProfile: InitiativeLifecycleProfile;
  electionTitle: string;
  publishedAt: string;
}): DomainEvent<InitiativePublishedPayload> {
  return createDomainEvent({
    eventId: buildInitiativePublishedEventId(input.initiativeId),
    eventName: CATALOGUE_EVENTS.initiativePublished,
    aggregateType: INITIATIVE_AGGREGATE_TYPE,
    aggregateId: input.initiativeId,
    actorId: input.actorParticipantId,
    occurredAt: input.publishedAt,
    payload: {
      initiativeId: input.initiativeId,
      title: input.title,
      actorParticipantId: input.actorParticipantId,
      actorLabel: input.actorLabel ?? null,
      lifecycleProfile: input.lifecycleProfile,
      electionTitle: input.electionTitle,
      publishedAt: input.publishedAt,
    },
  });
}

export async function emitInitiativePublished(input: {
  initiativeId: string;
  title: string;
  actorParticipantId: string;
  actorLabel?: string | null;
  lifecycleProfile: InitiativeLifecycleProfile;
  electionTitle: string;
  publishedAt: string;
}): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await enqueueDomainEvent(createInitiativePublishedEvent(input));
}
