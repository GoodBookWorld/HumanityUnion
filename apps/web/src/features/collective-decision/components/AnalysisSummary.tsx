import type { AnalysisSummary as AnalysisSummaryType, CollaborativeAnalysis } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";

import "./analysis-summary.css";

interface AnalysisSummaryProps {
  collaborativeAnalysis?: Pick<
    CollaborativeAnalysis,
    "summaries" | "readiness" | "progressPolicy"
  > | null;
}

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRequirementList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

function formatBoolean(value: boolean): string {
  return value ? "Required" : "Not required";
}

function getCurrentSummary(summaries: AnalysisSummaryType[]): AnalysisSummaryType | null {
  if (summaries.length === 0) {
    return null;
  }

  return [...summaries].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )[0] ?? null;
}

export function AnalysisSummary({ collaborativeAnalysis = null }: AnalysisSummaryProps) {
  if (!collaborativeAnalysis) {
    return <p className="analysis-summary__empty">Collaborative Analysis is not available.</p>;
  }

  const currentSummary = getCurrentSummary(collaborativeAnalysis.summaries);
  const { readiness, progressPolicy } = collaborativeAnalysis;

  return (
    <div className="analysis-summary">
      <section className="analysis-summary__section">
        <h3 className="analysis-summary__heading">Analysis Summary</h3>
        {currentSummary ? (
          <>
            <p className="analysis-summary__text">{currentSummary.summaryText}</p>
            <p className="analysis-summary__meta">
              Created: {formatCreatedDate(currentSummary.createdAt)}
            </p>
          </>
        ) : (
          <p className="analysis-summary__empty">No analysis summary available.</p>
        )}
      </section>

      <section className="analysis-summary__section">
        <h3 className="analysis-summary__heading">Readiness</h3>
        <ProfileField label="Readiness Score" value={`${readiness.readinessScore}%`} />
        <ProfileField
          label="Satisfied Requirements"
          value={formatRequirementList(readiness.satisfiedRequirements)}
        />
        <ProfileField
          label="Missing Requirements"
          value={formatRequirementList(readiness.missingRequirements)}
        />
        <ProfileField
          label="Blocking Issues"
          value={formatRequirementList(readiness.blockingIssues)}
        />
      </section>

      <section className="analysis-summary__section">
        <h3 className="analysis-summary__heading">Progress Policy</h3>
        <ProfileField
          label="Required Contributions"
          value={String(progressPolicy.minimumContributions)}
        />
        <ProfileField label="Required Signals" value={String(progressPolicy.minimumSignals)} />
        <ProfileField
          label="Participant Threshold"
          value={String(progressPolicy.minimumParticipantCount)}
        />
        <ProfileField label="Expert Review" value={formatBoolean(progressPolicy.expertReviewRequired)} />
        <ProfileField
          label="Regional Review"
          value={formatBoolean(progressPolicy.regionalReviewRequired)}
        />
      </section>
    </div>
  );
}
