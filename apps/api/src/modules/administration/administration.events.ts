import type { AdministrationAuditRecord } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../infrastructure/events/event-envelope.js";
import { enqueueDomainEvent } from "../../infrastructure/outbox/outbox.repository.js";

/** Outbox integration — no second Admin event bus. */
export async function emitAdministrationAuditRecorded(
  record: AdministrationAuditRecord,
): Promise<void> {
  await enqueueDomainEvent(
    createDomainEvent({
      eventName: CATALOGUE_EVENTS.administrationAuditRecorded,
      aggregateType: "AdministrationAudit",
      aggregateId: record.auditId,
      actorId: record.actorParticipantId,
      payload: {
        auditId: record.auditId,
        action: record.action,
        targetType: record.targetType,
        targetId: record.targetId,
        scopeType: record.scope.scopeType,
        createdAt: record.createdAt,
        // Deliberately omit reason/summaries from event payload breadth — audit store is source of truth.
      },
    }),
  );
}
