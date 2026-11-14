import type { PublicPetitionRecord } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  PETITION_OUTCOME_LABEL_KEYS,
  formatPetitionNumber,
  petitionOutcomeExplanationKey,
  translateToken,
} from "../petition-status-i18n";

const STATUS = "author.petition.public.status";

interface PetitionOutcomeSectionProps {
  petition: PublicPetitionRecord;
}

const VISIBLE_STATUSES = new Set<PublicPetitionRecord["status"]>(["Closed", "Archived"]);

export function PetitionOutcomeSection({ petition }: PetitionOutcomeSectionProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  if (!VISIBLE_STATUSES.has(petition.status)) {
    return <p className="petition-outcome__empty">{t(`${STATUS}.outcome.pending`)}</p>;
  }

  if (!petition.outcome) {
    return <p className="petition-outcome__empty">{t(`${STATUS}.outcome.unavailable`)}</p>;
  }

  return (
    <div className="petition-outcome">
      <ProfileField
        label={t(`${STATUS}.outcome.outcomeType`)}
        value={translateToken(t, PETITION_OUTCOME_LABEL_KEYS, petition.outcome.outcomeType)}
      />
      <ProfileField
        label={t(`${STATUS}.outcome.explanation`)}
        value={t(petitionOutcomeExplanationKey(petition.outcome.outcomeType))}
      />
      <ProfileField
        label={t(`${STATUS}.support.finalCount`)}
        value={formatPetitionNumber(locale, petition.supportMetrics.totalSignatures)}
      />
      {petition.supportMetrics.supportThresholdStatus.thresholdDefined ? (
        <ProfileField
          label={t(`${STATUS}.outcome.thresholdStatus`)}
          value={
            petition.supportMetrics.supportThresholdStatus.thresholdReached
              ? t(`${STATUS}.outcome.thresholdReached`)
              : t(`${STATUS}.outcome.thresholdNotReached`)
          }
        />
      ) : null}
    </div>
  );
}
