"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import {
  COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS,
  DEFAULT_PLATFORM_LANGUAGE,
  IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS,
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
 *
 * Reactivity — do not put unstable `fieldOrder` array identity in effect deps;
 * guard in-flight resolve with a generation counter; skip destructive English
 * reset while reading context is not ready; `fields` is always the browser-
 * visible bag (including IP WEB_UI presentation fallback when CT is incomplete).
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
  const requestGeneration = useRef(0);
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
  /** Content-stable deps key — avoids re-resolve when parents pass a new array ref. */
  const fieldOrderSignature = fieldOrder.join("\u0001");

  useEffect(() => {
    // Wait for reading context; do not wipe an in-progress or prior presentation
    // to English merely because ready has not settled (e.g. guest locale probe).
    if (!readingContext.ready) {
      return;
    }

    const generation = ++requestGeneration.current;
    const fallback = JSON.parse(fallbackSignature) as Record<string, string>;
    const orderedKeys = fieldOrderSignature.length > 0 ? fieldOrderSignature.split("\u0001") : [];

    setFields(fallback);
    setOriginalFields(fallback);
    setPresentationMode("original");
    setActiveLanguage(DEFAULT_PLATFORM_LANGUAGE);
    setIsMachineTranslated(false);
    setCanViewOriginal(false);
    setPreferredLanguage(displayLanguage);

    let cancelled = false;

    void (async () => {
      try {
        const resolved = await resolveTranslatedContent({
          sourceKind,
          sourceRecordId,
          language: displayLanguage,
        });

        if (cancelled || generation !== requestGeneration.current) {
          return;
        }

        const original = resolved.originalContent;
        const localized = resolved.content;
        const requiredFields =
          sourceKind === "collaborative_analysis"
            ? COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS
            : sourceKind === "improvement_proposal"
              ? IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS
              : orderedKeys;

        const complete =
          resolved.presentationMode !== "original" &&
          resolved.activeLanguage === displayLanguage &&
          isCompleteLocalizedProseBag({
            originalFields: original,
            localizedFields: localized,
            requiredFields,
          });

        if (!complete) {
          // Improvement Proposals: prefer caller presentation fallback (WEB_UI
          // system frames) over English CT original when the localized bag is
          // incomplete. Other kinds keep coherent canonical original.
          // `fields` is the browser-visible bag (see displayBag below).
          const incompleteDisplay =
            sourceKind === "improvement_proposal" ? fallback : original;
          setFields(incompleteDisplay);
          setOriginalFields(original);
          setActiveLanguage(
            sourceKind === "improvement_proposal" ? displayLanguage : resolved.originalLanguage,
          );
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
        if (!cancelled && generation === requestGeneration.current) {
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
    fieldOrderSignature,
    readingContext.ready,
    displayLanguage,
  ]);

  // Always render `fields` — including IP WEB_UI presentation fallback when CT
  // is incomplete. `originalFields` remains available for view-original chrome.
  const displayBag = fields;

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
