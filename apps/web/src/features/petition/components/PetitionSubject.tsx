import type { PublicPetitionRecord } from "@hu/types";
import { useTranslations } from "next-intl";

import { ProfileField } from "../../../components/member/ProfileField";
import type { PetitionReadingText } from "../use-petition-reading-text";

const STATUS = "author.petition.public.status";

interface PetitionSubjectProps {
  petition: PublicPetitionRecord;
  readingText: PetitionReadingText;
}

export function PetitionSubject({ petition, readingText }: PetitionSubjectProps) {
  const t = useTranslations("initiativeExperience");
  const { subject } = petition;
  const notSpecified = t(`${STATUS}.overview.notSpecified`);

  return (
    <div className="petition-subject">
      <ProfileField
        label={t("author.petition.fields.title")}
        value={readingText.title || notSpecified}
        lang={readingText.lang}
        dir="auto"
      />
      <ProfileField
        label={t(`${STATUS}.subject.petitionSummary`)}
        value={readingText.summary || notSpecified}
        lang={readingText.lang}
        dir="auto"
      />
      <ProfileField
        label={t(`${STATUS}.subject.approvedDecision`)}
        value={subject.decisionId || notSpecified}
        dir={subject.decisionId ? "ltr" : undefined}
      />
      <p className="petition-subject__note">{t(`${STATUS}.subject.note`)}</p>
    </div>
  );
}
