import { createHash } from "node:crypto";

import {
  INTEGRITY_MEDIA_ACCOUNT_PROVISION_SNAPSHOT_PURPOSE,
  INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS,
} from "./external-author-link.constants.js";

const seenSnapshotSignatures = new Map<string, number>();

export interface ProvisionSnapshotCanonicalFields {
  timestamp: string;
  attemptId: string;
  target: string;
  snapshot: string;
}

/** Six lines, UTF-8, joined by newline, no trailing newline. */
export function buildProvisionSnapshotPayload(input: ProvisionSnapshotCanonicalFields): string {
  return [
    INTEGRITY_MEDIA_ACCOUNT_PROVISION_SNAPSHOT_PURPOSE,
    input.timestamp,
    input.attemptId,
    input.target,
    "2",
    snapshotDigest(input.snapshot),
  ].join("\n");
}

export function snapshotDigest(snapshot: string): string {
  return createHash("sha256").update(snapshot, "utf8").digest("hex");
}

export function resetProvisionSnapshotReplayCacheForTests(): void {
  seenSnapshotSignatures.clear();
}

export function hasProvisionSnapshotSignature(signature: string, nowMs: number): boolean {
  const seenAt = seenSnapshotSignatures.get(signature);

  if (seenAt === undefined) {
    return false;
  }

  if (nowMs - seenAt > INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000) {
    seenSnapshotSignatures.delete(signature);
    return false;
  }

  return true;
}

export function noteProvisionSnapshotSignature(signature: string, nowMs: number): void {
  const cutoff = nowMs - INTEGRITY_MEDIA_REPLAY_WINDOW_SECONDS * 1000;

  for (const [key, seenAt] of seenSnapshotSignatures) {
    if (seenAt < cutoff) {
      seenSnapshotSignatures.delete(key);
    }
  }

  seenSnapshotSignatures.set(signature, nowMs);
}
