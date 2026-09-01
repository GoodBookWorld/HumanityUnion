"use client";

import type { ContentTranslationSourceKind } from "@hu/types";

import { PublicTranslatedFields } from "./PublicTranslatedFields";
import { CIVIC_TRANSLATION_FIELD_META } from "../civic-translation-field-meta";

type CivicWarmSourceKind = keyof typeof CIVIC_TRANSLATION_FIELD_META;

export interface CivicPublicTranslatedSectionProps {
  readonly sourceKind: CivicWarmSourceKind;
  readonly sourceRecordId: string;
  readonly fallbackFields: Record<string, string>;
  readonly className?: string;
  /** Subset of allowlisted fields to render (defaults to full allowlist order). */
  readonly fieldOrder?: readonly string[];
}

/**
 * Pack 02G Task 05 — cache-first civic translated display.
 * Does not call POST /generate (Task 04 warm is the generation path).
 */
export function CivicPublicTranslatedSection({
  sourceKind,
  sourceRecordId,
  fallbackFields,
  className,
  fieldOrder,
}: CivicPublicTranslatedSectionProps) {
  const meta = CIVIC_TRANSLATION_FIELD_META[sourceKind];
  const order = fieldOrder ?? [...meta.fieldOrder];

  return (
    <PublicTranslatedFields
      sourceKind={sourceKind as ContentTranslationSourceKind}
      sourceRecordId={sourceRecordId}
      fieldOrder={order}
      fieldLabels={{ ...meta.fieldLabels }}
      fallbackFields={fallbackFields}
      className={["hu-civic-public-translated-section", className]
        .filter(Boolean)
        .join(" ")}
      enableOnDemandGenerate={false}
    />
  );
}
