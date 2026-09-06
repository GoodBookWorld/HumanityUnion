"use client";

import { useTranslations } from "next-intl";

import type { HuxWorkflowStageItem } from "./hux.types";

interface HuxWorkflowStageProps {
  stage: HuxWorkflowStageItem;
  index: number;
  totalStages: number;
}

export function HuxWorkflowStage({ stage, index, totalStages }: HuxWorkflowStageProps) {
  const t = useTranslations("civicMediaPublic.pipeline");
  return (
    <article
      className={`hux-workflow-stage${
        stage.highlighted ? " hux-workflow-stage--highlighted" : ""
      }`}
      aria-labelledby={`hux-workflow-stage-${stage.id}-title`}
      data-hu-semantic-owner="UI_DICTIONARY"
    >
      <p className="hux-workflow-stage__number" aria-hidden="true">
        {index + 1}
      </p>
      <p className="hux-workflow-stage__progress">
        {t("stageOf", { current: index + 1, total: totalStages })}
      </p>
      <h3 id={`hux-workflow-stage-${stage.id}-title`} className="hux-workflow-stage__title">
        {stage.title}
      </h3>
      <p className="hux-workflow-stage__description">{stage.description}</p>
    </article>
  );
}
