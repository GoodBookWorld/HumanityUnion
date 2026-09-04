import type {
  LanguageCode,
  ResolvedTranslatedDisplay,
  TranslatedContentRecord,
  TranslationDisplayPreference,
} from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, normalizeLanguageCode } from "@hu/types";

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
  const originalLanguage = normalizeLanguageCode(
    input.originalLanguage,
    DEFAULT_PLATFORM_LANGUAGE,
  );
  const preferred = normalizeLanguageCode(
    input.preferredReadingLanguage,
    originalLanguage,
  );
  const preference = input.translationPreference ?? "preferred";
  const originalContent = input.originalContent ?? "";
  const translations = input.translations ?? [];

  const preferredCurrent = translations.find(
    (item) =>
      item.targetLanguage === preferred &&
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
            item.targetLanguage !== originalLanguage,
        )
      : undefined;

  const stalePreferred = translations.find(
    (item) => item.targetLanguage === preferred && (item.stale || item.freshness === "stale"),
  );

  if (preference === "none" || preferred === originalLanguage) {
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

  // Pack 08J.1 — consume a stale preferred translation rather than silently
  // reverting to English when sourceVersion drifted. UI marks isStale; warm
  // repair regenerates. Do not hide CURRENT rows behind canonical fallback.
  if (stalePreferred) {
    return {
      presentationMode: "preferred_translation",
      content: asTextContent(stalePreferred.translatedContent),
      activeLanguage: preferred,
      originalLanguage,
      originalContent,
      translation: stalePreferred,
      isMachineTranslated: stalePreferred.translationKind === "machine",
      isStale: true,
      canViewOriginal: true,
      canViewTranslation: false,
    };
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
  if (
    textResolved.presentationMode !== "original" &&
    textResolved.translation &&
    typeof textResolved.translation.translatedContent === "object" &&
    textResolved.translation.translatedContent !== null
  ) {
    const fields: Record<string, string> = { ...input.originalFields };
    for (const [key, value] of Object.entries(textResolved.translation.translatedContent)) {
      // Pack 08J.1 — apply every translated string key onto the projection bag.
      // Exclusion policy already stripped NON_TRANSLATABLE before provider write;
      // do not require a second allowlist at consume time.
      if (typeof value === "string") {
        fields[key] = value;
      }
    }
    content = fields;
  }

  return {
    presentationMode: textResolved.presentationMode,
    content,
    activeLanguage: textResolved.activeLanguage,
    originalLanguage: textResolved.originalLanguage,
    originalContent: input.originalFields,
    translation: textResolved.translation,
    isMachineTranslated: textResolved.isMachineTranslated,
    isStale: textResolved.isStale,
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
