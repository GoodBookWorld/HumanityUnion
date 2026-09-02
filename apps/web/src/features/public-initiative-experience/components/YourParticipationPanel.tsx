"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CollectiveParticipationJourney } from "@hu/types";

import {
  resolveCollectiveParticipationActionLabelDisplay,
  resolveCollectiveParticipationReasonDisplay,
  resolveCollectiveParticipationStatusDisplay,
  resolveLifecycleStageDisplayLabel,
} from "../initiative-experience-i18n";

interface YourParticipationPanelProps {
  readonly journey: CollectiveParticipationJourney;
  readonly isAuthorPrimary: boolean;
}

/**
 * Phase 05 — compact "Your Participation" panel inside the Initiative shell.
 * Does not replace Author Mode for stewards.
 * Pack 02G Task 08G — localizes journey status/label/reason via semantic codes.
 */
export function YourParticipationPanel({
  journey,
  isAuthorPrimary,
}: YourParticipationPanelProps) {
  const t = useTranslations("initiativeExperience");
  const signedOut = journey.participantId === null;
  const stageLabel = resolveLifecycleStageDisplayLabel(
    journey.currentStageId,
    t,
    journey.currentStageLabel,
  );

  return (
    <section className="pie-participation" aria-labelledby="pie-participation-title">
      <h2 id="pie-participation-title" className="pie-participation__title">
        {t("sidebar.participation.title")}
      </h2>

      {isAuthorPrimary ? (
        <p className="pie-participation__note">{t("sidebar.participation.authorNote")}</p>
      ) : null}

      <p className="pie-participation__stage">
        {t("sidebar.participation.currentStage", { stage: stageLabel })}
        {journey.activeAlly ? t("sidebar.participation.activeAllySuffix") : null}
      </p>

      {signedOut ? (
        <p className="pie-participation__empty">{t("sidebar.participation.signIn")}</p>
      ) : journey.pastActions.length === 0 ? (
        <p className="pie-participation__empty">{t("sidebar.participation.noContributions")}</p>
      ) : (
        <ul className="pie-participation__past">
          {journey.pastActions.slice(0, 5).map((action) => (
            <li key={`${action.actionType}-${action.occurredAt}`}>
              <Link href={action.deepLink}>
                {resolveCollectiveParticipationStatusDisplay(
                  action.statusCode,
                  action.statusParams,
                  t,
                  action.statusLabel,
                )}
              </Link>
              <span className="pie-participation__meta">
                {" "}
                · {resolveLifecycleStageDisplayLabel(action.stageId, t)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {journey.nextAction ? (
        <div className="pie-participation__next">
          <p className="pie-participation__next-label">
            {t("sidebar.participation.nextMeaningfulAction")}
          </p>
          <Link className="pie-participation__next-link" href={journey.nextAction.deepLink}>
            {resolveCollectiveParticipationActionLabelDisplay(
              journey.nextAction.labelCode,
              t,
              journey.nextAction.label,
            )}
          </Link>
          <p className="pie-participation__reason">
            {resolveCollectiveParticipationReasonDisplay(
              journey.nextAction.reasonCode,
              journey.nextAction.reasonParams,
              t,
              journey.nextAction.reason,
            )}
          </p>
        </div>
      ) : (
        <p className="pie-participation__empty">{t("sidebar.participation.noActionAvailable")}</p>
      )}
    </section>
  );
}
