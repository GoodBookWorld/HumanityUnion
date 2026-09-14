"use client";

import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import type { HumanityUnionAssistantSurfaceId } from "@hu/types";

import { HumanityUnionAssistantOpenButton } from "./HumanityUnionAssistantOpenButton";

/**
 * Compact entry point for non-Lifecycle surfaces that share the one Assistant.
 */
export function SurfaceAssistantEntry({
  surfaceId,
  label,
}: {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly label?: string;
}) {
  const t = useTranslations("initiativeExperience");
  const brand = useLocalizedBrand();
  const resolvedLabel = label ?? t("assistant.entry.openAssistant", { siteName: brand.siteName });

  return (
    <div className="hu-assistant-surface-entry">
      <HumanityUnionAssistantOpenButton surfaceId={surfaceId} label={resolvedLabel} />
    </div>
  );
}
