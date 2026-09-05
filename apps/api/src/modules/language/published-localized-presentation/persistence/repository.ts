/**
 * Reset 02 — persistence facade (memory default; mongo when configured + selected).
 */

import type { PublishedLocalizedPresentationRecord } from "@hu/types";

import { isMongoConfigured } from "../../../../infrastructure/mongodb/mongo-config.js";
import {
  findCurrentPublishedMemory,
  publishAtomicMemory,
  putPublishedSnapshotMemory,
  resetPublishedLocalizedPresentationMemoryStoreForTests,
} from "./memory.store.js";

export type PublishedLocalizationPersistenceMode = "memory" | "mongo";

let mode: PublishedLocalizationPersistenceMode = "memory";
let findFailureForTests = false;

export function setPublishedLocalizationPersistenceModeForTests(
  next: PublishedLocalizationPersistenceMode,
): void {
  mode = next;
}

export function setPublishedLocalizationFindFailureForTests(fail: boolean): void {
  findFailureForTests = fail;
}

export function getPublishedLocalizationPersistenceMode(): PublishedLocalizationPersistenceMode {
  if (mode === "mongo" && isMongoConfigured()) {
    return "mongo";
  }
  return "memory";
}

export function resetPublishedLocalizationPersistenceForTests(): void {
  mode = "memory";
  findFailureForTests = false;
  resetPublishedLocalizedPresentationMemoryStoreForTests();
}

export async function findCurrentPublishedPresentation(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): Promise<PublishedLocalizedPresentationRecord | null> {
  if (findFailureForTests) {
    throw new Error("PUBLISHED_LOCALIZATION_FIND_FAILURE_FOR_TESTS");
  }
  if (getPublishedLocalizationPersistenceMode() === "mongo") {
    const { findCurrentPublishedMongo } = await import("./mongo.repository.js");
    return findCurrentPublishedMongo(input);
  }
  return findCurrentPublishedMemory(input);
}

export async function saveBuildingOrFailedSnapshot(
  record: PublishedLocalizedPresentationRecord,
): Promise<void> {
  if (record.state === "PUBLISHED") {
    throw new Error("PUBLISHED snapshots must use publishAtomicPublishedPresentation");
  }
  if (getPublishedLocalizationPersistenceMode() === "mongo") {
    const { putPublishedSnapshotHistoryMongo } = await import("./mongo.repository.js");
    await putPublishedSnapshotHistoryMongo(record);
    return;
  }
  putPublishedSnapshotMemory(record);
}

export async function publishAtomicPublishedPresentation(input: {
  readonly candidate: PublishedLocalizedPresentationRecord;
}): Promise<
  | {
      readonly ok: true;
      readonly record: PublishedLocalizedPresentationRecord;
      readonly supersededSnapshotId?: string;
      readonly idempotent: boolean;
    }
  | { readonly ok: false; readonly reason: "STALE_REVISION" | "PERSISTENCE_ERROR" }
> {
  if (getPublishedLocalizationPersistenceMode() === "mongo") {
    const { publishAtomicMongo } = await import("./mongo.repository.js");
    return publishAtomicMongo(input);
  }
  const result = publishAtomicMemory(input);
  if (!result.ok) {
    return { ok: false, reason: result.reason };
  }
  return {
    ok: true,
    record: result.record,
    supersededSnapshotId: result.supersededSnapshotId,
    idempotent: result.idempotent,
  };
}
