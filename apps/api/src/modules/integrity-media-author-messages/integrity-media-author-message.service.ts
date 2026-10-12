import { randomUUID } from "node:crypto";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { loadAuthUserForActiveGate } from "../auth/auth-active-account-gate.js";
import {
  isOrdinaryIntegrityMediaCollaborationAllowed,
  resolveIntegrityMediaCollaborationStatus,
} from "../external-author-link/external-author-link.collaboration.js";
import { INTEGRITY_MEDIA_SOURCE } from "../external-author-link/external-author-link.constants.js";
import { isIntegrityMediaAuthorLinkOperational } from "../external-author-link/external-author-link.service.js";
import { getExternalAuthorLinkStore } from "../external-author-link/external-author-link.store.js";
import {
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_PERMANENT_ERROR_CODES,
  INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS,
  type IntegrityMediaAuthorMessageErrorCode,
  type IntegrityMediaAuthorMessagePermanentErrorCode,
} from "./integrity-media-author-message.constants.js";
import {
  buildIntegrityMediaAuthorMessageCanonicalString,
  buildIntegrityMediaAuthorMessageCanonicalStringV2,
  hashIntegrityMediaAuthorMessageContent,
  integrityMediaAuthorMessageTimestamp,
  signIntegrityMediaAuthorMessage,
} from "./integrity-media-author-message.hmac.js";
import { getIntegrityMediaAuthorMessageStore } from "./integrity-media-author-message.store.js";
import {
  getIntegrityMediaAuthorMessageTransport,
  integrityMediaAuthorMessageTimeoutMs,
  resolveIntegrityMediaAuthorMessageEndpoint,
  type IntegrityMediaAuthorMessageHttpResult,
} from "./integrity-media-author-message.transport.js";
import type {
  IntegrityMediaAuthorMessageAuditRecord,
  IntegrityMediaAuthorMessageCta,
  IntegrityMediaAuthorMessageDeliveryView,
  IntegrityMediaAuthorMessageKind,
  IntegrityMediaAuthorMessageRecord,
} from "./integrity-media-author-message.types.js";
import {
  validateIntegrityMediaAuthorChatContent,
  validateIntegrityMediaAuthorMessageContent,
} from "./integrity-media-author-message.validation.js";

export interface IntegrityMediaAuthorMessageFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface IntegrityMediaAuthorMessageSuccess {
  ok: true;
  status: number;
  message: string;
  data: IntegrityMediaAuthorMessageDeliveryView;
}

const PERMANENT_ERROR_CODES = new Set<string>(INTEGRITY_MEDIA_AUTHOR_MESSAGE_PERMANENT_ERROR_CODES);

/**
 * Admin send. The recipient author id is read from the durable link.
 * The outbound row is inserted before any remote request.
 */
export async function sendIntegrityMediaAuthorMessage(input: {
  actorUserId: string;
  actorMemberId: string;
  recipientMemberId: string;
  title: unknown;
  body: unknown;
  cta: unknown;
  now?: Date;
}): Promise<IntegrityMediaAuthorMessageSuccess | IntegrityMediaAuthorMessageFailure> {
  const actorMemberId = await assertAdminActor(input.actorUserId, input.actorMemberId);
  const validated = validateIntegrityMediaAuthorMessageContent({
    title: input.title,
    body: input.body,
    cta: input.cta,
  });

  if (!validated.ok) {
    return failure(400, validated.code, validated.message);
  }

  const link = await resolveOperationalRecipient(input.recipientMemberId);

  if (!link.ok) {
    return link;
  }

  return enqueueOutboundAuthorMessage({
    actorMemberId,
    recipientMemberId: link.memberId,
    recipientExternalAuthorId: link.externalAuthorId,
    kind: "system",
    category: validated.value.category,
    title: validated.value.title,
    body: validated.value.body,
    cta: validated.value.cta,
    now: input.now,
  });
}

/**
 * Admin chat. Direction, kind, author id, and HMAC version are fixed here.
 * The browser supplies only the message body.
 */
export async function sendIntegrityMediaAuthorChat(input: {
  actorUserId: string;
  actorMemberId: string;
  recipientMemberId: string;
  body: unknown;
  now?: Date;
}): Promise<IntegrityMediaAuthorMessageSuccess | IntegrityMediaAuthorMessageFailure> {
  const actorMemberId = await assertAdminActor(input.actorUserId, input.actorMemberId);
  const validated = validateIntegrityMediaAuthorChatContent({ body: input.body });

  if (!validated.ok) {
    return failure(400, validated.code, validated.message);
  }

  const link = await resolveOperationalRecipient(input.recipientMemberId);

  if (!link.ok) {
    return link;
  }

  return enqueueOutboundAuthorMessage({
    actorMemberId,
    recipientMemberId: link.memberId,
    recipientExternalAuthorId: link.externalAuthorId,
    kind: "chat",
    category: validated.value.category,
    title: "",
    body: validated.value.body,
    cta: null,
    now: input.now,
  });
}

