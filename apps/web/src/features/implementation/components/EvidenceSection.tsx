import type { Implementation } from "@hu/types";

import {
  formatImplementationDateTime,
  getEvidenceForAchievement,
  getMilestoneTitle,
} from "../implementation-utils";

interface EvidenceSectionProps {
  implementation: Implementation;
}

export function EvidenceSection({ implementation }: EvidenceSectionProps) {
  const achievements = [...implementation.achievements].sort(
    (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
  );

  if (implementation.evidence.length === 0) {
    return (
      <div className="implementation-evidence">
        <p className="implementation-section__empty">
          {achievements.length > 0
            ? "Achievements are recorded. Supporting evidence may be attached where available and authorized."
            : "No supporting evidence has been attached to recorded achievements."}
        </p>
      </div>
    );
  }

  return (
    <div className="implementation-evidence">
      {achievements.map((achievement) => {
        const evidenceItems = getEvidenceForAchievement(implementation, achievement.achievementId);

        if (evidenceItems.length === 0) {
          return null;
        }

        return (
          <div key={achievement.achievementId} className="implementation-progress-change">
            <p className="implementation-list__title">{achievement.title}</p>
            <p className="implementation-list__meta">
              Milestone: {getMilestoneTitle(implementation, achievement.milestoneId)}
            </p>
            <ul className="implementation-list">
              {evidenceItems.map((evidence) => (
                <li key={evidence.evidenceId} className="implementation-list__item">
                  <p className="implementation-list__title">{evidence.label}</p>
                  <p className="implementation-list__meta">Kind: {evidence.evidenceKind}</p>
                  <p className="implementation-list__meta">
                    Recorded: {formatImplementationDateTime(evidence.recordedAt)}
                  </p>
                  {evidence.reference ? (
                    <p className="implementation-list__meta">
                      Reference: {evidence.reference.displayLabel}
                    </p>
                  ) : null}
                  {evidence.link ? (
                    <p className="implementation-list__meta">Link: {evidence.link.displayLabel}</p>
                  ) : null}
                  {evidence.attachment ? (
                    <p className="implementation-list__meta">
                      Attachment: {evidence.attachment.displayLabel}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="implementation-section__note">
        Evidence supports transparency. It does not establish objective truth or platform
        certification.
      </p>
    </div>
  );
}
