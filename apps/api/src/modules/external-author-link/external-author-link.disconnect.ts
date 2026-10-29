import { randomUUID } from "node:crypto";

import {
  INTEGRITY_MEDIA_AUTHOR_ID_PATTERN,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
  INTEGRITY_MEDIA_SOURCE,
} from "./external-author-link.constants.js";
import {
  buildInitialIntegrityMediaAuthorDisconnectCanonical,
  buildIntegrityMediaAuthorDisconnectCanonical,
  buildLegacyIntegrityMediaAuthorDisconnectCanonical,
  hasIntegrityMediaAuthorDisconnectSignature,
  integrityMediaAuthorDisconnectSignaturesEqual,
  noteIntegrityMediaAuthorDisconnectSignature,
  signIntegrityMediaAuthorDisconnect,
} from "./external-author-link.disconnect-hmac.js";
import {
  AUTHOR_DELETION_PENDING_MESSAGE,
  integrityMediaAuthorDeletionBlocks,
} from "./external-author-link.author-deletion.js";
import { assignedLinkRevision } from "./external-author-link.revision.js";
import { getExternalAuthorLinkStore } from "./external-author-link.store.js";
import type {
  ExternalAuthorDisconnectEventRecord,
  ExternalAuthorLinkRecord,
} from "./external-author-link.types.js";

export interface IntegrityMediaAuthorDisconnectSuccess {
  ok: true;
  eventId: string;
  authorId: string;
  state: "disabled" | "linked";
  idempotent: boolean;
  superseded: boolean;
  linkRevision: number;
}

export interface IntegrityMediaAuthorDisconnectFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export type IntegrityMediaAuthorDisconnectProtocol =
  | { kind: "legacy" }
  | { kind: "initial" }
  | { kind: "numbered"; linkRevision: number };

/**
 * Trusted IM → HU disconnect. The member id is resolved from the stored link.
 * collaborationStatus, the identity pair, Blog capability, and messages stay in place.
 *
 * A matching disable and the event row are not one storage transaction. The
 * conditional disable runs first. If the process stops before the event row is
 * stored, a retry disables the same generation again and then stores the event.
 * A retry after the event row exists does not write a second audit. This is
 * not exactly-once processing.
 */
export async function acceptIntegrityMediaAuthorDisconnect(input: {
  eventId: string;
  authorId: string;
  timestamp: string;
  signature: string;
  secret: string | null;
  protocol: IntegrityMediaAuthorDisconnectProtocol;
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
  const canonical = canonicalFor(input);
  const expected = signIntegrityMediaAuthorDisconnect(input.secret, canonical);

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

  if (input.protocol.kind === "legacy") {
    return failure(
      503,
      "revision_required",
      "This disconnect does not name a connection generation.",
    );
  }

  const requestedRevision = input.protocol.kind === "numbered" ? input.protocol.linkRevision : null;
  const casRevision = requestedRevision ?? 1;
  const store = getExternalAuthorLinkStore();
  const known = await store.findDisconnectEvent(input.eventId);

  if (known) {
    if (known.externalAuthorId !== input.authorId || known.linkRevision !== requestedRevision) {
      return failure(409, "event_conflict", "This disconnect event is already bound to another request.");
    }

    const current = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.authorId);
    if (!current) {
      if (await integrityMediaAuthorDeletionBlocks(input.authorId)) {
        return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
      }
      return failure(404, "link_not_found", "No Integrity Media author link exists for this author.");
    }

    if (await integrityMediaAuthorDeletionBlocks(input.authorId, current)) {
      return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
    }

    return truthful(input, current, true);
  }

  const link = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.authorId);

  if (!link) {
    if (await integrityMediaAuthorDeletionBlocks(input.authorId)) {
      return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
    }
    return failure(404, "link_not_found", "No Integrity Media author link exists for this author.");
  }

  if (await integrityMediaAuthorDeletionBlocks(input.authorId, link)) {
    return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
  }

  const updated = await store.compareAndDisableLink({
    source: INTEGRITY_MEDIA_SOURCE,
    externalAuthorId: link.externalAuthorId,
    memberId: link.memberId,
    linkRevision: casRevision,
    nowIso: now.toISOString(),
  });

  if (updated === "missing") {
    if (await integrityMediaAuthorDeletionBlocks(input.authorId)) {
      return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
    }
    return failure(404, "link_not_found", "No Integrity Media author link exists for this author.");
  }

  if (updated === "stale") {
    const current = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.authorId);
    if (!current) {
      if (await integrityMediaAuthorDeletionBlocks(input.authorId)) {
        return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
      }
      return failure(404, "link_not_found", "No Integrity Media author link exists for this author.");
    }

    if (await integrityMediaAuthorDeletionBlocks(input.authorId, current)) {
      return failure(409, "author_deletion_pending", AUTHOR_DELETION_PENDING_MESSAGE);
    }

    const assigned = assignedLinkRevision(current.linkRevision);
    if (assigned !== null && assigned > casRevision) {
      const recorded = await recordEvent(store, {
        eventId: input.eventId,
        externalAuthorId: current.externalAuthorId,
        memberId: current.memberId,
        linkRevision: requestedRevision,
        outcome: "superseded",
        createdAt: now.toISOString(),
      });

      if (recorded === "failed") {
        return failure(503, "unavailable", "The disconnect event could not be saved.");
      }

      if (recorded === "conflict") {
        return failure(409, "event_conflict", "This disconnect event is already bound to another request.");
      }

      if (recorded === "inserted") {
        await audit(store, current, "superseded", now);
      }

      const after = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.authorId);
      return truthful(input, after ?? current, recorded !== "inserted");
    }

    return failure(
      409,
      "revision_conflict",
      "The disconnect names a connection generation that is not current.",
    );
  }

  const recorded = await recordEvent(store, {
    eventId: input.eventId,
    externalAuthorId: link.externalAuthorId,
    memberId: link.memberId,
    linkRevision: requestedRevision,
    outcome: "disabled",
    createdAt: now.toISOString(),
  });

  if (recorded === "failed") {
    return failure(503, "unavailable", "The disconnect event could not be saved.");
  }

  if (recorded === "conflict") {
    return failure(409, "event_conflict", "This disconnect event is already bound to another request.");
  }

  if (recorded === "inserted") {
    await audit(store, link, link.state === "disabled" ? "already_disabled" : "disabled", now);
  }

  const after = await store.findLinkByAuthor(INTEGRITY_MEDIA_SOURCE, input.authorId);
  if (!after) {
    return failure(503, "unavailable", "The Integrity Media author link could not be read.");
  }

  return truthful(input, after, recorded !== "inserted");
}

