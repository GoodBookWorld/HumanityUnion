"use client";

import { useTranslations } from "next-intl";

import { MediaSemanticNode } from "../language/media-plp/media-semantic-contract";
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
    >
      <p className="hux-workflow-stage__number" aria-hidden="true">
        {index + 1}
      </p>
      <MediaSemanticNode
        as="p"
        className="hux-workflow-stage__progress"
        owner="UI_DICTIONARY"
        result="LOCALIZED_DICTIONARY"
      >
        {t("stageOf", { current: index + 1, total: totalStages })}
      </MediaSemanticNode>
      <MediaSemanticNode
        as="h3"
        id={`hux-workflow-stage-${stage.id}-title`}
        className="hux-workflow-stage__title"
        owner="UI_DICTIONARY"
        result="LOCALIZED_DICTIONARY"
      >
        {stage.title}
      </MediaSemanticNode>
      <MediaSemanticNode
        as="p"
        className="hux-workflow-stage__description"
        owner="UI_DICTIONARY"
        result="LOCALIZED_DICTIONARY"
      >
        {stage.description}
      </MediaSemanticNode>
    </article>
  );
}
