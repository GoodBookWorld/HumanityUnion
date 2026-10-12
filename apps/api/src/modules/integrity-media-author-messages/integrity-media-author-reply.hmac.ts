import { createHash, createHmac } from "node:crypto";

import {
  INTEGRITY_MEDIA_AUTHOR_REPLY_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
} from "../external-author-link/external-author-link.constants.js";
import { integrityMediaLinkSignaturesEqual } from "../external-author-link/external-author-link.hmac.js";

const seenReplySignatures = new Map<string, number>();

/**
 * IM-HU.04C.3F.2 contract for the future Integrity Media sender.
 *
 * Purpose: integrity-media-author-reply
 * Headers: x-im-hu-timestamp, x-im-hu-signature
 * Secret: the existing shared link secret
 * Signature: lowercase hex HMAC-SHA256 of the canonical string
 * Freshness: ±300 seconds
 *
 * Canonical string, eight lines joined by "\n" (not "\r\n"):
 * 1. purpose
 * 2. timestamp — exactly 10 decimal digits, Unix seconds
 * 3. messageId
 * 4. authorId
 * 5. memberId
 * 6. linkRevision — decimal integer, no padding
 * 7. replyToMessageId — the UUID, or an empty line when absent
 * 8. contentSha256
 *
 * contentSha256 is lowercase hex SHA-256 of the UTF-8 JSON object
 * {"body":"<trimmed body>"} with that single key. Trim with String.trim
 * before hashing. Send the trimmed body. Kind is not part of the hash.
 * Direction and kind are not accepted from the client.
 */

export function buildIntegrityMediaAuthorReplyContentPayload(body: string): string {
  return JSON.stringify({ body });
}

export function hashIntegrityMediaAuthorReplyContent(body: string): string {
  return createHash("sha256")
    .update(buildIntegrityMediaAuthorReplyContentPayload(body), "utf8")
    .digest("hex");
}

export function buildIntegrityMediaAuthorReplyCanonical(input: {
  timestamp: string;
  messageId: string;
  authorId: string;
  memberId: string;
  linkRevision: number;
  replyToMessageId: string;
  contentSha256: string;
}): string {
  return [
    INTEGRITY_MEDIA_AUTHOR_REPLY_PURPOSE,
    input.timestamp,
    input.messageId,
    input.authorId,
    input.memberId,
    String(input.linkRevision),
    input.replyToMessageId,
    input.contentSha256,
  ].join("\n");
}

export function signIntegrityMediaAuthorReply(secret: string, canonical: string): string {
  return createHmac("sha256", secret).update(canonical).digest("hex");
}

export function integrityMediaAuthorReplySignaturesEqual(
  expectedHex: string,
  provided: string,
): boolean {
  return integrityMediaLinkSignaturesEqual(expectedHex, provided);
}

export function resetIntegrityMediaAuthorReplyReplayCacheForTests(): void {
  seenReplySignatures.clear();
}

export function hasIntegrityMediaAuthorReplySignature(signature: string, nowMs: number): boolean {
  const seenAt = seenReplySignatures.get(signature);

  if (seenAt === undefined) {
    return false;
  }

  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenReplySignatures.delete(signature);
    return false;
  }

  return true;
}

export function noteIntegrityMediaAuthorReplySignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of seenReplySignatures) {
    if (seenAt < cutoff) {
      seenReplySignatures.delete(key);
    }
  }

  seenReplySignatures.set(signature, nowMs);
}