export async function deliverClaimedMessage(messageId: string, now: Date): Promise<void> {
  const claimed = await getIntegrityMediaAuthorMessageStore().claimNext({
    messageId,
    ...claimWindow(now),
  });

  if (!claimed) {
    return;
  }

  await performRemoteDelivery(claimed, now);
}

export async function performRemoteDelivery(
  claimed: IntegrityMediaAuthorMessageRecord,
  now: Date,
): Promise<void> {
  if (claimed.kind === "chat") {
    const gate = await assertChatStillDeliverable(claimed);

    if (!gate.ok) {
      await recordPermanentFailure(claimed.messageId, now, gate.code);
      return;
    }
  }

  const endpoint = resolveIntegrityMediaAuthorMessageEndpoint();

  if (!endpoint) {
    await getIntegrityMediaAuthorMessageStore().markTransient({
      messageId: claimed.messageId,
      nowIso: now.toISOString(),
      errorCode: "not_configured",
    });
    return;
  }

  const timestamp = integrityMediaAuthorMessageTimestamp(now);
  const ctaLabel = claimed.cta?.label ?? "";
  const ctaUrl = claimed.cta?.url ?? "";
  const contentSha256 = hashIntegrityMediaAuthorMessageContent({
    body: claimed.body,
    category: claimed.category,
    ctaLabel,
    ctaUrl,
    title: claimed.title,
  });
  const canonical =
    claimed.kind === "chat"
      ? buildIntegrityMediaAuthorMessageCanonicalStringV2({
          timestamp,
          messageId: claimed.messageId,
          recipientAuthorId: claimed.recipientExternalAuthorId,
          kind: "chat",
          contentSha256,
        })
      : buildIntegrityMediaAuthorMessageCanonicalString({
          timestamp,
          messageId: claimed.messageId,
          recipientAuthorId: claimed.recipientExternalAuthorId,
          contentSha256,
        });
  const signature = signIntegrityMediaAuthorMessage(endpoint.secret, canonical);
  const requestBody = buildRemoteBody(claimed);
  let result: IntegrityMediaAuthorMessageHttpResult;

  try {
    result = await getIntegrityMediaAuthorMessageTransport()({
      url: endpoint.url,
      body: requestBody,
      timestamp,
      signature,
      timeoutMs: integrityMediaAuthorMessageTimeoutMs(),
    });
  } catch {
    await markRetryable(claimed.messageId, now, "network");
    return;
  }

  const classified = classifyRemoteResult(result, {
    messageId: claimed.messageId,
    recipientAuthorId: claimed.recipientExternalAuthorId,
  });

  if (classified.outcome === "delivered") {
    try {
      const delivered = await getIntegrityMediaAuthorMessageStore().markDelivered({
        messageId: claimed.messageId,
        nowIso: now.toISOString(),
      });

      if (delivered) {
        await appendAudit({
          action: "integrity_media_message_delivered",
          messageId: delivered.messageId,
          actorMemberId: delivered.actorMemberId,
          recipientMemberId: delivered.recipientMemberId,
          recipientExternalAuthorId: delivered.recipientExternalAuthorId,
          errorCode: null,
          createdAt: now.toISOString(),
        });
      }
    } catch {
      // Remote acceptance is durable on Integrity Media. Leave this row pending.
    }

    return;
  }

  if (classified.outcome === "failed") {
    await recordPermanentFailure(claimed.messageId, now, classified.errorCode);
    return;
  }

  await markRetryable(claimed.messageId, now, classified.errorCode);
}

export async function requireIntegrityMediaAuthorMessageAdmin(
  actorUserId: string,
  actorMemberId: string,
): Promise<string> {
  return assertAdminActor(actorUserId, actorMemberId);
}

