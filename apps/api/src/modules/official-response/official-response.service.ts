import type {
  OfficialResponse,
  OfficialResponseType,
  OfficialResponseVerificationState,
} from "@hu/types";
import { canTransitionOfficialResponsePublication } from "@hu/types";

import { getCapById } from "../civic-action-package/civic-action-package.store.js";
import { getDeliveryById, getRecipientById } from "../civic-delivery/civic-delivery.store.js";
import type { RequestIdentity } from "../initiatives/identity/request-identity.types.js";
import {
  assertInitiativeOwnership,
  isInitiativeOwnedBy,
} from "../initiatives/initiative-ownership.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { ensureOfficialResponseIdentity } from "./official-response-identity.js";
import { ensureAccountabilityFromResponse } from "../civic-accountability/civic-accountability-auto-start.js";
import {
  createResponse,
  getNextResponseNumber,
  getResponseById,
  listResponsesByRecorder,
  updateResponse,
} from "./official-response.store.js";

export interface CreateOfficialResponseDraftInput {
  capId: string;
  deliveryId: string;
  recipientId: string;
  organizationName: string;
  receivedAt: string;
  subject: string;
  summary: string;
  responseReference: string;
  responseType: OfficialResponseType;
  rawSource?: string;
  messageHeaders?: Record<string, string>;
  providerMetadata?: Record<string, unknown>;
}

export interface UpdateOfficialResponseDraftInput {
  organizationName?: string;
  receivedAt?: string;
  subject?: string;
  summary?: string;
  responseReference?: string;
  responseType?: OfficialResponseType;
  rawSource?: string;
  messageHeaders?: Record<string, string>;
  providerMetadata?: Record<string, unknown>;
}

function getOwnedDraftResponse(responseId: string, identity: RequestIdentity): OfficialResponse {
  const response = getResponseById(responseId);

  if (!response) {
    throw new Error("Official response not found.");
  }

  if (response.recordedByParticipantId !== identity.participantId) {
    throw new Error("You do not have access to this official response.");
  }

  if (response.publicationStatus !== "draft") {
    throw new Error("Only draft official responses can be modified.");
  }

  return response;
}

function assertCanRecordResponse(
  capId: string,
  deliveryId: string,
  recipientId: string,
): {
  capPackage: NonNullable<ReturnType<typeof getCapById>>;
  delivery: NonNullable<ReturnType<typeof getDeliveryById>>;
  recipient: NonNullable<ReturnType<typeof getRecipientById>>;
} {
  const capPackage = getCapById(capId);

  if (!capPackage || capPackage.status !== "issued") {
    throw new Error("Civic Action Package not found.");
  }

  const delivery = getDeliveryById(deliveryId);

  if (!delivery || delivery.capId !== capId || delivery.status !== "sent") {
    throw new Error("Sent civic delivery not found for this CAP.");
  }

  const recipient = getRecipientById(recipientId);

  if (!recipient || recipient.deliveryId !== deliveryId) {
    throw new Error("Delivery recipient not found.");
  }

  return { capPackage, delivery, recipient };
}

