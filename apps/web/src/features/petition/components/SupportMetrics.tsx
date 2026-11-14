import type { PublicPetitionRecord } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  formatPetitionDate,
  formatPetitionList,
  formatPetitionNumber,
} from "../petition-status-i18n";

const SUPPORT = "author.petition.public.status.support";

interface SupportMetricsProps {
  petition: PublicPetitionRecord;
}

export function SupportMetrics({ petition }: SupportMetricsProps) {
  const t = useTranslations("initiativeExperience");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const { supportMetrics, status } = petition;
  const { supportThresholdStatus } = supportMetrics;
  const isFinal = status === "Closed" || status === "Archived";

  return (
    <div className="support-metrics">
      <ProfileField
        label={isFinal ? t(`${SUPPORT}.finalCount`) : t(`${SUPPORT}.count`)}
        value={formatPetitionNumber(locale, supportMetrics.totalSignatures)}
      />
      <ProfileField
        label={t(`${SUPPORT}.participantSignatures`)}
        value={formatPetitionNumber(locale, supportMetrics.participantSignatures)}
      />
      {supportThresholdStatus.thresholdDefined ? (
        <>
          <ProfileField
            label={t(`${SUPPORT}.thresholdProgress`)}
            value={t(`${SUPPORT}.thresholdProgressValue`, {
              current: supportThresholdStatus.currentCount,
              target: supportThresholdStatus.thresholdCount ?? 0,
            })}
          />
          <ProfileField
            label={t(`${SUPPORT}.thresholdReached`)}
            value={supportThresholdStatus.thresholdReached ? tAuth("yes") : tAuth("no")}
          />
        </>
      ) : (
        <ProfileField label={t(`${SUPPORT}.threshold`)} value={t(`${SUPPORT}.noThreshold`)} />
      )}
      {supportMetrics.dailyActivity.length > 0 ? (
        <ProfileField
          label={t(`${SUPPORT}.recentActivity`)}
          value={formatPetitionList(
            locale,
            supportMetrics.dailyActivity.slice(-3).map((entry) =>
              t(`${SUPPORT}.activityEntry`, {
                date: formatPetitionDate(locale, entry.date, "short") ?? entry.date,
                count: entry.signatureCount,
              }),
            ),
          )}
        />
      ) : (
        <p className="support-metrics__empty">
          {status === "Open" ? t(`${SUPPORT}.emptyOpen`) : t(`${SUPPORT}.emptyPending`)}
        </p>
      )}
    </div>
  );
}
