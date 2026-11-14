import type { PublicPetitionRecord } from "@hu/types";
import { useTranslations } from "next-intl";

import { nextMeaningfulActionKeys } from "../petition-status-i18n";

interface NextMeaningfulActionProps {
  petition: PublicPetitionRecord;
  viewerHasSigned: boolean;
}

export function NextMeaningfulAction({ petition, viewerHasSigned }: NextMeaningfulActionProps) {
  const t = useTranslations("initiativeExperience");
  const action = nextMeaningfulActionKeys(petition.status, viewerHasSigned);

  return (
    <div className="next-meaningful-action">
      <p className="next-meaningful-action__title">{t(action.titleKey)}</p>
      <p className="next-meaningful-action__detail">{t(action.detailKey)}</p>
    </div>
  );
}
