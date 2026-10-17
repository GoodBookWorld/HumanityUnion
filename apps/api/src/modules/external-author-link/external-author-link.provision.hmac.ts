import { INTEGRITY_MEDIA_ACCOUNT_PROVISION_ATTEMPT_PURPOSE } from "./external-author-link.constants.js";
import { INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS } from "./external-author-link.constants.js";

const seenProvisionSignatures = new Map<string, number>();

export interface ProvisionCanonicalFields {
  timestamp: string;
  attemptId: string;
  externalAuthorId: string;
  email: string;
  displayName: string;
  target: string;
  expiresAt: string;
  returnPath: string;
  emailVerification: string;
}

/** Ten lines, UTF-8, joined by newline, no trailing newline. */
export function buildProvisionAttemptPayload(input: ProvisionCanonicalFields): string {
  return [
    INTEGRITY_MEDIA_ACCOUNT_PROVISION_ATTEMPT_PURPOSE,
    input.timestamp,
    input.attemptId,
    input.externalAuthorId,
    input.email,
    input.displayName,
    input.target,
    input.expiresAt,
    input.returnPath,
    input.emailVerification,
  ].join("\n");
}

export function resetProvisionAttemptReplayCacheForTests(): void {
  seenProvisionSignatures.clear();
}

export function hasProvisionAttemptSignature(signature: string, nowMs: number): boolean {
  const seenAt = seenProvisionSignatures.get(signature);

  if (seenAt === undefined) {
    return false;
  }

  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenProvisionSignatures.delete(signature);
    return false;
  }

  return true;
}

export function noteProvisionAttemptSignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of seenProvisionSignatures) {
    if (seenAt < cutoff) {
      seenProvisionSignatures.delete(key);
    }
  }

  seenProvisionSignatures.set(signature, nowMs);
}
