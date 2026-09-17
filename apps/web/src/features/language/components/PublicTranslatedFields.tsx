"use client";

import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { formatLanguageDisplayName } from "../format-language-display-name";
import { resolvePublicContentDisplayLanguage } from "../resolve-public-content-display-language";
import { useHuPersistedOrdinaryFields } from "../use-hu-persisted-ordinary-fields";
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
   * Prop is ignored; ordinary public reading never generates on miss.
   */
  readonly enableOnDemandGenerate?: boolean;
}

/**
 * Ordinary public reading presentation for published civic/lifecycle prose.
 *
 * Pack 1 WEB invariant:
 * - Normal browser: visible fields stay canonical/fallback (browser-native).
 * - No CT post-mount overwrite in browser mode.
 *
 * PWA Full Translation Pack 01:
 * - Standalone + uk|ar|zh-Hant: cache-only CURRENT persisted fields.
 * - Missing/stale/incomplete → canonical fallback.
 * - Never provider-on-read.
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
  const persisted = useHuPersistedOrdinaryFields({
    sourceKind,
    sourceRecordId,
    fallbackFields,
    fieldOrder,
  });

  const fields =
    persisted.owner === "hu-persisted" && persisted.presentationMode === "localized"
      ? persisted.fields
      : fallbackFields;
  const originalFields =
    persisted.owner === "hu-persisted" ? persisted.originalFields : fallbackFields;
  const presentationMode =
    persisted.owner === "hu-persisted" ? persisted.presentationMode : ("original" as const);
  const activeLanguage: LanguageCode =
    persisted.owner === "hu-persisted" && persisted.presentationMode === "localized"
      ? persisted.activeLanguage
      : DEFAULT_PLATFORM_LANGUAGE;
  const originalLanguage: LanguageCode =
    persisted.owner === "hu-persisted" ? persisted.originalLanguage : DEFAULT_PLATFORM_LANGUAGE;
  const preferredLanguage: LanguageCode = displayLanguage;
  const readingOwner = persisted.owner;

  return (
    <div
      className={["hu-public-translated-fields", className].filter(Boolean).join(" ")}
      data-hu-localization-boundary="visible-content"
      data-hu-presentation-mode={presentationMode}
      data-hu-reading-owner={readingOwner}
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
              canViewOriginal={
                persisted.owner === "hu-persisted" ? persisted.canViewOriginal : false
              }
              isMachineTranslated={
                persisted.owner === "hu-persisted" ? persisted.isMachineTranslated : false
              }
              isStale={persisted.owner === "hu-persisted" ? persisted.isStale : false}
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