function canonicalFor(input: {
  eventId: string;
  authorId: string;
  timestamp: string;
  protocol: IntegrityMediaAuthorDisconnectProtocol;
}): string {
  if (input.protocol.kind === "numbered") {
    return buildIntegrityMediaAuthorDisconnectCanonical({
      timestamp: input.timestamp,
      eventId: input.eventId,
      authorId: input.authorId,
      linkRevision: input.protocol.linkRevision,
    });
  }

  if (input.protocol.kind === "initial") {
    return buildInitialIntegrityMediaAuthorDisconnectCanonical({
      timestamp: input.timestamp,
      eventId: input.eventId,
      authorId: input.authorId,
    });
  }

  return buildLegacyIntegrityMediaAuthorDisconnectCanonical({
    timestamp: input.timestamp,
    eventId: input.eventId,
    authorId: input.authorId,
  });
}

function truthful(
  input: { eventId: string; authorId: string; protocol: IntegrityMediaAuthorDisconnectProtocol },
  link: ExternalAuthorLinkRecord,
  idempotent: boolean,
): IntegrityMediaAuthorDisconnectSuccess {
  const assigned = assignedLinkRevision(link.linkRevision);
  const baseline = input.protocol.kind === "numbered" ? input.protocol.linkRevision : 1;
  const superseded = assigned !== null && assigned > baseline;

  return {
    ok: true,
    eventId: input.eventId,
    authorId: input.authorId,
    state: link.state,
    idempotent,
    superseded,
    linkRevision: assigned ?? baseline,
  };
}

async function recordEvent(
  store: ReturnType<typeof getExternalAuthorLinkStore>,
  record: ExternalAuthorDisconnectEventRecord,
): Promise<"inserted" | "idempotent" | "conflict" | "failed"> {
  try {
    const inserted = await store.insertDisconnectEvent(record);
    if (inserted === "inserted") {
      return "inserted";
    }
  } catch {
    return "failed";
  }

  const winner = await store.findDisconnectEvent(record.eventId);
  if (!winner) {
    return "failed";
  }

  if (winner.externalAuthorId !== record.externalAuthorId || winner.linkRevision !== record.linkRevision) {
    return "conflict";
  }

  return "idempotent";
}

async function audit(
  store: ReturnType<typeof getExternalAuthorLinkStore>,
  link: ExternalAuthorLinkRecord,
  reason: string,
  now: Date,
): Promise<void> {
  try {
    await store.appendAudit({
      eventId: randomUUID(),
      action: "integrity_media_disconnect_accepted",
      source: INTEGRITY_MEDIA_SOURCE,
      memberId: link.memberId,
      externalAuthorId: link.externalAuthorId,
      attemptStateHash: null,
      reason,
      createdAt: now.toISOString(),
    });
  } catch {
    // The link change and event id are already durable. A retry does not write another audit.
  }
}

function failure(
  status: number,
  code: string,
  message: string,
): IntegrityMediaAuthorDisconnectFailure {
  return { ok: false, status, code, message };
}
