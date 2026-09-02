"use client";

import { useTranslations } from "next-intl";

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
  const resolvedLabel = label ?? t("assistant.entry.openAssistant");

  return (
    <div className="hu-assistant-surface-entry">
      <HumanityUnionAssistantOpenButton surfaceId={surfaceId} label={resolvedLabel} />
    </div>
  );
}
