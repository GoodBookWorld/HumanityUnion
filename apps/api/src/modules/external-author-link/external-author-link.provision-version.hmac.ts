import {
  INTEGRITY_MEDIA_ACCOUNT_PROVISION_VERSION_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
} from "./external-author-link.constants.js";

const seenVersionSignatures = new Map<string, number>();

export interface ProvisionVersionCanonicalFields {
  timestamp: string;
  attemptId: string;
  target: string;
}

/** Five lines, UTF-8, joined by newline, no trailing newline. Version line is exactly `2`. */
export function buildProvisionVersionPayload(input: ProvisionVersionCanonicalFields): string {
  return [
    INTEGRITY_MEDIA_ACCOUNT_PROVISION_VERSION_PURPOSE,
    input.timestamp,
    input.attemptId,
    input.target,
    "2",
  ].join("\n");
}

export function resetProvisionVersionReplayCacheForTests(): void {
  seenVersionSignatures.clear();
}

export function hasProvisionVersionSignature(signature: string, nowMs: number): boolean {
  const seenAt = seenVersionSignatures.get(signature);

  if (seenAt === undefined) {
    return false;
  }

  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenVersionSignatures.delete(signature);
    return false;
  }

  return true;
}

export function noteProvisionVersionSignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of seenVersionSignatures) {
    if (seenAt < cutoff) {
      seenVersionSignatures.delete(key);
    }
  }

  seenVersionSignatures.set(signature, nowMs);
}
