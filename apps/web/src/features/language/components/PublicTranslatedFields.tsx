"use client";

import { useEffect, useState } from "react";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { getMyPreferences } from "../../preferences/preferences-api";
import { resolveTranslatedContent, generateContentTranslation } from "../translation-api";
import { TranslatedContentView } from "./TranslatedContentView";

export interface PublicTranslatedFieldsProps {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly fieldOrder: readonly string[];
  readonly fieldLabels: Record<string, string>;
  /** Fallback fields from the already-loaded public projection. */
  readonly fallbackFields: Record<string, string>;
  readonly className?: string;
}

/**
 * Loads Pack 02 resolved translation for a published record and renders
 * each text field through TranslatedContentView.
 */
export function PublicTranslatedFields({
  sourceKind,
  sourceRecordId,
  fieldOrder,
  fieldLabels,
  fallbackFields,
  className,
}: PublicTranslatedFieldsProps) {
  const [fields, setFields] = useState(fallbackFields);
  const [originalFields, setOriginalFields] = useState(fallbackFields);
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>(DEFAULT_PLATFORM_LANGUAGE);
  const [originalLanguage, setOriginalLanguage] =
    useState<LanguageCode>(DEFAULT_PLATFORM_LANGUAGE);
  const [canViewOriginal, setCanViewOriginal] = useState(false);
  const [canViewTranslation, setCanViewTranslation] = useState(false);
  const [isMachineTranslated, setIsMachineTranslated] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageCode | null>(null);

  const fallbackSignature = JSON.stringify(fallbackFields);

  useEffect(() => {
    let cancelled = false;
    const fallback = JSON.parse(fallbackSignature) as Record<string, string>;
    setFields(fallback);
    setOriginalFields(fallback);

    void (async () => {
      let readingLanguage: LanguageCode = DEFAULT_PLATFORM_LANGUAGE;
      let preference: string = "preferred";
      try {
        const prefs = await getMyPreferences();
        readingLanguage =
          (prefs.experiencePreferences.readingLanguages[0] as LanguageCode) ||
          (prefs.experiencePreferences.interfaceLanguage as LanguageCode) ||
          DEFAULT_PLATFORM_LANGUAGE;
        preference = prefs.experiencePreferences.translationPreference || "preferred";
      } catch (error) {
        if (!isAuthenticationRequiredError(error)) {
          // keep defaults
        }
      }

      if (cancelled) {
        return;
      }
      setPreferredLanguage(readingLanguage);

      try {
        let resolved = await resolveTranslatedContent({
          sourceKind,
          sourceRecordId,
          language: readingLanguage,
        });

        // When preferred and no translation yet, request generation once (rate limited server-side).
        if (
          preference === "preferred" &&
          resolved.presentationMode === "original" &&
          readingLanguage !== resolved.originalLanguage &&
          !resolved.isStale
        ) {
          try {
            const generated = await generateContentTranslation({
              sourceKind,
              sourceRecordId,
              targetLanguage: readingLanguage,
            });
            resolved = generated.display;
          } catch {
            // Keep original on provider failure.
          }
        }

        if (cancelled) {
          return;
        }

        setFields(resolved.content);
        setOriginalFields(resolved.originalContent);
        setActiveLanguage(resolved.activeLanguage);
        setOriginalLanguage(resolved.originalLanguage);
        setCanViewOriginal(resolved.canViewOriginal);
        setCanViewTranslation(resolved.canViewTranslation);
        setIsMachineTranslated(resolved.isMachineTranslated);
        setIsStale(resolved.isStale);
      } catch {
        if (!cancelled) {
          setFields(fallback);
          setOriginalFields(fallback);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceKind, sourceRecordId, fallbackSignature]);

  return (
    <div className={className}>
      {fieldOrder.map((fieldKey) => {
        const value = fields[fieldKey]?.trim();
        const original = originalFields[fieldKey] ?? "";
        if (!value && !original) {
          return null;
        }
        return (
          <div key={fieldKey} className="hu-public-translated-field">
            <h4>{fieldLabels[fieldKey] ?? fieldKey}</h4>
            <TranslatedContentView
              content={value || original}
              originalContent={original}
              activeLanguage={activeLanguage}
              originalLanguage={originalLanguage}
              canViewOriginal={canViewOriginal || canViewTranslation}
              isMachineTranslated={isMachineTranslated}
              isStale={isStale}
            />
          </div>
        );
      })}
      {preferredLanguage ? (
        <span className="hu-public-translated-field__sr">
          Preferred reading language {preferredLanguage}
        </span>
      ) : null}
    </div>
  );
}