export function createOfficialResponseDraft(
  identity: RequestIdentity,
  input: CreateOfficialResponseDraftInput,
): OfficialResponse {
  const { capPackage, delivery } = assertCanRecordResponse(
    input.capId,
    input.deliveryId,
    input.recipientId,
  );
  const initiative = getInitiativeById(capPackage.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  const canRecord =
    isInitiativeOwnedBy(initiative, identity) ||
    delivery.senderParticipantId === identity.participantId;

  if (!canRecord) {
    throw new Error("You do not have access to record responses for this CAP.");
  }

  ensureOfficialResponseIdentity(capPackage.capId);

  const now = new Date().toISOString();

  const response: OfficialResponse = {
    responseId: `official-response-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    responseNumber: getNextResponseNumber(),
    capId: capPackage.capId,
    deliveryId: delivery.deliveryId,
    recipientId: input.recipientId,
    initiativeId: capPackage.initiativeId,
    decisionId: capPackage.decisionId,
    organizationName: input.organizationName.trim(),
    recordedByParticipantId: identity.participantId,
    receivedAt: input.receivedAt,
    subject: input.subject.trim(),
    summary: input.summary.trim(),
    responseReference: input.responseReference.trim(),
    responseType: input.responseType,
    verificationState: "pending",
    publicationStatus: "draft",
    rawSource: input.rawSource,
    messageHeaders: input.messageHeaders,
    providerMetadata: input.providerMetadata,
    createdAt: now,
    updatedAt: now,
  };

  return createResponse(response);
}

export function updateOfficialResponseDraft(
  identity: RequestIdentity,
  responseId: string,
  input: UpdateOfficialResponseDraftInput,
): OfficialResponse {
  const response = getOwnedDraftResponse(responseId, identity);
  const now = new Date().toISOString();

  const updated = updateResponse(response.responseId, {
    organizationName: input.organizationName?.trim() ?? response.organizationName,
    receivedAt: input.receivedAt ?? response.receivedAt,
    subject: input.subject?.trim() ?? response.subject,
    summary: input.summary?.trim() ?? response.summary,
    responseReference: input.responseReference?.trim() ?? response.responseReference,
    responseType: input.responseType ?? response.responseType,
    rawSource: input.rawSource ?? response.rawSource,
    messageHeaders: input.messageHeaders ?? response.messageHeaders,
    providerMetadata: input.providerMetadata ?? response.providerMetadata,
    updatedAt: now,
  });

  if (!updated) {
    throw new Error("Official response not found.");
  }

  return updated;
}

export function publishOfficialResponse(
  identity: RequestIdentity,
  responseId: string,
): OfficialResponse {
  const response = getOwnedDraftResponse(responseId, identity);

  if (!canTransitionOfficialResponsePublication(response.publicationStatus, "published")) {
    throw new Error("Official response cannot be published.");
  }

  const now = new Date().toISOString();
  const updated = updateResponse(responseId, {
    publicationStatus: "published",
    publishedAt: now,
    verificationState: "pending",
    updatedAt: now,
  });

  if (!updated) {
    throw new Error("Official response not found.");
  }

  ensureAccountabilityFromResponse(updated);

  return updated;
}

export function verifyOfficialResponse(
  identity: RequestIdentity,
  responseId: string,
  verificationState: Extract<OfficialResponseVerificationState, "verified" | "unable_to_verify">,
): OfficialResponse {
  const response = getResponseById(responseId);

  if (!response) {
    throw new Error("Official response not found.");
  }

  if (response.publicationStatus !== "published") {
    throw new Error("Only published official responses can be verified.");
  }

  const initiative = getInitiativeById(response.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  if (response.verificationState !== "pending") {
    throw new Error("Official response verification state is already final.");
  }

  const now = new Date().toISOString();
  const updated = updateResponse(responseId, {
    verificationState,
    verifiedAt: now,
    verifiedByParticipantId: identity.participantId,
    updatedAt: now,
  });

  if (!updated) {
    throw new Error("Official response not found.");
  }

  return updated;
}

export function archiveOfficialResponse(
  identity: RequestIdentity,
  responseId: string,
): OfficialResponse {
  const response = getResponseById(responseId);

  if (!response) {
    throw new Error("Official response not found.");
  }

  const initiative = getInitiativeById(response.initiativeId);

  if (!initiative) {
    throw new Error("Initiative not found.");
  }

  assertInitiativeOwnership(initiative, identity);

  if (!canTransitionOfficialResponsePublication(response.publicationStatus, "archived")) {
    throw new Error("Official response cannot be archived.");
  }

  const now = new Date().toISOString();
  const updated = updateResponse(responseId, {
    publicationStatus: "archived",
    archivedAt: now,
    updatedAt: now,
  });

  if (!updated) {
    throw new Error("Official response not found.");
  }

  return updated;
}

export function getMyOfficialResponse(
  identity: RequestIdentity,
  responseId: string,
): OfficialResponse | null {
  const response = getResponseById(responseId);

  if (!response || response.recordedByParticipantId !== identity.participantId) {
    return null;
  }

  return response;
}

export function listMyOfficialResponses(identity: RequestIdentity): OfficialResponse[] {
  return listResponsesByRecorder(identity.participantId);
}
