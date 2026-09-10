import type {
  LanguageCode,
  ResolvedTranslatedDisplay,
  TranslatedContentRecord,
  TranslationDisplayPreference,
} from "@hu/types";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  isCompleteLocalizedProseBag,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

/**
 * Preserve Registry locale structure (`zh-Hant`). Do not use
 * `normalizeLanguageCode` here — it collapses `zh-Hant` → `zh` and breaks
 * CT targetLanguage matching for structured Registry locales.
 */
function coerceReadingLocale(
  value: unknown,
  fallback: LanguageCode,
): LanguageCode {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? (trimmed as LanguageCode) : fallback;
}

function localesEqual(a: string, b: string): boolean {
  return (
    normalizeLanguageRegistryLocaleKey(a) ===
    normalizeLanguageRegistryLocaleKey(b)
  );
}

export interface ResolveTranslatedDisplayInput<TContent = string> {
  readonly originalContent: TContent;
  readonly originalLanguage?: LanguageCode | null;
  readonly preferredReadingLanguage?: LanguageCode | null;
  /** Candidate translations for this source record (already loaded). */
  readonly translations?: readonly TranslatedContentRecord[];
  /**
   * When true, allow a non-preferred approved/human translation as fallback
   * before falling back to original.
   */
  readonly allowOtherApprovedTranslation?: boolean;
  /**
   * Pack 01/02 contract: none | preferred | ask
   * none → always original; preferred → use translation when current;
   * ask → default original but allow switching to translation.
   */
  readonly translationPreference?: TranslationDisplayPreference;
}

