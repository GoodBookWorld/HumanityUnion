import type { HuxWorkflowStageItem } from "./hux.types";

interface HuxWorkflowStageProps {
  stage: HuxWorkflowStageItem;
  index: number;
  totalStages: number;
}

export function HuxWorkflowStage({ stage, index, totalStages }: HuxWorkflowStageProps) {
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
      <p className="hux-workflow-stage__progress">
        Stage {index + 1} of {totalStages}
      </p>
      <h3 id={`hux-workflow-stage-${stage.id}-title`} className="hux-workflow-stage__title">
        {stage.title}
      </h3>
      <p className="hux-workflow-stage__description">{stage.description}</p>
    </article>
  );
}
