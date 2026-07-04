import type { Implementation } from "@hu/types";

import {
  getMilestonesForPhase,
  getRemainingOptionalMilestones,
  getRemainingRequiredMilestones,
  getSatisfiedMilestones,
  sortPhases,
} from "../implementation-utils";

interface MilestonesSectionProps {
  implementation: Implementation;
}

function MilestoneList({
  title,
  milestones,
  emptyMessage,
}: {
  title: string;
  milestones: Implementation["milestones"];
  emptyMessage: string;
}) {
  if (milestones.length === 0) {
    return (
      <div className="implementation-milestone-group">
        <p className="implementation-milestone-group__title">{title}</p>
        <p className="implementation-section__empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="implementation-milestone-group">
      <p className="implementation-milestone-group__title">{title}</p>
      <ul className="implementation-list">
        {milestones.map((milestone) => (
          <li key={milestone.milestoneId} className="implementation-list__item">
            <p className="implementation-list__title">{milestone.title}</p>
            <p className="implementation-list__meta">
              {milestone.requirementType} — {milestone.status}
              {milestone.description ? ` — ${milestone.description}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MilestonesSection({ implementation }: MilestonesSectionProps) {
  if (implementation.milestones.length === 0) {
    return (
      <p className="implementation-section__empty">
        No milestones have been defined for this implementation record.
      </p>
    );
  }

  const phases = sortPhases(implementation.implementationPhases);

  return (
    <div className="implementation-milestones">
      <MilestoneList
        title="Required milestones — satisfied"
        milestones={getSatisfiedMilestones(implementation).filter(
          (milestone) => milestone.requirementType === "Required",
        )}
        emptyMessage="No required milestones are satisfied yet."
      />
      <MilestoneList
        title="Required milestones — remaining"
        milestones={getRemainingRequiredMilestones(implementation)}
        emptyMessage="All required milestones are satisfied."
      />
      <MilestoneList
        title="Optional milestones — satisfied"
        milestones={getSatisfiedMilestones(implementation).filter(
          (milestone) => milestone.requirementType === "Optional",
        )}
        emptyMessage="No optional milestones are satisfied yet."
      />
      <MilestoneList
        title="Optional milestones — remaining"
        milestones={getRemainingOptionalMilestones(implementation)}
        emptyMessage="No optional milestones remain open."
      />

      {phases.length > 0 ? (
        <div className="implementation-milestone-group">
          <p className="implementation-milestone-group__title">Milestones by phase</p>
          {phases.map((phase) => {
            const phaseMilestones = getMilestonesForPhase(
              implementation,
              phase.implementationPhaseId,
            );

            if (phaseMilestones.length === 0) {
              return null;
            }

            return (
              <div key={phase.implementationPhaseId} className="implementation-progress-change">
                <p className="implementation-list__title">{phase.title}</p>
                <ul className="implementation-list">
                  {phaseMilestones.map((milestone) => (
                    <li key={milestone.milestoneId} className="implementation-list__item">
                      <p className="implementation-list__title">{milestone.title}</p>
                      <p className="implementation-list__meta">
                        {milestone.requirementType} — {milestone.status}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
