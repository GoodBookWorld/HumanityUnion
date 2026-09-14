"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicInitiativeImplementationTrackingListItem } from "@hu/types";

import { listPublicInitiativeImplementationTrackings } from "../../initiative-implementation-tracking/api";
import { CivicPublicTranslatedSection } from "../../language";
import { resolvePresentationStatusDisplayLabel } from "../../public-initiative-experience/initiative-experience-i18n";
import { looksLikeRawI18nKey } from "../../public-initiative-experience/normalize-initiative-status-code";

import "./initiative-implementation-tracking-stage-workspace.css";

interface InitiativeImplementationTrackingPublicResultProps {
  readonly initiativeId: string;
  readonly isPreview?: boolean;
}

/**
 * Initiative Lifecycle — Part J, Section 6/15. Read-only for every
 * viewer, including the Initiative's Author — a responsible
 * Participant's own progress update happens in their own working
 * sidebar's Progress Inbox, never here.
 */
export function InitiativeImplementationTrackingPublicResult({
  initiativeId,
  isPreview = false,
}: InitiativeImplementationTrackingPublicResultProps) {
  const t = useTranslations("initiativeExperience");
  const [trackings, setTrackings] = useState<
    readonly PublicInitiativeImplementationTrackingListItem[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await listPublicInitiativeImplementationTrackings(initiativeId);
        if (!cancelled) {
          setTrackings(result.trackings);
        }
      } catch {
        if (!cancelled) {
          setError(t("author.tracking.public.loadFailed"));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initiativeId, t]);

  if (error) {
    return <p className="iit-source-panel__empty">{error}</p>;
  }

  if (!trackings) {
    return <p className="iit-source-panel__empty">{t("author.tracking.public.loading")}</p>;
  }

  if (trackings.length === 0) {
    return <p className="iit-source-panel__empty">{t("author.tracking.public.empty")}</p>;
  }

  return (
    <article className="iit-public" aria-label={t("author.tracking.public.aria")}>
      {isPreview ? (
        <p className="iit-public__meta">{t("author.tracking.public.previewMeta")}</p>
      ) : null}
      <section className="iit-public__section">
        <h3>{t("author.tracking.public.heading")}</h3>
        <p className="iit-public__meta">
          {t("author.tracking.public.publishedCount", { count: trackings.length })}
        </p>
      </section>

      {trackings.map((tracking) => {
        const stageRaw = tracking.currentStage;
        const stageLabel = resolvePresentationStatusDisplayLabel(stageRaw, t);
        const safeStage =
          stageLabel && !looksLikeRawI18nKey(stageLabel) ? stageLabel : stageRaw.replaceAll("_", " ");

        return (
          <div className="iit-public__tracking" key={tracking.trackingId}>
            <CivicPublicTranslatedSection
              sourceKind="implementation_tracking"
              sourceRecordId={tracking.trackingId}
              fallbackFields={{
                approvedAction: tracking.approvedAction ?? "",
                summary: tracking.summary,
                currentStage: tracking.currentStage,
                notes: "",
              }}
              fieldOrder={["approvedAction", "summary", "currentStage"]}
            />
            <p className="iit-public__meta">
              {tracking.authorDisplayName}
              {tracking.progress !== null
                ? t("author.tracking.public.progressMeta", { progress: tracking.progress })
                : ""}
            </p>
            <span className="iit-public__tracking-status">{safeStage}</span>
          </div>
        );
      })}
    </article>
  );
}
