import type { WebUiMessagePackRecord } from "@hu/types";

const memoryByLocaleKey = new Map<string, WebUiMessagePackRecord>();

export function resetWebUiMessagePackMemoryForTests(): void {
  memoryByLocaleKey.clear();
}

export function listWebUiMessagePackMemory(): WebUiMessagePackRecord[] {
  return [...memoryByLocaleKey.values()];
}

export function getWebUiMessagePackByLocaleMemory(
  localeKey: string,
): WebUiMessagePackRecord | null {
  return memoryByLocaleKey.get(localeKey) ?? null;
}

export function upsertWebUiMessagePackMemory(record: WebUiMessagePackRecord, localeKey: string): void {
  memoryByLocaleKey.set(localeKey, record);
}

/**
 * Compare-and-set for the in-memory adapter (parity with Mongo atomic update).
 * Returns false when the expected revision precondition fails (no write).
 */
export function compareAndSetWebUiMessagePackMemory(input: {
  readonly localeKey: string;
  readonly expectedRevision: number | null;
  readonly next: WebUiMessagePackRecord;
}): boolean {
  const existing = memoryByLocaleKey.get(input.localeKey) ?? null;
  if (input.expectedRevision === null) {
    if (existing) {
      return false;
    }
    memoryByLocaleKey.set(input.localeKey, input.next);
    return true;
  }
  if (!existing || existing.revision !== input.expectedRevision) {
    return false;
  }
  memoryByLocaleKey.set(input.localeKey, input.next);
  return true;
}
