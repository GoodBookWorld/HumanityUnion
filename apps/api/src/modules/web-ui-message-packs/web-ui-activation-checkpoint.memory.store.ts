/**
 * In-memory WEB_UI activation checkpoint + batch store (tests / non-Mongo).
 */

import type {
  WebUiActivationBatchRecord,
  WebUiActivationCheckpointRecord,
} from "@hu/types";

const checkpoints = new Map<string, WebUiActivationCheckpointRecord>();
const batches = new Map<string, WebUiActivationBatchRecord>();

function batchKey(checkpointId: string, batchId: string, phase: string): string {
  return `${checkpointId}::${phase}::${batchId}`;
}

export function resetWebUiActivationCheckpointMemoryForTests(): void {
  checkpoints.clear();
  batches.clear();
}

export function upsertWebUiActivationCheckpointMemory(
  record: WebUiActivationCheckpointRecord,
): WebUiActivationCheckpointRecord {
  checkpoints.set(record.checkpointId, record);
  return record;
}

export function getWebUiActivationCheckpointMemory(
  checkpointId: string,
): WebUiActivationCheckpointRecord | null {
  return checkpoints.get(checkpointId) ?? null;
}

export function getWebUiActivationCheckpointByJobMemory(
  jobId: string,
): WebUiActivationCheckpointRecord | null {
  const rows = [...checkpoints.values()].filter((row) => row.jobId === jobId);
  rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows[0] ?? null;
}

export function listIncompleteWebUiActivationCheckpointsMemory(): readonly WebUiActivationCheckpointRecord[] {
  return [...checkpoints.values()].filter(
    (row) =>
      row.phase === "primary" ||
      row.phase === "quality" ||
      row.phase === "validating" ||
      row.phase === "publishing",
  );
}

export function upsertWebUiActivationBatchMemory(
  record: WebUiActivationBatchRecord,
): WebUiActivationBatchRecord {
  batches.set(batchKey(record.checkpointId, record.batchId, record.phase), record);
  return record;
}

export function getWebUiActivationBatchMemory(input: {
  readonly checkpointId: string;
  readonly batchId: string;
  readonly phase: string;
}): WebUiActivationBatchRecord | null {
  return batches.get(batchKey(input.checkpointId, input.batchId, input.phase)) ?? null;
}

export function listWebUiActivationBatchesMemory(
  checkpointId: string,
  phase?: string,
): readonly WebUiActivationBatchRecord[] {
  return [...batches.values()].filter(
    (row) =>
      row.checkpointId === checkpointId && (phase == null || row.phase === phase),
  );
}
