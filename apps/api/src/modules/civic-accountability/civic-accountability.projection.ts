import type {
  CivicAccountability,
  CivicAccountabilityMetrics,
  PublicCivicAccountabilityEventItem,
  PublicCivicAccountabilityListItem,
  PublicCivicAccountabilityProjection,
} from "@hu/types";

import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { getDeliveryById, getRecipientById } from "../civic-delivery/civic-delivery.store.js";
import { getResponseById } from "../official-response/official-response.store.js";
import {
  getAccountabilityById,
  listAccountabilities,
  listAccountabilitiesByCapId,
  listAccountabilitiesByInitiative,
  listAccountabilitiesByResponseId,
  listEventsByAccountabilityId,
} from "./civic-accountability.store.js";

function buildReferenceLinks(accountability: CivicAccountability) {
  const delivery = accountability.deliveryId ? getDeliveryById(accountability.deliveryId) : null;
  const response = accountability.responseId ? getResponseById(accountability.responseId) : null;

  return {
    capUrl: `/civic-action-packages/public/${encodeURIComponent(accountability.capId)}`,
    initiativeUrl: `/initiatives/public/${encodeURIComponent(accountability.initiativeId)}`,
    decisionUrl: `/collective-decisions/public/${encodeURIComponent(accountability.decisionId)}`,
    deliveryUrl:
      delivery && delivery.status === "sent"
        ? `/civic-action-packages/public/${encodeURIComponent(accountability.capId)}#delivery-log`
        : null,
    responseUrl: response ? `/public-responses/${encodeURIComponent(response.responseId)}` : null,
  };
}

function toPublicEventItem(
  event: ReturnType<typeof listEventsByAccountabilityId>[number],
): PublicCivicAccountabilityEventItem {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    title: event.title,
    summary: event.summary,
    evidenceReference: event.evidenceReference,
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
  };
}

export function toPublicCivicAccountabilityListItem(
  accountability: CivicAccountability,
): PublicCivicAccountabilityListItem {
  const events = listEventsByAccountabilityId(accountability.accountabilityId);
  const latestEvent = events[0];

  return {
    accountabilityId: accountability.accountabilityId,
    capId: accountability.capId,
    initiativeId: accountability.initiativeId,
    status: accountability.status,
    eventCount: events.length,
    latestEventTitle: latestEvent?.title,
    latestEventSummary: latestEvent?.summary,
    latestEventOccurredAt: latestEvent?.occurredAt,
    createdAt: accountability.createdAt,
    updatedAt: accountability.updatedAt,
  };
}

export function toPublicCivicAccountabilityProjection(
  accountability: CivicAccountability,
): PublicCivicAccountabilityProjection {
  const recipient = accountability.recipientId
    ? getRecipientById(accountability.recipientId)
    : null;
  const response = accountability.responseId ? getResponseById(accountability.responseId) : null;
  const events = listEventsByAccountabilityId(accountability.accountabilityId).map((event) =>
    toPublicEventItem(event),
  );

  return {
    accountabilityId: accountability.accountabilityId,
    capId: accountability.capId,
    initiativeId: accountability.initiativeId,
    decisionId: accountability.decisionId,
    responseId: accountability.responseId,
    status: accountability.status,
    recipient: recipient
      ? {
          name: recipient.name,
          organization: recipient.organization,
          recipientType: recipient.recipientType,
        }
      : undefined,
    officialResponseNumber: response?.responseNumber,
    officialResponseOrganization: response?.organizationName,
    events,
    references: buildReferenceLinks(accountability),
    createdAt: accountability.createdAt,
    updatedAt: accountability.updatedAt,
  };
}

export function computeCivicAccountabilityMetrics(): CivicAccountabilityMetrics {
  const accountabilities = listAccountabilities();
  const events = accountabilities.flatMap((accountability) =>
    listEventsByAccountabilityId(accountability.accountabilityId),
  );

  const averageEventsPerAccountability =
    accountabilities.length > 0 ? events.length / accountabilities.length : 0;

  return {
    accountabilityCount: accountabilities.length,
    activeAccountabilityCount: accountabilities.filter((item) => item.status === "active").length,
    closedAccountabilityCount: accountabilities.filter((item) => item.status === "closed").length,
    archivedAccountabilityCount: accountabilities.filter((item) => item.status === "archived")
      .length,
    eventCount: events.length,
    averageEventsPerAccountability,
    noResponseObservedCount: events.filter((event) => event.eventType === "no_response_observed")
      .length,
    institutionActionReportedCount: events.filter(
      (event) => event.eventType === "institution_action_reported",
    ).length,
  };
}

export function getPublicCivicAccountability(
  accountabilityId: string,
): PublicCivicAccountabilityProjection | null {
  const accountability = getAccountabilityById(accountabilityId);

  if (!accountability) {
    return null;
  }

  return toPublicCivicAccountabilityProjection(accountability);
}

export function listPublicCivicAccountabilitiesForCap(
  capId: string,
  options?: { includeArchived?: boolean },
): PublicCivicAccountabilityListItem[] {
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    return [];
  }

  return listAccountabilitiesByCapId(capId)
    .filter((accountability) => options?.includeArchived || accountability.status !== "archived")
    .map((accountability) => toPublicCivicAccountabilityListItem(accountability));
}

export function listPublicCivicAccountabilitiesForInitiative(
  initiativeId: string,
  options?: { includeArchived?: boolean },
): PublicCivicAccountabilityListItem[] {
  return listAccountabilitiesByInitiative(initiativeId)
    .filter((accountability) => options?.includeArchived || accountability.status !== "archived")
    .map((accountability) => toPublicCivicAccountabilityListItem(accountability));
}

export function listPublicCivicAccountabilitiesForResponse(
  responseId: string,
  options?: { includeArchived?: boolean },
): PublicCivicAccountabilityListItem[] {
  return listAccountabilitiesByResponseId(responseId)
    .filter((accountability) => options?.includeArchived || accountability.status !== "archived")
    .map((accountability) => toPublicCivicAccountabilityListItem(accountability));
}

export function assertPublicProjectionHasNoPrivateFields(
  projection: PublicCivicAccountabilityProjection,
): boolean {
  const serialized = JSON.stringify(projection);

  return (
    !serialized.includes('"participantId"') &&
    !serialized.includes('"recordedByParticipantId"') &&
    !serialized.includes('"createdByParticipantId"') &&
    !serialized.includes('"verifiedByParticipantId"') &&
    !serialized.includes('"providerMetadata"') &&
    !serialized.includes('"messageHeaders"') &&
    !serialized.includes('"rawSource"') &&
    !serialized.includes('"replyToken"') &&
    !serialized.includes('"messageId"') &&
    !serialized.includes('"email"')
  );
}