function asTextContent(content: TranslatedContentRecord["translatedContent"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (content && typeof content === "object" && typeof content.text === "string") {
    return content.text;
  }
  return JSON.stringify(content);
}

function baseOriginal(input: {
  originalContent: string;
  originalLanguage: LanguageCode;
  translation: TranslatedContentRecord | null;
  isStale: boolean;
  canViewTranslation: boolean;
}): ResolvedTranslatedDisplay<string> {
  return {
    presentationMode: "original",
    content: input.originalContent,
    activeLanguage: input.originalLanguage,
    originalLanguage: input.originalLanguage,
    originalContent: input.originalContent,
    translation: input.translation,
    isMachineTranslated: false,
    isStale: input.isStale,
    canViewOriginal: false,
    canViewTranslation: input.canViewTranslation,
  };
}

/**
 * Fallback chain:
 * preferred translation → other approved translation (if policy allows) → original.
 * Never returns empty solely because a translation is missing.
 * Stale translations are not presented as current.
 */
export function resolveTranslatedDisplay(
  input: ResolveTranslatedDisplayInput<string>,
): ResolvedTranslatedDisplay<string> {
  const originalLanguage = coerceReadingLocale(
    input.originalLanguage,
    DEFAULT_PLATFORM_LANGUAGE,
  );
  const preferred = coerceReadingLocale(
    input.preferredReadingLanguage,
    originalLanguage,
  );
  const preference = input.translationPreference ?? "preferred";
  const originalContent = input.originalContent ?? "";
  const translations = input.translations ?? [];

  const preferredCurrent = translations.find(
    (item) =>
      localesEqual(item.targetLanguage, preferred) &&
      !item.stale &&
      item.freshness === "current",
  );

  const otherApproved =
    input.allowOtherApprovedTranslation
      ? translations.find(
          (item) =>
            !item.stale &&
            item.freshness === "current" &&
            (item.translationKind === "human" || item.translationKind === "author-approved") &&
            !localesEqual(item.targetLanguage, originalLanguage),
        )
      : undefined;

  const stalePreferred = translations.find(
    (item) =>
      localesEqual(item.targetLanguage, preferred) &&
      (item.stale || item.freshness === "stale"),
  );

  if (preference === "none" || localesEqual(preferred, originalLanguage)) {
    return baseOriginal({
      originalContent,
      originalLanguage,
      translation: null,
      isStale: false,
      canViewTranslation: false,
    });
  }

  if (preference === "ask") {
    if (preferredCurrent) {
      return baseOriginal({
        originalContent,
        originalLanguage,
        translation: preferredCurrent,
        isStale: false,
        canViewTranslation: true,
      });
    }
    return baseOriginal({
      originalContent,
      originalLanguage,
      translation: stalePreferred ?? null,
      isStale: Boolean(stalePreferred),
      canViewTranslation: false,
    });
  }

  // preference === "preferred"
  if (preferredCurrent) {
    return {
      presentationMode: "preferred_translation",
      content: asTextContent(preferredCurrent.translatedContent),
      activeLanguage: preferred,
      originalLanguage,
      originalContent,
      translation: preferredCurrent,
      isMachineTranslated: preferredCurrent.translationKind === "machine",
      isStale: false,
      canViewOriginal: true,
      canViewTranslation: false,
    };
  }

  if (otherApproved) {
    return {
      presentationMode: "fallback_translation",
      content: asTextContent(otherApproved.translatedContent),
      activeLanguage: otherApproved.targetLanguage,
      originalLanguage,
      originalContent,
      translation: otherApproved,
      isMachineTranslated: false,
      isStale: false,
      canViewOriginal: true,
      canViewTranslation: false,
    };
  }

  // Pack 08K — stale preferred must NOT present as preferred_translation /
  // COMPLETE. Fall back to canonical original with isStale=true; bounded
  // regeneration is scheduled separately (manual current → CURRENT machine →
  // canonical fallback).
  if (stalePreferred) {
    return baseOriginal({
      originalContent,
      originalLanguage,
      translation: stalePreferred,
      isStale: true,
      canViewTranslation: false,
    });
  }

  return baseOriginal({
    originalContent,
    originalLanguage,
    translation: null,
    isStale: false,
    canViewTranslation: false,
  });
}

/**
 * Structured-field variant — same freshness / preference rules.
 * `content` is the field map shown to the reader.
 *
 * Permanent invariant: a CURRENT translation that omits any non-empty
 * original eligible field must not present as localized (partial merge
 * caused uk-vs-ar/zh-Hant Supporting Arguments asymmetry). Incomplete
 * bags fall back to canonical original with isStale=true.
 */
export function resolveStructuredTranslatedDisplay(input: {
  readonly originalFields: Record<string, string>;
  readonly originalLanguage?: LanguageCode | null;
  readonly preferredReadingLanguage?: LanguageCode | null;
  readonly translations?: readonly TranslatedContentRecord[];
  readonly translationPreference?: TranslationDisplayPreference;
  readonly allowOtherApprovedTranslation?: boolean;
}): ResolvedTranslatedDisplay<Record<string, string>> {
  const originalJson = JSON.stringify(input.originalFields);
  const textResolved = resolveTranslatedDisplay({
    originalContent: originalJson,
    originalLanguage: input.originalLanguage,
    preferredReadingLanguage: input.preferredReadingLanguage,
    translations: input.translations,
    translationPreference: input.translationPreference,
    allowOtherApprovedTranslation: input.allowOtherApprovedTranslation,
  });

  let content = input.originalFields;
  let presentationMode = textResolved.presentationMode;
  let activeLanguage = textResolved.activeLanguage;
  let isMachineTranslated = textResolved.isMachineTranslated;
  let isStale = textResolved.isStale;

  if (
    textResolved.presentationMode !== "original" &&
    textResolved.translation &&
    typeof textResolved.translation.translatedContent === "object" &&
    textResolved.translation.translatedContent !== null
  ) {
    const translated = textResolved.translation.translatedContent;
    const complete = isCompleteLocalizedProseBag({
      originalFields: input.originalFields,
      localizedFields: Object.fromEntries(
        Object.entries(translated).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    });

    if (!complete) {
      // Partial CURRENT must not paint English leftover fields as localized.
      content = input.originalFields;
      presentationMode = "original";
      activeLanguage = textResolved.originalLanguage;
      isMachineTranslated = false;
      isStale = true;
    } else {
      const fields: Record<string, string> = { ...input.originalFields };
      for (const [key, value] of Object.entries(translated)) {
        if (typeof value === "string") {
          fields[key] = value;
        }
      }
      content = fields;
    }
  }

  return {
    presentationMode,
    content,
    activeLanguage,
    originalLanguage: textResolved.originalLanguage,
    originalContent: input.originalFields,
    translation: textResolved.translation,
    isMachineTranslated,
    isStale,
    canViewOriginal: textResolved.canViewOriginal,
    canViewTranslation: textResolved.canViewTranslation,
  };
}

export function markTranslationStaleIfSourceChanged(input: {
  readonly translation: TranslatedContentRecord;
  readonly liveSourceVersion: string;
}): TranslatedContentRecord {
  if (input.translation.sourceVersion === input.liveSourceVersion) {
    return input.translation;
  }

  return {
    ...input.translation,
    stale: true,
    freshness: "stale",
  };
}
