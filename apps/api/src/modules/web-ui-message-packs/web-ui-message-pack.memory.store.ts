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
