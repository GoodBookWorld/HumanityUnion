"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import {
  COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS,
  DEFAULT_PLATFORM_LANGUAGE,
  isCompleteLocalizedProseBag,
} from "@hu/types";

import { formatLanguageDisplayName } from "../format-language-display-name";
import { resolvePublicContentDisplayLanguage } from "../resolve-public-content-display-language";
import { resolveTranslatedContent } from "../translation-api";
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
   * @deprecated Pack 1.1 — participant on-demand generation is retired.
   * Prop is ignored; public reads are cache-only (GET resolve) with canonical fallback.
   */
  readonly enableOnDemandGenerate?: boolean;
}

/**
 * Loads persisted translation for a published record and renders each text
 * field through TranslatedContentView.
 *
 * Reset 01 — visible content is the localization boundary:
 * - cache-only resolve (never provider-on-read)
 * - complete localized bag or coherent original — never per-field hybrid merge
 * - Controlled Vocabulary is not a post-render substitute for ordinary prose
 */
export function PublicTranslatedFields({
  sourceKind,
  sourceRecordId,
  fieldOrder,
  fieldLabels,
  fallbackFields,
  className,
}: PublicTranslatedFieldsProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
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
  const [presentationMode, setPresentationMode] = useState<"original" | "localized">(
    "original",
  );

  const fallbackSignature = JSON.stringify(fallbackFields);

  useEffect(() => {
    const fallback = JSON.parse(fallbackSignature) as Record<string, string>;
    setFields(fallback);
    setOriginalFields(fallback);
    setPresentationMode("original");
    setActiveLanguage(DEFAULT_PLATFORM_LANGUAGE);
    setIsMachineTranslated(false);
    setCanViewOriginal(false);

    if (!readingContext.ready) {
      return;
    }

    let cancelled = false;
    setPreferredLanguage(displayLanguage);

    void (async () => {
      try {
        const resolved = await resolveTranslatedContent({
          sourceKind,
          sourceRecordId,
          language: displayLanguage,
        });

        if (cancelled) {
          return;
        }

        const original = resolved.originalContent;
        const localized = resolved.content;
        const requiredFields =
          sourceKind === "collaborative_analysis"
            ? COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS
            : fieldOrder;

        const complete =
          resolved.presentationMode !== "original" &&
          resolved.activeLanguage === displayLanguage &&
          isCompleteLocalizedProseBag({
            originalFields: original,
            localizedFields: localized,
            requiredFields,
          });

        if (!complete) {
          setFields(original);
          setOriginalFields(original);
          setActiveLanguage(resolved.originalLanguage);
          setOriginalLanguage(resolved.originalLanguage);
          setCanViewOriginal(false);
          setCanViewTranslation(false);
          setIsMachineTranslated(false);
          setIsStale(resolved.isStale);
          setPresentationMode("original");
          return;
        }

        setFields(localized);
        setOriginalFields(original);
        setActiveLanguage(resolved.activeLanguage);
        setOriginalLanguage(resolved.originalLanguage);
        setCanViewOriginal(resolved.canViewOriginal);
        setCanViewTranslation(resolved.canViewTranslation);
        setIsMachineTranslated(resolved.isMachineTranslated);
        setIsStale(resolved.isStale);
        setPresentationMode("localized");
      } catch {
        if (!cancelled) {
          setFields(fallback);
          setOriginalFields(fallback);
          setPresentationMode("original");
          setIsMachineTranslated(false);
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
    readingContext.ready,
    displayLanguage,
    fieldOrder,
  ]);

  const displayBag = presentationMode === "localized" ? fields : originalFields;

  return (
    <div
      className={["hu-public-translated-fields", className].filter(Boolean).join(" ")}
      data-hu-localization-boundary="visible-content"
      data-hu-presentation-mode={presentationMode}
    >
      {fieldOrder.map((fieldKey) => {
        const value = displayBag[fieldKey]?.trim() ?? "";
        const original = originalFields[fieldKey] ?? "";
        if (!value && !original) {
          return null;
        }
        return (
          <div key={fieldKey} className="hu-public-translated-field">
            <h4>{fieldLabels[fieldKey] ?? fieldKey}</h4>
            <TranslatedContentView
              content={value.length > 0 ? value : original}
              originalContent={original}
              activeLanguage={activeLanguage}
              originalLanguage={originalLanguage}
              canViewOriginal={presentationMode === "localized" && (canViewOriginal || canViewTranslation)}
              isMachineTranslated={presentationMode === "localized" && isMachineTranslated}
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
