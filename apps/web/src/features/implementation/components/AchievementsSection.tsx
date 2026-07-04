import type { Implementation } from "@hu/types";

import {
  achievementHasEvidence,
  formatImplementationDateTime,
  getMilestoneTitle,
} from "../implementation-utils";

interface AchievementsSectionProps {
  implementation: Implementation;
}

export function AchievementsSection({ implementation }: AchievementsSectionProps) {
  const achievements = [...implementation.achievements].sort(
    (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
  );

  if (achievements.length === 0) {
    return (
      <div className="implementation-achievements">
        <p className="implementation-section__empty">
          No collective achievements have been recorded yet.
        </p>
        {implementation.status === "InProgress" || implementation.status === "Started" ? (
          <p className="implementation-section__note">
            Achievements may be recorded when implementation is active and authorized.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="implementation-achievements">
      <ul className="implementation-list">
        {achievements.map((achievement) => (
          <li key={achievement.achievementId} className="implementation-list__item">
            <p className="implementation-list__title">{achievement.title}</p>
            <p className="implementation-list__meta">{achievement.summary}</p>
            <p className="implementation-list__meta">
              Milestone: {getMilestoneTitle(implementation, achievement.milestoneId)}
            </p>
            <p className="implementation-list__meta">
              Recorded: {formatImplementationDateTime(achievement.recordedAt)}
            </p>
            <p className="implementation-list__meta">
              Evidence:{" "}
              {achievementHasEvidence(implementation, achievement.achievementId)
                ? "Supporting evidence attached"
                : "No supporting evidence attached yet"}
            </p>
          </li>
        ))}
      </ul>
      <p className="implementation-section__note">
        Achievements describe collective accomplishment — not personal task completion.
        Operational participant metadata is excluded from this default view.
      </p>
    </div>
  );
}
