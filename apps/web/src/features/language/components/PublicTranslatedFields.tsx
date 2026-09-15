"use client";

import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { formatLanguageDisplayName } from "../format-language-display-name";
import { resolvePublicContentDisplayLanguage } from "../resolve-public-content-display-language";
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
   * Prop is ignored; ordinary public reading uses stable canonical/fallback DOM.
   */
  readonly enableOnDemandGenerate?: boolean;
}

/**
 * Ordinary public reading presentation for published civic/lifecycle prose.
 *
 * Stable Browser Translation Pack 1 — Layer 1 reading ownership:
 * - Visible fields are the caller canonical/fallback bag only.
 * - Do not asynchronously resolve or apply CT into visible React text after mount
 *   (that races and overwrites browser-native translation).
 * - CT infrastructure remains available for Search/SEO/warm outside this path.
 *
 * `sourceKind` / `sourceRecordId` remain in the API for callers and diagnostics;
 * they are not used to fetch CT for ordinary reading presentation.
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
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);

  // Stable canonical/fallback DOM — no post-mount CT setFields.
  const fields = fallbackFields;
  const originalFields = fallbackFields;
  const presentationMode = "original" as const;
  const activeLanguage: LanguageCode = DEFAULT_PLATFORM_LANGUAGE;
  const originalLanguage: LanguageCode = DEFAULT_PLATFORM_LANGUAGE;
  const preferredLanguage: LanguageCode = displayLanguage;

  return (
    <div
      className={["hu-public-translated-fields", className].filter(Boolean).join(" ")}
      data-hu-localization-boundary="visible-content"
      data-hu-presentation-mode={presentationMode}
      data-hu-reading-owner="browser-native"
      data-hu-source-kind={sourceKind}
      data-hu-source-record-id={sourceRecordId}
    >
      {fieldOrder.map((fieldKey) => {
        const value = fields[fieldKey]?.trim() ?? "";
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
              canViewOriginal={false}
              isMachineTranslated={false}
              isStale={false}
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
