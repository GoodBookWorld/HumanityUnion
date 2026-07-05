import type { ParticipationPipelinePublicProjection } from "@hu/types";

interface ParticipationPipelineEvidenceProps {
  projection: ParticipationPipelinePublicProjection;
}

export function ParticipationPipelineEvidence({ projection }: ParticipationPipelineEvidenceProps) {
  const totalCount = projection.stages.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <div className="participation-pipeline">
      <p className="participation-pipeline__scope">
        Scope: {projection.scopeLabel}
        {projection.source === "bootstrap" ? (
          <span className="participation-pipeline__source"> · Bootstrap demonstration data</span>
        ) : null}
      </p>

      <ol
        className="participation-pipeline__stages"
        aria-label={`Participation pipeline stages at ${projection.scopeLabel} scope`}
      >
        {projection.stages.map((stage) => {
          const proportion = totalCount > 0 ? (stage.count / totalCount) * 100 : 0;

          return (
            <li key={stage.stageId} className="participation-pipeline__stage">
              <div className="participation-pipeline__stage-header">
                <span className="participation-pipeline__stage-label">{stage.label}</span>
                <span className="participation-pipeline__stage-count">
                  {stage.count.toLocaleString()}
                </span>
              </div>
              <div
                className="participation-pipeline__stage-bar"
                role="presentation"
                aria-hidden="true"
              >
                <span
                  className="participation-pipeline__stage-bar-fill"
                  style={{ width: `${proportion}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
