import { randomUUID } from "node:crypto";

import {
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import {
  buildIntegrityMediaAuthorDisconnectCanonical,
  hasIntegrityMediaAuthorDisconnectSignature,
  integrityMediaAuthorDisconnectSignaturesEqual,
  noteIntegrityMediaAuthorDisconnectSignature,
  signIntegrityMediaAuthorDisconnect,
} from "./external-author-link.disconnect-hmac.js";
import { getExternalAuthorLinkStore } from "./external-author-link.store.js";

export interface IntegrityMediaAuthorDisconnectSuccess {
  ok: true;
  eventId: string;
  authorId: string;
  state: "disabled";
  idempotent: boolean;
}

export interface IntegrityMediaAuthorDisconnectFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

/**
 * Trusted IM → HU disconnect. The member id is resolved from the stored link.
 * collaborationStatus, the identity pair, Blog capability, and messages stay in place.
 */
export async function acceptIntegrityMediaAuthorDisconnect(input: {
  eventId: string;
  authorId: string;
  timestamp: string;
  signature: string;
  secret: string | null;
  now?: Date;
}): Promise<IntegrityMediaAuthorDisconnectSuccess | IntegrityMediaAuthorDisconnectFailure> {
  if (
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.eventId) ||
    !INTEGRITY_MEDIA_AUTHOR_ID_PATTERN.test(input.authorId) ||
    !/^\d{10}$/.test(input.timestamp)
  ) {
    return failure(400, "invalid_request", "The disconnect request is not valid.");
  }

  if (!input.secret) {
    return failure(503, "unavailable", "Integrity Media disconnect is not configured.");
  }

  const now = input.now ?? new Date();
  const expected = signIntegrityMediaAuthorDisconnect(
    input.secret,
    buildIntegrityMediaAuthorDisconnectCanonical({
      timestamp: input.timestamp,
      eventId: input.eventId,
      authorId: input.authorId,
    }),
  );

  if (!integrityMediaAuthorDisconnectSignaturesEqual(expected, input.signature)) {
    return failure(401, "invalid_signature", "The disconnect signature is not valid.");
  }

  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS) {
    return failure(401, "stale_timestamp", "The disconnect timestamp is outside the allowed window.");
  }

  if (hasIntegrityMediaAuthorDisconnectSignature(input.signature, now.getTime())) {
    return failure(401, "replayed", "This disconnect request was already used.");
  }

  noteIntegrityMediaAuthorDisconnectSignature(input.signature, now.getTime());

  const store = getExternalAuthorLinkStore();
  const known = await store.findDisconnectEvent(input.eventId);

  if (known) {
    if (known.externalAuthorId !== input.authorId) {
      return failure(409, "event_conflict", "This disconnect event is already bound to another author.");
    }

    return {
      ok: true,
      eventId: input.eventId,
      authorId: input.authorId,
      state: "disabled",
      idempotent: true,
    };
  }

  const link = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.authorId);

  if (!link) {
    return failure(404, "link_not_found", "No Integrity Media author link exists for this author.");
  }

  const transitioned = link.state !== "disabled";
  const updated = await store.updateLink({
    ...link,
    state: "disabled",
    disconnectedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  if (updated !== "updated") {
    return failure(503, "unavailable", "The Integrity Media author link could not be updated.");
  }

  const inserted = await store.insertDisconnectEvent({
    eventId: input.eventId,
    externalAuthorId: link.externalAuthorId,
    memberId: link.memberId,
    createdAt: now.toISOString(),
  });

  if (inserted === "duplicate") {
    const winner = await store.findDisconnectEvent(input.eventId);

    if (!winner) {
      return failure(503, "unavailable", "The disconnect event could not be saved.");
    }

    if (winner.externalAuthorId !== input.authorId) {
      return failure(409, "event_conflict", "This disconnect event is already bound to another author.");
    }

    return {
      ok: true,
      eventId: input.eventId,
      authorId: input.authorId,
      state: "disabled",
      idempotent: true,
    };
  }

  try {
    await store.appendAudit({
      eventId: randomUUID(),
      action: "integrity_media_disconnect_accepted",
      source: INTEGRITY_MEDIA_SOURCE,
      memberId: link.memberId,
      externalAuthorId: link.externalAuthorId,
      attemptStateHash: null,
      reason: transitioned ? "disabled" : "already_disabled",
      createdAt: now.toISOString(),
    });
  } catch {
    // The link disable and event id are already durable. A retry is idempotent.
  }

  return {
    ok: true,
    eventId: input.eventId,
    authorId: input.authorId,
    state: "disabled",
    idempotent: false,
  };
}

function failure(
  status: number,
  code: string,
  message: string,
): IntegrityMediaAuthorDisconnectFailure {
  return { ok: false, status, code, message };
}
