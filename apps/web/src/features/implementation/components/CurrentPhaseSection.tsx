import type { Implementation } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  getCompletedPhases,
  getCurrentPhase,
  getUpcomingPhases,
  sortPhases,
} from "../implementation-utils";

interface CurrentPhaseSectionProps {
  implementation: Implementation;
}

export function CurrentPhaseSection({ implementation }: CurrentPhaseSectionProps) {
  const phases = sortPhases(implementation.implementationPhases);

  if (phases.length === 0) {
    return (
      <p className="implementation-section__empty">
        Implementation phases have not yet been configured for this record.
      </p>
    );
  }

  const currentPhase = getCurrentPhase(implementation);
  const completedPhases = getCompletedPhases(implementation);
  const upcomingPhases = getUpcomingPhases(implementation);

  return (
    <div className="implementation-current-phase">
      {currentPhase ? (
        <div className="implementation-phase-card implementation-phase-card--current">
          <ProfileField label="Current Phase" value={currentPhase.title} />
          <ProfileField label="Summary" value={currentPhase.summary} />
          <ProfileField label="Status" value={currentPhase.status} />
          <ProfileField label="Sequence Order" value={String(currentPhase.sequenceOrder)} />
        </div>
      ) : null}

      {completedPhases.length > 0 ? (
        <div className="implementation-milestone-group">
          <p className="implementation-milestone-group__title">Completed phases</p>
          <ul className="implementation-list">
            {completedPhases.map((phase) => (
              <li key={phase.implementationPhaseId} className="implementation-list__item">
                <p className="implementation-list__title">{phase.title}</p>
                <p className="implementation-list__meta">{phase.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {upcomingPhases.length > 0 ? (
        <div className="implementation-milestone-group">
          <p className="implementation-milestone-group__title">Upcoming phases</p>
          <ul className="implementation-list">
            {upcomingPhases.map((phase) => (
              <li key={phase.implementationPhaseId} className="implementation-list__item">
                <p className="implementation-list__title">{phase.title}</p>
                <p className="implementation-list__meta">{phase.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="implementation-section__note">
        Phases are informational structure — not assignment lists.
      </p>
    </div>
  );
}
