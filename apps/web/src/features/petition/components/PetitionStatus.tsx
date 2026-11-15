"use client";

import type { PublicPetitionRecord } from "@hu/types";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ProfileField } from "../../../components/member/ProfileField";

import { resolveAbsoluteCivicShareUrl } from "../../civic-share/civic-share.urls";
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
  const tNews = useTranslations("publicNews");
  const locale = useLocale();
  const { policy, shareLink, status } = petition;
  const date = (value: string | null | undefined) =>
    formatPetitionDate(locale, value) ?? t(`${STATUS}.overview.notScheduled`);
  const supportSummaryKey = supportStatusSummaryKey(status);

  const relativeSharePath = shareLink
    ? publicPetitionHref(petition.subject.initiativeId, petition.petitionId)
    : null;
  const [absoluteShareUrl, setAbsoluteShareUrl] = useState(() =>
    relativeSharePath ? resolveAbsoluteCivicShareUrl(relativeSharePath) : "",
  );
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!relativeSharePath) {
      setAbsoluteShareUrl("");
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : undefined;
    setAbsoluteShareUrl(resolveAbsoluteCivicShareUrl(relativeSharePath, origin));
  }, [relativeSharePath]);

  async function handleCopyShareLink() {
    if (!absoluteShareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(absoluteShareUrl);
      setCopyStatus(tNews("card.linkCopied"));
    } catch {
      setCopyStatus(tNews("card.copyUnavailable"));
    }
  }

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
      {relativeSharePath && absoluteShareUrl ? (
        <div className="profile-field petition-status__share-field">
          <span className="profile-field__label">{t(`${STATUS}.overview.shareLink`)}</span>
          <div className="profile-field__value petition-status__share-value" dir="ltr">
            <a
              className="petition-status__share-link"
              href={absoluteShareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {absoluteShareUrl}
            </a>
            <button
              type="button"
              className="petition-status__share-copy"
              onClick={() => void handleCopyShareLink()}
            >
              {t("author.archive.share.share")}
            </button>
            {copyStatus ? (
              <span className="petition-status__share-copied" role="status">
                {copyStatus}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <ProfileField
          label={t(`${STATUS}.overview.shareLink`)}
          value={
            status === "Published" ||
            status === "Open" ||
            status === "Closed" ||
            status === "Archived"
              ? t(`${STATUS}.overview.notAvailable`)
              : t(`${STATUS}.overview.availableAfterPublication`)
          }
        />
      )}
    </div>
  );
}
