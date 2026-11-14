import type { PublicPetitionRecord } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";

import { ProfileField } from "../../../components/member/ProfileField";

import { publicPetitionHref } from "../../initiative-petition-lifecycle/petition-viewer-selection";
import {
  PETITION_PIPELINE_STAGES,
  PETITION_STATE_LABEL_KEYS,
  formatPetitionDate,
  petitionPipelineStageStateKey,
  supportStatusSummaryKey,
  translateToken,
} from "../petition-status-i18n";
import type { PetitionReadingText } from "../use-petition-reading-text";

const STATUS = "author.petition.public.status";

interface PetitionStatusProps {
  petition: PublicPetitionRecord;
  readingText: PetitionReadingText;
}

export function PetitionStatus({ petition, readingText }: PetitionStatusProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const { policy, shareLink, status } = petition;
  const date = (value: string | null | undefined) =>
    formatPetitionDate(locale, value) ?? t(`${STATUS}.overview.notScheduled`);
  const supportSummaryKey = supportStatusSummaryKey(status);

  return (
    <div className="petition-status">
      <p className="petition-status__intro">{t(`${STATUS}.overview.intro`)}</p>

      <ul className="petition-status__pipeline" aria-label={t(`${STATUS}.overview.pipelineAria`)}>
        {PETITION_PIPELINE_STAGES.map(({ stage, labelKey }) => (
          <li key={stage} className="petition-status__pipeline-item">
            <span className="petition-status__pipeline-stage">{t(labelKey)}</span>
            <span className="petition-status__pipeline-state">
              {t(petitionPipelineStageStateKey(stage))}
            </span>
          </li>
        ))}
      </ul>

      <ProfileField
        label={t("author.petition.fields.title")}
        value={readingText.title || t(`${STATUS}.overview.notSpecified`)}
        lang={readingText.lang}
        dir="auto"
      />
      <ProfileField
        label={t(`${STATUS}.overview.lifecycleState`)}
        value={translateToken(t, PETITION_STATE_LABEL_KEYS, status)}
      />
      <ProfileField
        label={t(`${STATUS}.overview.supportStatus`)}
        value={supportSummaryKey ? t(supportSummaryKey) : status}
      />
      <ProfileField label={t(`${STATUS}.overview.created`)} value={date(petition.createdAt)} />
      <ProfileField
        label={t(`${STATUS}.overview.openingDate`)}
        value={date(policy.endorsementPeriod.opensAt)}
      />
      <ProfileField
        label={t(`${STATUS}.overview.closingDate`)}
        value={date(policy.endorsementPeriod.closesAt)}
      />
      <ProfileField
        label={t(`${STATUS}.overview.shareLink`)}
        dir={shareLink ? "ltr" : undefined}
        value={
          shareLink
            ? publicPetitionHref(petition.subject.initiativeId, petition.petitionId)
            : status === "Published" ||
                status === "Open" ||
                status === "Closed" ||
                status === "Archived"
              ? t(`${STATUS}.overview.notAvailable`)
              : t(`${STATUS}.overview.availableAfterPublication`)
        }
      />
    </div>
  );
}
