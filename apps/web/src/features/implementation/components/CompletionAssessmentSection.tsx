import type { Implementation } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import {
  formatImplementationDateTime,
  getRemainingRequiredMilestones,
} from "../implementation-utils";

interface CompletionAssessmentSectionProps {
  implementation: Implementation;
}

export function CompletionAssessmentSection({ implementation }: CompletionAssessmentSectionProps) {
  const { completionAssessment, completion, completionIndicator, status } = implementation;
  const remainingRequired = getRemainingRequiredMilestones(implementation);

  if (status === "Planned" || status === "Started") {
    return (
      <div className="implementation-completion-assessment">
        <p className="implementation-section__derived">
          Derived value — computed from required milestone satisfaction. Never manually set.
        </p>
        <p className="implementation-section__empty">
          Completion assessment will be available when implementation recording is active.
        </p>
      </div>
    );
  }

  return (
    <div className="implementation-completion-assessment">
      <p className="implementation-section__derived">
        Derived value — computed from required milestone satisfaction. Never manually set.
      </p>
      <ProfileField
        label="Completion Reached"
        value={completion.completionReached ? "Yes" : "Not yet"}
      />
      <ProfileField label="Completion Headline" value={completionIndicator.headline} />
      <ProfileField
        label="Required Criteria Progress"
        value={completionIndicator.requiredCriteriaProgressLabel}
      />
      <ProfileField
        label="Assessment Reached"
        value={completionAssessment.assessmentReached ? "Yes" : "Not yet"}
      />
      <ProfileField label="Assessment Explanation" value={completionAssessment.explanation} />
      <ProfileField label="Completion Explanation" value={completion.explanation} />
      <ProfileField
        label="Required Milestones Satisfied"
        value={String(completionAssessment.satisfiedCriteria.length)}
      />
      <ProfileField
        label="Required Milestones Remaining"
        value={String(completionAssessment.unsatisfiedCriteria.length)}
      />
      <ProfileField
        label="Evaluated At"
        value={formatImplementationDateTime(completionAssessment.evaluatedAt)}
      />

      {remainingRequired.length > 0 ? (
        <div className="implementation-milestone-group">
          <p className="implementation-milestone-group__title">Remaining required milestones</p>
          <ul className="implementation-list">
            {remainingRequired.map((milestone) => (
              <li key={milestone.milestoneId} className="implementation-list__item">
                <p className="implementation-list__title">{milestone.title}</p>
                <p className="implementation-list__meta">{milestone.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="implementation-section__note">
        Completion is derived — not Collective Decision re-approval. Optional milestones do not
        block completion.
      </p>
    </div>
  );
}
