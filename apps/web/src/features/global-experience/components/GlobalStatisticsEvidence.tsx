import type { ParticipationPublicStatisticsProjection } from "@hu/types";

interface GlobalStatisticsEvidenceProps {
  projection: ParticipationPublicStatisticsProjection;
}

export function GlobalStatisticsEvidence({ projection }: GlobalStatisticsEvidenceProps) {
  return (
    <div className="global-statistics">
      <p className="global-statistics__scope">
        Scope: {projection.scopeLabel}
        {projection.source === "bootstrap" ? (
          <span className="global-statistics__source"> · Bootstrap demonstration data</span>
        ) : null}
      </p>

      <dl
        className="global-statistics__list"
        aria-label={`Participation indicators at ${projection.scopeLabel} scope`}
      >
        {projection.indicators.map((indicator) => (
          <div key={indicator.id} className="global-statistics__item">
            <dt className="global-statistics__label">
              {indicator.label}
              {indicator.derived ? (
                <span className="global-statistics__derived"> derived</span>
              ) : null}
            </dt>
            <dd className="global-statistics__value">{indicator.value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
