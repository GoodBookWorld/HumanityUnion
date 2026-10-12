import { createHmac } from "node:crypto";

import {
  INTEGRITY_MEDIA_AUTHOR_DISCONNECT_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
} from "./external-author-link.constants.js";
import { integrityMediaLinkSignaturesEqual } from "./external-author-link.hmac.js";

const seenDisconnectSignatures = new Map<string, number>();

/** purpose, timestamp, eventId, authorId. The member id is not part of the signed string. */
export function buildIntegrityMediaAuthorDisconnectCanonical(input: {
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