async function assertAdminActor(actorUserId: string, actorMemberId: string): Promise<string> {
  if (!actorUserId.trim() || !actorMemberId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  const user = await loadAuthUserForActiveGate(actorUserId);

  if (!user || user.status !== "active") {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }

  if (user.role !== "admin" || user.memberId !== actorMemberId) {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }

  return user.memberId;
}

async function enqueueOutboundAuthorMessage(input: {
  actorMemberId: string;
  recipientMemberId: string;
  recipientExternalAuthorId: string;
  kind: IntegrityMediaAuthorMessageKind;
  category: typeof INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY;
  title: string;
  body: string;
  cta: IntegrityMediaAuthorMessageCta | null;
  now?: Date;
}): Promise<IntegrityMediaAuthorMessageSuccess | IntegrityMediaAuthorMessageFailure> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const record: IntegrityMediaAuthorMessageRecord = {
    messageId: randomUUID(),
    destination: INTEGRITY_MEDIA_SOURCE,
    actorMemberId: input.actorMemberId,
    recipientMemberId: input.recipientMemberId,
    recipientExternalAuthorId: input.recipientExternalAuthorId,
    direction: "hu_to_im",
    kind: input.kind,
    category: input.category,
    title: input.title,
    body: input.body,
    cta: input.cta,
    status: "pending",
    attemptCount: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    deliveredAt: null,
    lastErrorCode: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const inserted = await getIntegrityMediaAuthorMessageStore().insert(record);

  if (inserted !== "inserted") {
    return failure(503, "unavailable", "The message could not be saved.");
  }

  await appendAudit({
    action: "integrity_media_message_requested",
    messageId: record.messageId,
    actorMemberId: record.actorMemberId,
    recipientMemberId: record.recipientMemberId,
    recipientExternalAuthorId: record.recipientExternalAuthorId,
    errorCode: null,
    createdAt: nowIso,
  });

  try {
    await deliverClaimedMessage(record.messageId, now);
  } catch {
    // The pending row remains. Reconciliation sends it again.
  }

  const current = await getIntegrityMediaAuthorMessageStore().findByMessageId(record.messageId);

  if (!current) {
    return failure(503, "unavailable", "The message could not be saved.");
  }

  return success(current);
}

/**
 * Chat only. A notification queued before a later block or disconnect keeps
 * the existing v1 retry behavior.
 */
async function assertChatStillDeliverable(
  record: IntegrityMediaAuthorMessageRecord,
): Promise<{ ok: true } | { ok: false; code: IntegrityMediaAuthorMessageErrorCode }> {
  const link = await resolveOperationalRecipient(record.recipientMemberId);

  if (!link.ok) {
    return { ok: false, code: deliveryStopCode(link.code) };
  }

  if (link.externalAuthorId !== record.recipientExternalAuthorId) {
    return { ok: false, code: "link_ineligible" };
  }

  return { ok: true };
}

function deliveryStopCode(code: string): IntegrityMediaAuthorMessageErrorCode {
  if (
    code === "link_missing" ||
    code === "link_disabled" ||
    code === "author_activation_pending" ||
    code === "collaboration_blocked" ||
    code === "collaboration_archived" ||
    code === "link_ineligible"
  ) {
    return code;
  }

  return "link_ineligible";
}

async function recordPermanentFailure(
  messageId: string,
  now: Date,
  errorCode: IntegrityMediaAuthorMessageErrorCode,
): Promise<void> {
  const failed = await getIntegrityMediaAuthorMessageStore().markFailed({
    messageId,
    nowIso: now.toISOString(),
    errorCode,
  });

  if (!failed) {
    return;
  }

  await appendAudit({
    action: "integrity_media_message_failed",
    messageId: failed.messageId,
    actorMemberId: failed.actorMemberId,
    recipientMemberId: failed.recipientMemberId,
    recipientExternalAuthorId: failed.recipientExternalAuthorId,
    errorCode,
    createdAt: now.toISOString(),
  });
}

async function resolveOperationalRecipient(
  memberId: string,
): Promise<
  | { ok: true; memberId: string; externalAuthorId: string }
  | IntegrityMediaAuthorMessageFailure
> {
  const trimmed = memberId.trim();

  if (!trimmed || /\s/.test(trimmed)) {
    return failure(400, "invalid_request", "The selected member is not valid.");
  }

  const link = await getExternalAuthorLinkStore().findLinkByMember(INTEGRITY_MEDIA_SOURCE, trimmed);

  if (!link) {
    return failure(404, "link_missing", "This member is not linked to Integrity Media.");
  }

  if (link.state === "disabled") {
    return failure(409, "link_disabled", "This Integrity Media collaboration is disconnected.");
  }

  if (!isIntegrityMediaAuthorLinkOperational(link)) {
    return failure(
      409,
      "author_activation_pending",
      "This Integrity Media collaboration is not ready for messaging.",
    );
  }

  if (link.memberId !== trimmed || !link.externalAuthorId) {
    return failure(409, "link_ineligible", "This Integrity Media collaboration is not eligible.");
  }

  if (!isOrdinaryIntegrityMediaCollaborationAllowed(link)) {
    const collaborationStatus = resolveIntegrityMediaCollaborationStatus(link);

    if (collaborationStatus === "blocked") {
      return failure(409, "collaboration_blocked", "This Integrity Media collaboration is blocked.");
    }

    if (collaborationStatus === "archived") {
      return failure(
        409,
        "collaboration_archived",
        "This Integrity Media collaboration is archived.",
      );
    }
  }

  return {
    ok: true,
    memberId: link.memberId,
    externalAuthorId: link.externalAuthorId,
  };
}

function buildRemoteBody(record: IntegrityMediaAuthorMessageRecord): string {
  const payload: {
    messageId: string;
    recipientAuthorId: string;
    category: typeof INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY;
    title: string;
    body: string;
    kind?: "chat";
    cta?: { label: string; url: string };
  } = {
    messageId: record.messageId,
    recipientAuthorId: record.recipientExternalAuthorId,
    category: INTEGRITY_MEDIA_AUTHOR_MESSAGE_CATEGORY,
    title: record.title,
    body: record.body,
  };

  if (record.kind === "chat") {
    payload.kind = "chat";
  }

  if (record.cta) {
    payload.cta = { label: record.cta.label, url: record.cta.url };
  }

  return JSON.stringify(payload);
}

function classifyRemoteResult(
  result: IntegrityMediaAuthorMessageHttpResult,
  expected: { messageId: string; recipientAuthorId: string },
):
  | { outcome: "delivered" }
  | { outcome: "failed"; errorCode: IntegrityMediaAuthorMessagePermanentErrorCode }
  | { outcome: "pending"; errorCode: IntegrityMediaAuthorMessageErrorCode } {
  if (result.kind === "timeout") {
    return { outcome: "pending", errorCode: "timeout" };
  }

  if (result.kind === "network") {
    return { outcome: "pending", errorCode: "network" };
  }

  const parsed = parseJsonObject(result.body);

  if (result.status >= 200 && result.status < 300) {
    if (!parsed || parsed.success !== true || !isRecord(parsed.data)) {
      return { outcome: "pending", errorCode: "malformed_response" };
    }

    if (
      parsed.data.messageId !== expected.messageId ||
      parsed.data.recipientAuthorId !== expected.recipientAuthorId
    ) {
      return { outcome: "pending", errorCode: "response_mismatch" };
    }

    if (typeof parsed.data.idempotent !== "boolean") {
      return { outcome: "pending", errorCode: "malformed_response" };
    }

    return { outcome: "delivered" };
  }

  if (result.status >= 500 || result.status === 408 || result.status === 429) {
    return { outcome: "pending", errorCode: "unavailable" };
  }

  const remoteCode = parsed && typeof parsed.error === "string" ? parsed.error : "";
  const errorCode = permanentCodeForStatus(result.status, remoteCode);
  return { outcome: "failed", errorCode };
}

function permanentCodeForStatus(
  status: number,
  remoteCode: string,
): IntegrityMediaAuthorMessagePermanentErrorCode {
  if (PERMANENT_ERROR_CODES.has(remoteCode)) {
    return remoteCode as IntegrityMediaAuthorMessagePermanentErrorCode;
  }

  if (status === 401) {
    return "invalid_signature";
  }

  if (status === 409) {
    return "remote_rejected";
  }

  if (status === 400) {
    return "invalid_request";
  }

  return "remote_rejected";
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function markRetryable(
  messageId: string,
  now: Date,
  errorCode: IntegrityMediaAuthorMessageErrorCode,
): Promise<void> {
  await getIntegrityMediaAuthorMessageStore().markTransient({
    messageId,
    nowIso: now.toISOString(),
    errorCode,
  });
}

function claimWindow(now: Date): { nowIso: string; backoffIso: string } {
  return {
    nowIso: now.toISOString(),
    backoffIso: new Date(now.getTime() + INTEGRITY_MEDIA_AUTHOR_MESSAGE_RECONCILE_BACKOFF_MS).toISOString(),
  };
}

async function appendAudit(
  input: Omit<IntegrityMediaAuthorMessageAuditRecord, "eventId">,
): Promise<void> {
  try {
    await getIntegrityMediaAuthorMessageStore().appendAudit({
      eventId: randomUUID(),
      ...input,
    });
  } catch {
    // Delivery state is the source of truth. Audit must not block it.
  }
}

function success(record: IntegrityMediaAuthorMessageRecord): IntegrityMediaAuthorMessageSuccess {
  return {
    ok: true,
    status: record.status === "pending" ? 202 : 200,
    message:
      record.status === "delivered"
        ? "Message delivered."
        : record.status === "failed"
          ? "Message delivery failed."
          : "Message accepted for delivery.",
    data: {
      messageId: record.messageId,
      status: record.status,
      recipientMemberId: record.recipientMemberId,
      attemptCount: record.attemptCount,
      lastErrorCode: record.lastErrorCode,
      deliveredAt: record.deliveredAt,
    },
  };
}

function failure(
  status: number,
  code: string,
  message: string,
): IntegrityMediaAuthorMessageFailure {
  return { ok: false, status, code, message };
}
