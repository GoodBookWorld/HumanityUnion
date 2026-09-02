"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { InitiativeLifecycleStageProjection } from "@hu/types";

import {
  resolveLifecycleStageDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";

/**
 * Initiative Lifecycle — Part A Completion Part 8: the public-result and
 * Upcoming boundary/slot.
 *
 * Pack 02G 08D.2 — shared chrome localized; civic result slot content is
 * unchanged and owned by stage packs.
 */
export function InitiativeLifecyclePublicResultPanel({
  projection,
  publicResultSlot,
  participationSlot,
  isPreview = false,
}: {
  projection: InitiativeLifecycleStageProjection;
  publicResultSlot?: ReactNode;
  participationSlot?: ReactNode;
  isPreview?: boolean;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const stageLabel = resolveLifecycleStageDisplayLabel(
    projection.stageId,
    t,
    projection.stageLabel,
  );
  const hasPublicResult = projection.metadata.canViewPublicResult;
  const hasDraftToPreview = isPreview && !hasPublicResult && projection.metadata.hasUnpublishedChanges;

  if (!hasPublicResult && !hasDraftToPreview) {
    return (
      <div className="lsw-upcoming" role="status">
        <p className="lsw-upcoming__label">{t("author.shared.notStarted")}</p>
        <p className="lsw-upcoming__copy">
          {isPreview
            ? t("author.shared.upcomingPreviewEmpty", { stage: stageLabel })
            : t("author.shared.upcomingPublicEmpty", { stage: stageLabel })}
        </p>
      </div>
    );
  }

  if (hasDraftToPreview) {
    return (
      <div className="lsw-result" translate="yes">
        <h3 className="lsw-result__title">{stageLabel}</h3>
        <p className="lsw-result__meta">{t("author.shared.draftPreviewMeta")}</p>
        {publicResultSlot ?? (
          <p className="lsw-result__placeholder">{t("author.shared.draftPreviewPlaceholder")}</p>
        )}
      </div>
    );
  }

  const publishedAtLabel = (() => {
    if (!projection.metadata.publishedAt) {
      return null;
    }

    try {
      return new Date(projection.metadata.publishedAt).toLocaleDateString(locale, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return null;
    }
  })();

  const meta =
    publishedAtLabel && projection.metadata.version !== null
      ? t("author.shared.publishedMetaWithVersion", {
          date: publishedAtLabel,
          version: projection.metadata.version,
        })
      : publishedAtLabel
        ? t("author.shared.publishedMeta", { date: publishedAtLabel })
        : projection.metadata.version !== null
          ? t("author.shared.versionOnlyMeta", { version: projection.metadata.version })
          : null;

  return (
    <div className="lsw-result" translate="yes">
      <h3 className="lsw-result__title">{stageLabel}</h3>
      {meta ? <p className="lsw-result__meta">{meta}</p> : null}
      {publicResultSlot ?? (
        <p className="lsw-result__placeholder">{t("author.shared.publishedResultPlaceholder")}</p>
      )}
      {participationSlot ?? null}
    </div>
  );
}
