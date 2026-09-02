"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { InitiativeLifecycleStageMetadata } from "@hu/types";

import { getInitiativeLifecycleStageProjection } from "../../initiative-lifecycle-stage-workspace";
import {
  formatInitiativeExperienceDate,
  resolvePresentationStatusDisplayLabel,
} from "../initiative-experience-i18n";

import "./current-lifecycle-stage-banner.css";

/**
 * Lifecycle UX Correction Pack 01 Part 2 — "Current Lifecycle Stage" UI element.
 * Pack 02G Task 08B.1 — localized chrome + presentation status labels.
 */
export function CurrentLifecycleStageBanner({
  initiativeId,
  stageId,
  stageLabel,
}: {
  initiativeId: string;
  stageId: string;
  stageLabel: string;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const [metadata, setMetadata] = useState<InitiativeLifecycleStageMetadata | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMetadata(null);

    getInitiativeLifecycleStageProjection(initiativeId, stageId)
      .then((projection) => {
        if (!cancelled) {
          setMetadata(projection.metadata);
        }
      })
      .catch(() => {
        // Presentation-only convenience — never surfaces an error state.
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId, stageId]);

  const publicationLine = metadata?.publishedAt
    ? metadata.version !== null
      ? t("common.publishedVersionDate", {
          version: metadata.version,
          date: formatInitiativeExperienceDate(locale, metadata.publishedAt),
        })
      : t("common.publishedDateOnly", {
          date: formatInitiativeExperienceDate(locale, metadata.publishedAt),
        })
    : metadata
      ? resolvePresentationStatusDisplayLabel(metadata.presentationStatus, t)
      : null;

  return (
    <section
      className="pie-current-stage"
      aria-label={t("overview.currentLifecycleStageAria")}
    >
      <h3 className="pie-current-stage__label">{t("overview.currentLifecycleStage")}</h3>
      <p className="pie-current-stage__value">{stageLabel}</p>
      {publicationLine ? <p className="pie-current-stage__meta">{publicationLine}</p> : null}
    </section>
  );
}
