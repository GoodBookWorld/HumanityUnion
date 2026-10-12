import { createHmac } from "node:crypto";

import {
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_INITIAL_PURPOSE,
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
} from "./external-author-link.constants.js";
import { integrityMediaLinkSignaturesEqual } from "./external-author-link.hmac.js";

const seenDisconnectSignatures = new Map<string, number>();

/**
 * Numbered generation: purpose, timestamp, eventId, authorId, linkRevision.
 * The member id is not part of the signed string. The revision is.
 */
export function buildIntegrityMediaAuthorDisconnectCanonical(input: {
  timestamp: string;
  eventId: string;
  authorId: string;
  linkRevision: number;
}): string {
  return [
    INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE,
    input.timestamp,
    input.eventId,
    input.authorId,
    String(input.linkRevision),
  ].join("\n");
}

/**
 * Legacy four-line canonical used only to recognize a signature from an IM
 * build that has not learned revisions. A matching signature is not accepted.
 */
export function buildLegacyIntegrityMediaAuthorDisconnectCanonical(input: {
  timestamp: string;
  eventId: string;
  authorId: string;
}): string {
  return [
    INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE,
    input.timestamp,
    input.eventId,
    input.authorId,
  ].join("\n");
}

/** Initial generation: a distinct purpose and no revision line. */
export function buildInitialIntegrityMediaAuthorDisconnectCanonical(input: {
  timestamp: string;
  eventId: string;
  authorId: string;
}): string {
  return [
    INTEGRITY_MEDIA_AUTHOR_DISCONNECT_INITIAL_PURPOSE,
    input.timestamp,
    input.eventId,
    input.authorId,
  ].join("\n");
}

export function signIntegrityMediaAuthorDisconnect(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function integrityMediaAuthorDisconnectSignaturesEqual(
  expectedHex: string,
  provided: string,
): boolean {
  return integrityMediaLinkSignaturesEqual(expectedHex, provided);
}

export function resetIntegrityMediaAuthorDisconnectReplayCacheForTests(): void {
  seenDisconnectSignatures.clear();
}

export function hasIntegrityMediaAuthorDisconnectSignature(signature: string, nowMs: number): boolean {
  const seenAt = seenDisconnectSignatures.get(signature);

  if (seenAt === undefined) {
    return false;
  }

  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenDisconnectSignatures.delete(signature);
    return false;
  }

  return true;
}

export function noteIntegrityMediaAuthorDisconnectSignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of seenDisconnectSignatures) {
    if (seenAt < cutoff) {
      seenDisconnectSignatures.delete(key);
    }
  }

  seenDisconnectSignatures.set(signature, nowMs);
}
