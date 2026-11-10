"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { formatLanguageDisplayName } from "../format-language-display-name";
import { resolvePublicContentDisplayLanguage } from "../resolve-public-content-display-language";
import {
  translatedContentHasDistinctTranslation,
  type TranslatedContentViewMode,
} from "../translated-content-view-mode";
import { useHuPersistedOrdinaryFields } from "../use-hu-persisted-ordinary-fields";
import { TranslatedContentSharedChrome, TranslatedContentView } from "./TranslatedContentView";

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
  /**
   * HU-LC-05C.4C.3B — `fields` (default) gives every field its own translation
   * chrome. `document` shows one shared chrome for the whole record; all fields
   * switch between translation and original together.
   */
  readonly presentation?: "fields" | "document";
  /** Document presentation only — field rendered as the document heading (no field label). */
  readonly headingField?: string;
  /** Document presentation only — rendered between the heading and the shared chrome. */
  readonly headerContent?: ReactNode;
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
  presentation = "fields",
  headingField,
  headerContent,
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
  const canViewOriginal = persisted.owner === "hu-persisted" ? persisted.canViewOriginal : false;
  const isMachineTranslated =
    persisted.owner === "hu-persisted" ? persisted.isMachineTranslated : false;
  const isStale = persisted.owner === "hu-persisted" ? persisted.isStale : false;

  // "View original" is scoped to the reading language it was chosen in.
  const [originalPreferredFor, setOriginalPreferredFor] = useState<LanguageCode | null>(null);

  const preferredReadingLanguageNote = preferredLanguage ? (
    <span className="hu-public-translated-field__sr">
      {t("translation.preferredReadingLanguageSr", {
        language: formatLanguageDisplayName(locale, preferredLanguage),
      })}
    </span>
  ) : null;

  if (presentation === "document") {
    return (
      <div
        className={["hu-public-translated-fields", "hu-public-translated-document", className]
          .filter(Boolean)
          .join(" ")}
        data-hu-localization-boundary="visible-content"
        data-hu-presentation-mode={presentationMode}
        data-hu-presentation-layout="document"
        data-hu-reading-owner={readingOwner}
        data-hu-source-kind={sourceKind}
        data-hu-source-record-id={sourceRecordId}
      >
        <PublicTranslatedDocumentContent
          fieldOrder={fieldOrder}
          fieldLabels={fieldLabels}
          fields={fields}
          originalFields={originalFields}
          headingField={headingField}
          headerContent={headerContent}
          activeLanguage={activeLanguage}
          originalLanguage={originalLanguage}
          canViewOriginal={canViewOriginal}
          isMachineTranslated={isMachineTranslated}
          isStale={isStale}
          prefersOriginal={originalPreferredFor === activeLanguage}
          onPrefersOriginalChange={(prefersOriginal) =>
            setOriginalPreferredFor(prefersOriginal ? activeLanguage : null)
          }
        />
        {preferredReadingLanguageNote}
      </div>
    );
  }

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

export interface PublicTranslatedDocumentContentProps {
  readonly fieldOrder: readonly string[];
  readonly fieldLabels: Record<string, string>;
  readonly fields: Record<string, string>;
  readonly originalFields: Record<string, string>;
  readonly headingField?: string;
  readonly headerContent?: ReactNode;
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly canViewOriginal: boolean;
  readonly isMachineTranslated: boolean;
  readonly isStale: boolean;
  readonly prefersOriginal: boolean;
  readonly onPrefersOriginalChange: (prefersOriginal: boolean) => void;
}

/**
 * HU-LC-05C.4C.3B — document body of `PublicTranslatedFields`: one shared
 * translation chrome; every field body follows the same translation/original mode.
 */
export function PublicTranslatedDocumentContent({
  fieldOrder,
  fieldLabels,
  fields,
  originalFields,
  headingField,
  headerContent,
  activeLanguage,
  originalLanguage,
  canViewOriginal,
  isMachineTranslated,
  isStale,
  prefersOriginal,
  onPrefersOriginalChange,
}: PublicTranslatedDocumentContentProps) {
  const visibleFields = fieldOrder.flatMap((fieldKey) => {
    const value = fields[fieldKey]?.trim() ?? "";
    const original = originalFields[fieldKey] ?? "";
    if (!value && !original) {
      return [];
    }
    return [{ fieldKey, content: value.length > 0 ? value : original, original }];
  });
  const documentContent = visibleFields.map((field) => field.content).join("\n");
  const documentOriginal = visibleFields.map((field) => field.original).join("\n");
  const hasDistinctTranslation = translatedContentHasDistinctTranslation({
    content: documentContent,
    originalContent: documentOriginal,
    canViewOriginal,
  });
  const mode: TranslatedContentViewMode =
    hasDistinctTranslation && !prefersOriginal ? "translation" : "original";
  const setMode = (next: TranslatedContentViewMode) => {
    onPrefersOriginalChange(next === "original");
  };
  const renderBody = (field: (typeof visibleFields)[number]) => (
    <TranslatedContentView
      chrome="body"
      mode={mode}
      onModeChange={setMode}
      content={field.content}
      originalContent={field.original}
      activeLanguage={activeLanguage}
      originalLanguage={originalLanguage}
      canViewOriginal={canViewOriginal}
      isMachineTranslated={isMachineTranslated}
      isStale={isStale}
    />
  );
  const heading = visibleFields.find((field) => field.fieldKey === headingField);

  return (
    <>
      {heading ? (
        <h3 className="hu-public-translated-document__title">{renderBody(heading)}</h3>
      ) : null}
      {headerContent}
      <TranslatedContentSharedChrome
        mode={mode}
        onModeChange={setMode}
        activeLanguage={activeLanguage}
        originalLanguage={originalLanguage}
        canViewOriginal={canViewOriginal}
        content={documentContent}
        originalContent={documentOriginal}
        isMachineTranslated={isMachineTranslated}
        isStale={isStale}
      />
      {visibleFields
        .filter((field) => field.fieldKey !== headingField)
        .map((field) => (
          <div key={field.fieldKey} className="hu-public-translated-field">
            <h4>{fieldLabels[field.fieldKey] ?? field.fieldKey}</h4>
            {renderBody(field)}
          </div>
        ))}
    </>
  );
}
