/**
 * Production Completion Pack 02D Task 01 — remote UI message pack seam.
 *
 * Bundled English (+ verification locale overlays) ship with the Web app.
 * Admin-managed packs for arbitrary Registry locales load via
 * `remoteUiMessagePackSource` (GET /api/v1/web-ui-message-packs).
 *
 * Resolution is side-effect free: no TranslationProvider / Gemini on read.
 */

import type { AbstractIntlMessages } from "next-intl";

/** Provenance of a loaded UI message pack. */
export type UiMessagePackSourceKind = "bundled" | "remote";

export interface UiMessagePack {
  readonly locale: string;
  readonly messages: AbstractIntlMessages;
  readonly source: UiMessagePackSourceKind;
}

/**
 * Narrow loader contract for bundled / remote message packs.
 * Implementations must never invent a second interface-locale authority —
 * callers pass the Pack 02C-resolved locale tag.
 */
export interface UiMessagePackSource {
  /**
   * Load messages for an exact locale tag (e.g. `zh-Hant`, not `zh`).
   * Return null when no pack exists for that locale.
   */
  load(locale: string): Promise<UiMessagePack | null>;
}

/**
 * Compose sources: first non-null pack wins for the overlay locale;
 * English bundled fallback is applied separately by `loadUiMessagesForLocale`.
 */
export async function loadFirstAvailableMessagePack(
  locale: string,
  sources: readonly UiMessagePackSource[],
): Promise<UiMessagePack | null> {
  for (const source of sources) {
    const pack = await source.load(locale);
    if (pack) {
      return pack;
    }
  }
  return null;
}
