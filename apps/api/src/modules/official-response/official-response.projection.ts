import type {
  OfficialResponse,
  OfficialResponseMetrics,
  OfficialResponseType,
  PublicOfficialResponseListItem,
  PublicOfficialResponseProjection,
} from "@hu/types";

import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { getDeliveryById } from "../civic-delivery/civic-delivery.store.js";
import {
  getResponseById,
  listResponses,
  listResponsesByCapId,
  listResponsesByInitiative,
} from "./official-response.store.js";

const RESPONSE_TYPES: OfficialResponseType[] = [
  "official_letter",
  "email",
  "public_statement",
  "meeting_minutes",
  "policy_update",
  "decision_notice",
  "media_response",
  "other",
];

function buildReferenceLinks(response: OfficialResponse) {
  const delivery = getDeliveryById(response.deliveryId);

  return {
    capUrl: `/civic-action-packages/public/${encodeURIComponent(response.capId)}`,
    initiativeUrl: `/initiatives/public/${encodeURIComponent(response.initiativeId)}`,
    decisionUrl: `/collective-decisions/public/${encodeURIComponent(response.decisionId)}`,
    deliveryUrl:
      delivery && delivery.status === "sent"
        ? `/civic-action-packages/public/${encodeURIComponent(response.capId)}#delivery-log`
        : null,
  };
}

export function toPublicOfficialResponseListItem(
  response: OfficialResponse,
): PublicOfficialResponseListItem {
  return {
    responseId: response.responseId,
    responseNumber: response.responseNumber,
    capId: response.capId,
    initiativeId: response.initiativeId,
    organizationName: response.organizationName,
    receivedAt: response.receivedAt,
    publishedAt: response.publishedAt,
    responseType: response.responseType,
    verificationState: response.verificationState,
    publicationStatus: response.publicationStatus,
    subject: response.subject,
    summary: response.summary,
  };
}

export function toPublicOfficialResponseProjection(
  response: OfficialResponse,
): PublicOfficialResponseProjection {
  return {
    responseId: response.responseId,
    responseNumber: response.responseNumber,
    capId: response.capId,
    deliveryId: response.deliveryId,
    initiativeId: response.initiativeId,
    decisionId: response.decisionId,
    organizationName: response.organizationName,
    receivedAt: response.receivedAt,
    publishedAt: response.publishedAt,
    subject: response.subject,
    summary: response.summary,
    responseReference: response.responseReference,
    responseType: response.responseType,
    verificationState: response.verificationState,
    publicationStatus: response.publicationStatus,
    references: buildReferenceLinks(response),
  };
}

export function computeOfficialResponseMetrics(): OfficialResponseMetrics {
  const responses = listResponses().filter((response) => response.publicationStatus !== "draft");
  const responseTypes = Object.fromEntries(RESPONSE_TYPES.map((type) => [type, 0])) as Record<
    OfficialResponseType,
    number
  >;

  for (const response of responses) {
    responseTypes[response.responseType] += 1;
  }

  const recipientIds = new Set(responses.map((response) => response.recipientId));

  return {
    responseCount: responses.length,
    verifiedResponseCount: responses.filter((response) => response.verificationState === "verified")
      .length,
    pendingResponseCount: responses.filter((response) => response.verificationState === "pending")
      .length,
    unableToVerifyCount: responses.filter(
      (response) => response.verificationState === "unable_to_verify",
    ).length,
    responseTypes,
    recipientCoverage: recipientIds.size,
  };
}

export function getPublicOfficialResponse(
  responseId: string,
): PublicOfficialResponseProjection | null {
  const response = getResponseById(responseId);

  if (!response || response.publicationStatus === "draft") {
    return null;
  }

  return toPublicOfficialResponseProjection(response);
}

export function listPublicOfficialResponsesForCap(capId: string): PublicOfficialResponseListItem[] {
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    return [];
  }

  return listResponsesByCapId(capId)
    .filter((response) => response.publicationStatus !== "draft")
    .map((response) => toPublicOfficialResponseListItem(response));
}

export function listPublicOfficialResponsesForInitiative(
  initiativeId: string,
): PublicOfficialResponseListItem[] {
  return listResponsesByInitiative(initiativeId)
    .filter((response) => response.publicationStatus !== "draft")
    .map((response) => toPublicOfficialResponseListItem(response));
}

export function assertPublicProjectionHasNoPrivateFields(
  projection: PublicOfficialResponseProjection,
): boolean {
  const serialized = JSON.stringify(projection);

  return (
    !serialized.includes('"participantId"') &&
    !serialized.includes('"recordedByParticipantId"') &&
    !serialized.includes('"verifiedByParticipantId"') &&
    !serialized.includes('"providerMetadata"') &&
    !serialized.includes('"messageHeaders"') &&
    !serialized.includes('"rawSource"') &&
    !serialized.includes('"replyToken"') &&
    !serialized.includes('"messageId"') &&
    !serialized.includes('"email"')
  );
}
