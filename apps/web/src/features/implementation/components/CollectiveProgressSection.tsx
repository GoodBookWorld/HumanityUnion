import type { Implementation } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  formatImplementationDateTime,
  getCompletedPhases,
  getSatisfiedMilestones,
} from "../implementation-utils";

interface CollectiveProgressSectionProps {
  implementation: Implementation;
}

export function CollectiveProgressSection({ implementation }: CollectiveProgressSectionProps) {
  const { collectiveProgress, progressIndicator, status } = implementation;
  const completedPhases = getCompletedPhases(implementation);
  const satisfiedMilestones = getSatisfiedMilestones(implementation);

  if (collectiveProgress.totalAchievements === 0) {
    return (
      <div className="implementation-collective-progress">
        <p className="implementation-section__derived">
          Derived value — computed from recorded achievements and milestone satisfaction. Never
          manually set.
        </p>
        <p className="implementation-section__empty">
          {status === "Planned" || status === "Started"
            ? "Collective progress will appear when achievements are recorded during active implementation."
            : "This implementation record has not yet recorded collective achievements."}
        </p>
      </div>
    );
  }

  return (
    <div className="implementation-collective-progress">
      <p className="implementation-section__derived">
        Derived value — computed from recorded achievements and milestone satisfaction. Never
        manually set.
      </p>
      <ProfileField label="Progress Headline" value={progressIndicator.headline} />
      <ProfileField
        label="Required Milestone Progress"
        value={progressIndicator.requiredMilestoneProgressLabel}
      />
      <ProfileField label="Aggregate Summary" value={collectiveProgress.aggregateProgressSummary} />
      <ProfileField
        label="Total Achievements"
        value={String(collectiveProgress.totalAchievements)}
      />
      <ProfileField
        label="Completed Phases"
        value={String(collectiveProgress.completedPhaseCount)}
      />
      <ProfileField
        label="Completed Milestones"
        value={String(collectiveProgress.completedMilestoneCount)}
      />
      <ProfileField
        label="Required Milestones Satisfied"
        value={`${collectiveProgress.requiredMilestonesSatisfiedCount} of ${collectiveProgress.requiredMilestonesTotalCount}`}
      />
      <ProfileField
        label="Optional Milestones Satisfied"
        value={String(collectiveProgress.optionalMilestonesSatisfiedCount)}
      />
      <ProfileField
        label="Derived At"
        value={formatImplementationDateTime(collectiveProgress.derivedAt)}
      />

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

      {satisfiedMilestones.length > 0 ? (
        <div className="implementation-milestone-group">
          <p className="implementation-milestone-group__title">Completed milestones</p>
          <ul className="implementation-list">
            {satisfiedMilestones.map((milestone) => (
              <li key={milestone.milestoneId} className="implementation-list__item">
                <p className="implementation-list__title">{milestone.title}</p>
                <p className="implementation-list__meta">
                  {milestone.requirementType} — satisfied{" "}
                  {milestone.satisfiedAt
                    ? formatImplementationDateTime(milestone.satisfiedAt)
                    : "from recorded achievements"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
