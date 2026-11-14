import type { CollaborativeAnalysis, CollectiveDecision, PublicPetitionRecord } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  COLLECTIVE_DECISION_STATUS_LABEL_KEYS,
  DECISION_OUTCOME_LABEL_KEYS,
  formatPetitionPercent,
  petitionDecisionText,
  translateToken,
} from "../petition-status-i18n";
import type { InitiativeReadingText } from "../use-initiative-reading-text";

const STATUS = "author.petition.public.status";

interface DecisionContextProps {
  collectiveDecision: CollectiveDecision | null;
  petition: PublicPetitionRecord;
  initiativeText: InitiativeReadingText | null;
  collaborativeAnalysis: CollaborativeAnalysis | null;
}

export function DecisionContext({
  collectiveDecision,
  petition,
  initiativeText,
  collaborativeAnalysis,
}: DecisionContextProps) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  if (!collectiveDecision) {
    return <p className="decision-context__empty">{t(`${STATUS}.decision.empty`)}</p>;
  }

  const text = petitionDecisionText({
    decision: collectiveDecision,
    petition,
    initiativeTitle: initiativeText?.title ?? null,
    translate: (key, values) => t(key, values),
  });
  const outcomeType = collectiveDecision.outcome?.outcomeType;

  return (
    <div className="decision-context">
      <ProfileField
        label={t("author.decisionSession.fields.question")}
        value={text.question || t(`${STATUS}.overview.notSpecified`)}
        dir="auto"
      />
      <ProfileField
        label={t(`${STATUS}.decision.decisionStatus`)}
        value={translateToken(t, COLLECTIVE_DECISION_STATUS_LABEL_KEYS, collectiveDecision.status)}
      />
      <ProfileField
        label={t(`${STATUS}.decision.approvedResult`)}
        value={text.winningOption ?? t(`${STATUS}.decision.resultPending`)}
        dir="auto"
      />
      <ProfileField
        label={t(`${STATUS}.decision.outcome`)}
        value={
          outcomeType
            ? translateToken(t, DECISION_OUTCOME_LABEL_KEYS, outcomeType)
            : t(`${STATUS}.decision.outcomePending`)
        }
      />
      <ProfileField
        label={t(`${STATUS}.decision.outcomeExplanation`)}
        value={text.explanation || t(`${STATUS}.overview.notAvailable`)}
        dir="auto"
      />
      <ProfileField
        label={t(`${STATUS}.decision.initiativeContext`)}
        value={initiativeText?.description || t(`${STATUS}.decision.initiativeUnavailable`)}
        lang={initiativeText?.description ? initiativeText.lang : undefined}
        dir="auto"
      />
      <ProfileField
        label={t(`${STATUS}.decision.analysisReadiness`)}
        value={
          collaborativeAnalysis
            ? t(`${STATUS}.decision.readinessValue`, {
                percent: formatPetitionPercent(
                  locale,
                  collaborativeAnalysis.readiness.readinessScore,
                ),
              })
            : t(`${STATUS}.overview.notAvailable`)
        }
      />
      {text.synthetic ? (
        <p className="decision-context__note">{t(`${STATUS}.decision.synthetic.note`)}</p>
      ) : null}
      <p className="decision-context__note">{t(`${STATUS}.decision.note`)}</p>
    </div>
  );
}
