"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { formatLanguageDisplayName } from "../format-language-display-name";
import { resolveTranslatedContent, generateContentTranslation } from "../translation-api";
import { usePublicContentReadingContext } from "../use-public-content-reading-context";
import { TranslatedContentView } from "./TranslatedContentView";

import "./public-translated-fields.css";

export interface PublicTranslatedFieldsProps {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly fieldOrder: readonly string[];
  readonly fieldLabels: Record<string, string>;
  /** Fallback fields from the already-loaded public projection. */
  readonly fallbackFields: Record<string, string>;
  readonly className?: string;
  /**
   * When true (default), preferred preference may POST /generate on cache miss
   * (Initiative / Analysis / Petition compatibility).
   * Task 05 civic kinds set false — Task 04 warm is the generation path.
   */
  readonly enableOnDemandGenerate?: boolean;
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
  enableOnDemandGenerate = true,
}: PublicTranslatedFieldsProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
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
    const fallback = JSON.parse(fallbackSignature) as Record<string, string>;
    setFields(fallback);
    setOriginalFields(fallback);

    if (!readingContext.ready) {
      return;
    }

    let cancelled = false;
    const readingLanguage = readingContext.readingLanguage;
    const preference = readingContext.translationPreference;
    setPreferredLanguage(readingLanguage);

    void (async () => {
      try {
        let resolved = await resolveTranslatedContent({
          sourceKind,
          sourceRecordId,
          language: readingLanguage,
        });

        // Initiative/Analysis/Petition compatibility: optional on-demand generate.
        // Civic Pack 02G kinds keep enableOnDemandGenerate=false (warm-only).
        if (
          enableOnDemandGenerate &&
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
  }, [
    sourceKind,
    sourceRecordId,
    fallbackSignature,
    enableOnDemandGenerate,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  return (
    <div
      className={["hu-public-translated-fields", className].filter(Boolean).join(" ")}
    >
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
          {t("translation.preferredReadingLanguageSr", {
            language: formatLanguageDisplayName(locale, preferredLanguage),
          })}
        </span>
      ) : null}
    </div>
  );
}
