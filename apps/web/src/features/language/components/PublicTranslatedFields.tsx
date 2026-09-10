"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  presentCollaborativeAnalysisFieldsWithControlledVocabulary,
} from "@hu/types";

import { formatLanguageDisplayName } from "../format-language-display-name";
import { resolvePublicContentDisplayLanguage } from "../resolve-public-content-display-language";
import { resolveTranslatedContent } from "../translation-api";
import { usePublicContentReadingContext } from "../use-public-content-reading-context";
import { buildInitiativeControlledVocabularyLabelLookup } from "../../public-initiative-experience/build-initiative-controlled-vocabulary-label-lookup";
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
 * Loads Pack 02 resolved translation for a published record and renders
 * each text field through TranslatedContentView.
 *
 * Pack 1.1 — cache-only: never POST /generate; missing/stale → canonical fallback.
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
  // Pack 08I.14B — Initiative Lifecycle/Discussion civic fields follow UI locale.
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const controlledLabelLookup = useMemo(
    () =>
      buildInitiativeControlledVocabularyLabelLookup({
        tInitiativeExperience: t,
      }),
    [t],
  );
  const applyControlledVocabulary = (bag: Record<string, string>) => {
    if (sourceKind !== "collaborative_analysis") {
      return bag;
    }
    if (displayLanguage === DEFAULT_PLATFORM_LANGUAGE) {
      return bag;
    }
    return presentCollaborativeAnalysisFieldsWithControlledVocabulary({
      fields: bag,
      labelLookup: controlledLabelLookup,
    });
  };
  const [fields, setFields] = useState(() => applyControlledVocabulary(fallbackFields));
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
    setFields(applyControlledVocabulary(fallback));
    setOriginalFields(fallback);

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
        if (resolved.activeLanguage !== displayLanguage) {
          return;
        }

        setFields(applyControlledVocabulary(resolved.content));
        setOriginalFields(resolved.originalContent);
        setActiveLanguage(resolved.activeLanguage);
        setOriginalLanguage(resolved.originalLanguage);
        setCanViewOriginal(resolved.canViewOriginal);
        setCanViewTranslation(resolved.canViewTranslation);
        setIsMachineTranslated(resolved.isMachineTranslated);
        setIsStale(resolved.isStale);
      } catch {
        if (!cancelled) {
          setFields(applyControlledVocabulary(fallback));
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
    readingContext.ready,
    displayLanguage,
    controlledLabelLookup,
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
