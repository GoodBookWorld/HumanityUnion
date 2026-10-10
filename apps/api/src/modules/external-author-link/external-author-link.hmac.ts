import { createHmac, timingSafeEqual } from "node:crypto";

import {
  INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
} from "./external-author-link.constants.js";

const seenRedeemSignatures = new Map<string, number>();

export function buildIntegrityMediaLinkRedeemPayload(input: {
  timestamp: string;
  resultCode: string;
  externalAuthorId: string;
  purpose?: string;
}): string {
  return [
    input.purpose ?? INTEGRITY_MEDIA_LINK_REDEEM_PURPOSE,
    input.timestamp,
    input.resultCode,
    input.externalAuthorId,
  ].join("\n");
}

export function signIntegrityMediaLinkRedeem(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function integrityMediaLinkSignaturesEqual(expectedHex: string, provided: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(provided) || !/^[0-9a-f]{64}$/.test(expectedHex)) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(provided, "hex");

  if (expected.length === 0 || expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function resetIntegrityMediaRedeemReplayCacheForTests(): void {
  seenRedeemSignatures.clear();
}

export function hasIntegrityMediaRedeemSignature(signature: string, nowMs: number): boolean {
  const seenAt = seenRedeemSignatures.get(signature);

  if (seenAt === undefined) {
    return false;
  }

  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenRedeemSignatures.delete(signature);
    return false;
  }

  return true;
}

export function noteIntegrityMediaRedeemSignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of seenRedeemSignatures) {
    if (seenAt < cutoff) {
      seenRedeemSignatures.delete(key);
    }
  }

  seenRedeemSignatures.set(signature, nowMs);
}
