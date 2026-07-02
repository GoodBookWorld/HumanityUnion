import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getPublicCollaborativeAnalysis } from "../../../../features/collaborative-analysis/api";
import { getCollectiveDecisionByInitiativeId } from "../../../../features/collective-decision/api";

import "./public-collaborative-analysis-page.css";

interface PublicCollaborativeAnalysisPageProps {
  params: Promise<{
    analysisId: string;
  }>;
}

const CONTRIBUTION_TYPE_LABELS: Record<string, string> = {
  Evidence: "Evidence",
  Question: "Question",
  Alternative: "Alternative",
  Clarification: "Clarification",
  Reference: "Reference",
  ExpertOpinion: "Expert Opinion",
  SummaryProposal: "Summary Proposal",
  Correction: "Correction",
};

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  NeedsClarification: "Needs Clarification",
  StrongEvidence: "Strong Evidence",
  WeakEvidence: "Weak Evidence",
  Duplicate: "Duplicate",
  NeedsExpertReview: "Needs Expert Review",
  RegionalImpact: "Regional Impact",
  HighPriority: "High Priority",
  ReadyForPoll: "Ready for Poll",
};

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "None";
}

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

function formatBoolean(value: boolean): string {
  return value ? "Required" : "Not required";
}

export default async function PublicCollaborativeAnalysisPage({
  params,
}: PublicCollaborativeAnalysisPageProps) {
  const { analysisId } = await params;
  let analysis = null;

  try {
    analysis = await getPublicCollaborativeAnalysis(analysisId);
  } catch {
    analysis = null;
  }

  if (!analysis) {
    return (
      <main className="public-collaborative-analysis-page">
        <h1>Public Collaborative Analysis</h1>
        <p>Public collaborative analysis is not available.</p>
        <p className="public-collaborative-analysis-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  let linkedDecisionId: string | null = null;

  try {
    const decision = await getCollectiveDecisionByInitiativeId(analysis.initiativeId);
    linkedDecisionId = decision.decisionId;
  } catch {
    linkedDecisionId = null;
  }

  return (
    <main className="public-collaborative-analysis-page">
      <header className="public-collaborative-analysis-page__header">
        <h1 className="public-collaborative-analysis-page__title">
          {analysis.initiativeTitle}
        </h1>
        <p className="public-collaborative-analysis-page__subtitle">
          Public collaborative analysis
        </p>
      </header>

      <ProfileSection title="Analysis">
        <ProfileField label="Status" value={formatStatus(analysis.status)} />
        <ProfileField label="Created" value={formatCreatedDate(analysis.createdAt)} />
      </ProfileSection>

      <ProfileSection title="Readiness">
        <ProfileField label="Readiness" value={`${analysis.readiness.readinessScore}%`} />
        <ProfileField
          label="Satisfied Requirements"
          value={formatList(analysis.readiness.satisfiedRequirements)}
        />
        <ProfileField
          label="Missing Requirements"
          value={formatList(analysis.readiness.missingRequirements)}
        />
        <ProfileField
          label="Blocking Issues"
          value={formatList(analysis.readiness.blockingIssues)}
        />
      </ProfileSection>

      <ProfileSection title="Progress Summary">
        <ProfileField
          label="Required Contributions"
          value={String(analysis.progressPolicySummary.minimumContributions)}
        />
        <ProfileField
          label="Required Signals"
          value={String(analysis.progressPolicySummary.minimumSignals)}
        />
        <ProfileField
          label="Participant Threshold"
          value={String(analysis.progressPolicySummary.minimumParticipantCount)}
        />
        <ProfileField
          label="Expert Review"
          value={formatBoolean(analysis.progressPolicySummary.expertReviewRequired)}
        />
        <ProfileField
          label="Regional Review"
          value={formatBoolean(analysis.progressPolicySummary.regionalReviewRequired)}
        />
      </ProfileSection>

      <ProfileSection title="Analysis Summary">
        {analysis.analysisSummary ? (
          <>
            <ProfileField label="Summary" value={analysis.analysisSummary.summaryText} />
            <ProfileField
              label="Created"
              value={formatCreatedDate(analysis.analysisSummary.createdAt)}
            />
          </>
        ) : (
          <p className="public-collaborative-analysis-page__empty">No public summary available.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Contribution Statistics">
        <ProfileField label="Total Contributions" value={String(analysis.contributionStatistics.totalCount)} />
        {analysis.contributionStatistics.byType.length > 0 ? (
          <ul className="public-collaborative-analysis-page__stats">
            {analysis.contributionStatistics.byType.map((entry) => (
              <li key={entry.contributionType}>
                {CONTRIBUTION_TYPE_LABELS[entry.contributionType] ?? entry.contributionType}:{" "}
                {entry.count}
              </li>
            ))}
          </ul>
        ) : (
          <p className="public-collaborative-analysis-page__empty">No contributions recorded.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Signal Statistics">
        <ProfileField label="Total Signals" value={String(analysis.signalStatistics.totalCount)} />
        {analysis.signalStatistics.byType.length > 0 ? (
          <ul className="public-collaborative-analysis-page__stats">
            {analysis.signalStatistics.byType.map((entry) => (
              <li key={entry.signalType}>
                {SIGNAL_TYPE_LABELS[entry.signalType] ?? entry.signalType}: {entry.count}
              </li>
            ))}
          </ul>
        ) : (
          <p className="public-collaborative-analysis-page__empty">No signals recorded.</p>
        )}
      </ProfileSection>

      <nav className="public-collaborative-analysis-page__related" aria-label="Platform integration">
        <Link href={`/initiatives/public/${encodeURIComponent(analysis.initiativeId)}`}>
          View Public Initiative
        </Link>
        {linkedDecisionId ? (
          <Link href={`/collective-decisions/public/${encodeURIComponent(linkedDecisionId)}`}>
            View Public Collective Decision
          </Link>
        ) : null}
      </nav>

      <p className="public-collaborative-analysis-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
