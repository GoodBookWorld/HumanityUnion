/**
 * Production Completion Pack 02D Task 01 — UI message catalog loading.
 *
 * Always deep-merges onto bundled English so remote Admin packs and
 * pre-activation bundled overlays fall back safely.
 * Locale tags are exact (`zh-Hant`).
 *
 * Resolution order for overlay (Gate D — Mongo published first):
 * 1. published remote/Admin Mongo pack
 * 2. bundled localized pack (pre-activation / bootstrap only)
 * 3. optional configured fallbackLocale pack (same remote→bundled order)
 * 4. English-only (merge base)
 *
 * Once a published remote pack is selected, missing keys fall back to
 * English via deep-merge — not to a second bundled localized generation.
 */

import type { AbstractIntlMessages } from "next-intl";

import {
  loadFirstAvailableMessagePack,
  type UiMessagePack,
  type UiMessagePackSource,
} from "./remote-pack-seam.js";
import { remoteUiMessagePackSource } from "./remote-ui-message-pack-source.js";

/** Bundled verification locales for Task 01 foundation catalogs. */
export const BUNDLED_UI_MESSAGE_LOCALES = ["en", "uk", "zh-Hant", "ar"] as const;

export type BundledUiMessageLocale = (typeof BUNDLED_UI_MESSAGE_LOCALES)[number];

export const UI_I18N_ENGLISH_FALLBACK_LOCALE = "en" as const;

const bundledLoaders: Record<
  BundledUiMessageLocale,
  () => Promise<{ default: AbstractIntlMessages }>
> = {
  en: () => import("./messages/en.json"),
  uk: () => import("./messages/uk.json"),
  "zh-Hant": () => import("./messages/zh-Hant.json"),
  ar: () => import("./messages/ar.json"),
};

export function isBundledUiMessageLocale(locale: string): locale is BundledUiMessageLocale {
  return (BUNDLED_UI_MESSAGE_LOCALES as readonly string[]).includes(locale);
}

/** Deep-merge overlay onto base; overlay string/leaf values win. */
export function deepMergeMessages(
  base: AbstractIntlMessages,
  overlay: AbstractIntlMessages,
): AbstractIntlMessages {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, value] of Object.entries(overlay as Record<string, unknown>)) {
    const existing = result[key];
    if (
      value != null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      existing != null &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMergeMessages(
        existing as AbstractIntlMessages,
        value as AbstractIntlMessages,
      );
    } else {
      result[key] = value;
    }
  }

  return result as AbstractIntlMessages;
}

export async function loadBundledUiMessagePack(
  locale: string,
): Promise<UiMessagePack | null> {
  if (!isBundledUiMessageLocale(locale)) {
    return null;
  }
  const mod = await bundledLoaders[locale]();
  return {
    locale,
    messages: mod.default,
    source: "bundled",
  };
}

/** Bundled bootstrap source — ships with the Web app (pre-activation fallback). */
export const bundledUiMessagePackSource: UiMessagePackSource = {
  load: loadBundledUiMessagePack,
};

/**
 * Default sources: published remote/Admin Mongo first, then bundled bootstrap.
 * No shipped-locale remote allowlist — arbitrary Registry locales use the same order.
 */
export const defaultUiMessagePackSources: readonly UiMessagePackSource[] = [
  remoteUiMessagePackSource,
  bundledUiMessagePackSource,
];

/**
 * Resolve UI messages for a Pack 02C-resolved locale tag.
 * English bundled catalog is always the merge base.
 */
export async function loadUiMessagesForLocale(
  locale: string,
  sources: readonly UiMessagePackSource[] = defaultUiMessagePackSources,
  options?: {
    readonly fallbackLocale?: string | null;
  },
): Promise<{
  readonly locale: string;
  readonly messages: AbstractIntlMessages;
  readonly packSource: UiMessagePack["source"] | "english-only";
}> {
  const englishPack = await loadBundledUiMessagePack(UI_I18N_ENGLISH_FALLBACK_LOCALE);
  if (!englishPack) {
    throw new Error("Bundled English UI message catalog is required.");
  }

  if (locale === UI_I18N_ENGLISH_FALLBACK_LOCALE) {
    return {
      locale: UI_I18N_ENGLISH_FALLBACK_LOCALE,
      messages: englishPack.messages,
      packSource: "bundled",
    };
  }

  let overlay = await loadFirstAvailableMessagePack(locale, sources);
  const fallback = options?.fallbackLocale?.trim() ?? "";
  if (
    !overlay &&
    fallback &&
    fallback !== locale &&
    fallback !== UI_I18N_ENGLISH_FALLBACK_LOCALE
  ) {
    overlay = await loadFirstAvailableMessagePack(fallback, sources);
  }

  if (!overlay) {
    return {
      locale: UI_I18N_ENGLISH_FALLBACK_LOCALE,
      messages: englishPack.messages,
      packSource: "english-only",
    };
  }

  return {
    locale: overlay.locale,
    messages: deepMergeMessages(englishPack.messages, overlay.messages),
    packSource: overlay.source,
  };
}

/**
 * Resolve a message path for tests / missing-key probes.
 * Returns undefined only when English also lacks the key.
 */
export function resolveMergedMessage(
  messages: AbstractIntlMessages,
  namespace: string,
  key: string,
): string | undefined {
  const ns = (messages as Record<string, unknown>)[namespace];
  if (ns == null || typeof ns !== "object" || Array.isArray(ns)) {
    return undefined;
  }
  const value = (ns as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}
