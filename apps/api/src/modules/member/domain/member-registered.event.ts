import { CATALOGUE_EVENTS } from "../../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../infrastructure/events/event-envelope.js";
import type { DomainEvent } from "../../../infrastructure/events/domain-event.js";
import type { PersistedMemberRecord } from "./member.types.js";

export const MEMBER_AGGREGATE_TYPE = "Member" as const;

export interface MemberRegisteredPayload extends Record<string, unknown> {
  memberId: string;
  identityId: string;
  displayName: string;
  uniqueName: string;
  verificationLevel: PersistedMemberRecord["verificationLevel"];
  registeredAt: string;
}

export function buildMemberRegisteredEventId(memberId: string): string {
  return `member-registered:${memberId}`;
}

export function createMemberRegisteredEvent(input: {
  member: PersistedMemberRecord;
  correlationId?: string;
  actorId?: string | null;
  occurredAt?: string;
}): DomainEvent<MemberRegisteredPayload> {
  const occurredAt = input.occurredAt ?? input.member.createdAt;

  return createDomainEvent({
    eventId: buildMemberRegisteredEventId(input.member.memberId),
    eventName: CATALOGUE_EVENTS.memberRegistered,
    aggregateType: MEMBER_AGGREGATE_TYPE,
    aggregateId: input.member.memberId,
    payload: {
      memberId: input.member.memberId,
      identityId: input.member.identityId,
      displayName: input.member.displayName,
      uniqueName: input.member.uniqueName,
      verificationLevel: input.member.verificationLevel,
      registeredAt: occurredAt,
    },
    correlationId: input.correlationId,
    actorId: input.actorId ?? input.member.identityId,
    occurredAt,
  });
}
