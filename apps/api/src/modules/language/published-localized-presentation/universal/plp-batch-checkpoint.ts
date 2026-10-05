/**
 * Durable PLP batch progress for one canonical source version.
 *
 * Stores normalized accepted machine segments only. No prompts, envelopes,
 * or raw provider bodies. The planner flushes a batch at 6 keys or 10_000
 * estimated output characters, and each provider request is capped at the
 * operator input byte limit (default 8_192). A published editorial PLP is a
 * few kilobytes. The caps below stay far under Mongo's 16MB document limit.
 */

import { createHash } from "node:crypto";

/** Accepted machine segments. Not a second queue. */
export const PLP_BATCH_CHECKPOINT_MAX_SEGMENTS = 512;
/** One segment cannot exceed the provider input cap plus translation expansion. */
export const PLP_BATCH_CHECKPOINT_MAX_SEGMENT_CHARS = 16_384;
/** Whole checkpoint text budget. 256KB, not the 16MB document ceiling. */
export const PLP_BATCH_CHECKPOINT_MAX_TOTAL_CHARS = 256_000;

export type PlpBatchCheckpoint = {
  readonly sourceVersion: string;
  readonly nextBatchIndex: number;
  readonly batchCount: number;
  readonly planFingerprint: string;
  readonly segments: Readonly<Record<string, string>>;
};

export function fingerprintPlpBatchPlan(
  batches: readonly (Readonly<Record<string, string>>)[],
): string {
  const body = batches
    .map((batch) => Object.keys(batch).sort().join("\n"))
    .join("\n---\n");
  return createHash("sha256").update(body).digest("hex").slice(0, 32);
}

export function plpBatchCheckpointWithinBounds(
  segments: Readonly<Record<string, string>>,
): boolean {
  const keys = Object.keys(segments);
  if (keys.length > PLP_BATCH_CHECKPOINT_MAX_SEGMENTS) {
    return false;
  }
  let total = 0;
  for (const key of keys) {
    const value = segments[key];
    if (typeof value !== "string") {
      return false;
    }
    if (key.length > 512 || value.length > PLP_BATCH_CHECKPOINT_MAX_SEGMENT_CHARS) {
      return false;
    }
    total += key.length + value.length;
    if (total > PLP_BATCH_CHECKPOINT_MAX_TOTAL_CHARS) {
      return false;
    }
  }
  return true;
}

export function resolvePlpBatchResume(input: {
  readonly sourceVersion: string;
  readonly batches: readonly (Readonly<Record<string, string>>)[];
  readonly checkpoint: PlpBatchCheckpoint | null;
}): {
  readonly nextBatchIndex: number;
  readonly segments: Readonly<Record<string, string>>;
} {
  const empty = { nextBatchIndex: 0, segments: {} as Readonly<Record<string, string>> };
  const checkpoint = input.checkpoint;
  if (!checkpoint) {
    return empty;
  }
  if (checkpoint.sourceVersion !== input.sourceVersion) {
    return empty;
  }
  if (checkpoint.batchCount !== input.batches.length) {
    return empty;
  }
  if (fingerprintPlpBatchPlan(input.batches) !== checkpoint.planFingerprint) {
    return empty;
  }
  if (
    !Number.isInteger(checkpoint.nextBatchIndex) ||
    checkpoint.nextBatchIndex < 0 ||
    checkpoint.nextBatchIndex > input.batches.length
  ) {
    return empty;
  }
  const expected = new Set<string>();
  for (let index = 0; index < checkpoint.nextBatchIndex; index += 1) {
    for (const key of Object.keys(input.batches[index] ?? {})) {
      expected.add(key);
    }
  }
  const storedKeys = Object.keys(checkpoint.segments);
  if (storedKeys.length !== expected.size) {
    return empty;
  }
  for (const key of storedKeys) {
    const value = checkpoint.segments[key];
    if (!expected.has(key) || typeof value !== "string" || value.trim().length === 0) {
      return empty;
    }
  }
  if (!plpBatchCheckpointWithinBounds(checkpoint.segments)) {
    return empty;
  }
  return {
    nextBatchIndex: checkpoint.nextBatchIndex,
    segments: checkpoint.segments,
  };
}

/**
 * A checkpoint can continue only when its identity matches this source
 * version and, when the live plan is known, the same fingerprint and keys
 * `resolvePlpBatchResume` would accept. `nextBatchIndex == batchCount` is a
 * complete provider checkpoint, not a corrupt one.
 */
export function isCompatiblePlpBatchCheckpoint(input: {
  readonly sourceVersion: string;
  readonly checkpoint: PlpBatchCheckpoint | null | undefined;
  readonly batches?: readonly (Readonly<Record<string, string>>)[];
}): boolean {
  const checkpoint = input.checkpoint;
  if (!checkpoint) {
    return false;
  }
  if (checkpoint.sourceVersion !== input.sourceVersion) {
    return false;
  }
  if (!/^[a-f0-9]{32}$/.test(checkpoint.planFingerprint)) {
    return false;
  }
  if (!Number.isInteger(checkpoint.batchCount) || checkpoint.batchCount < 1) {
    return false;
  }
  if (
    !Number.isInteger(checkpoint.nextBatchIndex) ||
    checkpoint.nextBatchIndex < 1 ||
    checkpoint.nextBatchIndex > checkpoint.batchCount
  ) {
    return false;
  }
  if (Object.keys(checkpoint.segments).length === 0) {
    return false;
  }
  if (!plpBatchCheckpointWithinBounds(checkpoint.segments)) {
    return false;
  }
  if (!input.batches) {
    return false;
  }
  const resume = resolvePlpBatchResume({
    sourceVersion: input.sourceVersion,
    batches: input.batches,
    checkpoint,
  });
  return resume.nextBatchIndex === checkpoint.nextBatchIndex && resume.nextBatchIndex > 0;
}

export function buildPlpBatchCheckpoint(input: {
  readonly sourceVersion: string;
  readonly nextBatchIndex: number;
  readonly batches: readonly (Readonly<Record<string, string>>)[];
  readonly segments: Readonly<Record<string, string>>;
}): PlpBatchCheckpoint | null {
  if (!plpBatchCheckpointWithinBounds(input.segments)) {
    return null;
  }
  return {
    sourceVersion: input.sourceVersion,
    nextBatchIndex: input.nextBatchIndex,
    batchCount: input.batches.length,
    planFingerprint: fingerprintPlpBatchPlan(input.batches),
    segments: { ...input.segments },
  };
}
