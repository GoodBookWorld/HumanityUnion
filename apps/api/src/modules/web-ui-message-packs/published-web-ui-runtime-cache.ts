/**
 * In-process cache of PUBLIC published WEB_UI runtime payloads.
 *
 * Keyed by canonical localeKey. Stores only the public response fields.
 * Bounded by entry count (enabled locales are few). Not shared across API
 * processes — staging and the initial production contract run one API instance.
 */

import type { WebUiMessageTree } from "@hu/types";

/** Headroom above today's enabled-locale count. Not an unbounded locale map. */
export const PUBLISHED_WEB_UI_RUNTIME_CACHE_MAX_ENTRIES = 32;

export type PublishedWebUiRuntimePayload = {
  readonly locale: string;
  readonly revision: number;
  readonly messages: WebUiMessageTree;
  readonly source: "remote";
};

const store = new Map<string, PublishedWebUiRuntimePayload>();

export function resetPublishedWebUiRuntimeCacheForTests(): void {
  store.clear();
}

export function getPublishedWebUiRuntimeCacheSizeForTests(): number {
  return store.size;
}

export function getCachedPublishedWebUiRuntime(
  localeKey: string,
): PublishedWebUiRuntimePayload | null {
  const hit = store.get(localeKey);
  if (!hit) {
    return null;
  }
  store.delete(localeKey);
  store.set(localeKey, hit);
  return hit;
}

export function rememberPublishedWebUiRuntime(
  localeKey: string,
  payload: PublishedWebUiRuntimePayload,
): void {
  if (store.has(localeKey)) {
    store.delete(localeKey);
  } else {
    while (store.size >= PUBLISHED_WEB_UI_RUNTIME_CACHE_MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest == null) {
        break;
      }
      store.delete(oldest);
    }
  }
  store.set(localeKey, payload);
}

export function invalidatePublishedWebUiRuntimeCache(localeKey: string): void {
  store.delete(localeKey);
}
