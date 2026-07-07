interface PipelineStageProps {
  label: string;
}

export function PipelineStage({ label }: PipelineStageProps) {
  return <span className="hu-pipeline-stage">{label}</span>;
}
