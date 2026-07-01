import type { Readiness } from "@hu/types";

import "./readiness-dashboard.css";

interface ReadinessDashboardProps {
  readiness: Readiness;
}

function formatRequirementList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

export function ReadinessDashboard({ readiness }: ReadinessDashboardProps) {
  return (
    <div className="readiness-dashboard">
      <div className="readiness-dashboard__score">
        <span className="readiness-dashboard__score-label">Readiness</span>
        <span className="readiness-dashboard__score-value">{readiness.readinessScore}%</span>
      </div>

      <dl className="readiness-dashboard__list">
        <div className="readiness-dashboard__item">
          <dt>Satisfied requirements</dt>
          <dd>{formatRequirementList(readiness.satisfiedRequirements)}</dd>
        </div>
        <div className="readiness-dashboard__item">
          <dt>Missing requirements</dt>
          <dd>{formatRequirementList(readiness.missingRequirements)}</dd>
        </div>
        <div className="readiness-dashboard__item">
          <dt>Blocking issues</dt>
          <dd>{formatRequirementList(readiness.blockingIssues)}</dd>
        </div>
      </dl>
    </div>
  );
}
