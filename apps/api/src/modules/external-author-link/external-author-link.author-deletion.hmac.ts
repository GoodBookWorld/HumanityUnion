import { createHmac } from "node:crypto";

import {
  INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
} from "./external-author-link.constants.js";
import { integrityMediaLinkSignaturesEqual } from "./external-author-link.hmac.js";

const seenDeletionSignatures = new Map<string, number>();

/**
 * purpose, timestamp, operationId, authorId, huTarget, expectedMemberId,
 * expectedLinkRevision, expectedLinkInstanceId.
 * expectedLinkInstanceId is the uuid or the literal "absent".
 */
export function buildIntegrityMediaAuthorDeletionPayload(input: {
  timestamp: string;
  operationId: string;
  authorId: string;
  huTarget: string;
  expectedMemberId: string;
  expectedLinkRevision: number;
  expectedLinkInstanceId: string;
}): string {
  return [
    INTEGRITY_MEDIA_AUTHOR_DELETION_PURPOSE,
    input.timestamp,
    input.operationId,
    input.authorId,
    input.huTarget,
    input.expectedMemberId,
    String(input.expectedLinkRevision),
    input.expectedLinkInstanceId,
  ].join("\n");
}

export function signIntegrityMediaAuthorDeletion(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function integrityMediaAuthorDeletionSignaturesEqual(
  expectedHex: string,
  provided: string,
): boolean {
  return integrityMediaLinkSignaturesEqual(expectedHex, provided);
}

export function resetIntegrityMediaAuthorDeletionReplayCacheForTests(): void {
  seenDeletionSignatures.clear();
}

export function hasIntegrityMediaAuthorDeletionSignature(signature: string, nowMs: number): boolean {
  const seenAt = seenDeletionSignatures.get(signature);

  if (seenAt === undefined) {
    return false;
  }

  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenDeletionSignatures.delete(signature);
    return false;
  }

  return true;
}

export function forgetIntegrityMediaAuthorDeletionSignature(signature: string): void {
  seenDeletionSignatures.delete(signature);
}

export function noteIntegrityMediaAuthorDeletionSignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of seenDeletionSignatures) {
    if (seenAt < cutoff) {
      seenDeletionSignatures.delete(key);
    }
  }

  seenDeletionSignatures.set(signature, nowMs);
}
