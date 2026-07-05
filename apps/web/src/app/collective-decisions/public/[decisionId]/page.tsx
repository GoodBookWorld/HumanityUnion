import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getCollaborativeAnalysisByInitiativeId } from "../../../../features/collaborative-analysis/api";
import { getPublicCollectiveDecision } from "../../../../features/collective-decision/api";
import { getPetitionByCollectiveDecisionId } from "../../../../features/petition/api";

import "../public-collective-decision-page.css";

interface PublicCollectiveDecisionPageProps {
  params: Promise<{
    decisionId: string;
  }>;
}

function formatTemplate(template: string): string {
  if (template === "CommunityPoll") {
    return "Community Poll";
  }

  return template;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not completed";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicCollectiveDecisionPage({
  params,
}: PublicCollectiveDecisionPageProps) {
  const { decisionId } = await params;
  let decision = null;

  try {
    decision = await getPublicCollectiveDecision(decisionId);
  } catch {
    decision = null;
  }

  if (!decision) {
    return (
      <main className="public-collective-decision-page">
        <h1>Public Collective Decision</h1>
        <p>Public collective decision is not available.</p>
        <p className="public-collective-decision-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  let linkedAnalysisId: string | null = null;
  let linkedPetitionId: string | null = null;

  if (decision.decisionSubject.subjectType === "Initiative") {
    try {
      const analysis = await getCollaborativeAnalysisByInitiativeId(
        decision.decisionSubject.subjectId,
      );
      linkedAnalysisId = analysis.analysisId;
    } catch {
      linkedAnalysisId = null;
    }
  }

  try {
    const petition = await getPetitionByCollectiveDecisionId(decisionId);
    linkedPetitionId = petition.petitionId;
  } catch {
    linkedPetitionId = null;
  }

  return (
    <main className="public-collective-decision-page">
      <header className="public-collective-decision-page__header">
        <h1 className="public-collective-decision-page__title">{decision.decisionSubject.title}</h1>
        <p className="public-collective-decision-page__subtitle">Public collective decision</p>
      </header>

      <ProfileSection title="Decision Summary">
        <ProfileField label="Summary" value={decision.decisionSummary} />
        <ProfileField label="Status" value={decision.status} />
        <ProfileField label="Decision Template" value={formatTemplate(decision.decisionTemplate)} />
        <ProfileField label="Completed" value={formatDate(decision.completedAt)} />
      </ProfileSection>

      <ProfileSection title="Decision Subject">
        <ProfileField label="Subject Type" value={decision.decisionSubject.subjectType} />
        <ProfileField label="Subject Title" value={decision.decisionSubject.title} />
      </ProfileSection>

      <ProfileSection title="Final Result">
        {decision.decisionResult ? (
          <>
            <ProfileField
              label="Winning Option"
              value={decision.decisionResult.winningOptionLabel ?? "None"}
            />
            <ProfileField
              label="Participation Rate"
              value={`${decision.decisionResult.participationRate}%`}
            />
            <ProfileField
              label="Quorum Status"
              value={decision.decisionResult.quorumSatisfied ? "Satisfied" : "Not satisfied"}
            />
            <ul className="public-collective-decision-page__stats">
              {decision.decisionResult.optionResults.map((result) => (
                <li key={result.label}>
                  {result.label}: {result.count} ({result.percentage}%)
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="public-collective-decision-page__empty">
            Final result is not yet available.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="Participation Statistics">
        <ProfileField
          label="Eligible Participants"
          value={String(decision.participationStatistics.eligibleParticipantCount)}
        />
        <ProfileField
          label="Submitted Decisions"
          value={String(decision.participationStatistics.submittedDecisionCount)}
        />
        <ProfileField
          label="Participation Rate"
          value={`${decision.participationStatistics.participationRate}%`}
        />
        <ProfileField
          label="Completion Rate"
          value={`${decision.participationStatistics.completionRate}%`}
        />
      </ProfileSection>

      <ProfileSection title="Outcome">
        {decision.outcome ? (
          <>
            <ProfileField label="Outcome" value={decision.outcome.outcomeType} />
            <ProfileField
              label="Next Lifecycle Stage"
              value={decision.outcome.nextLifecycleStage}
            />
            <ProfileField label="Explanation" value={decision.outcome.explanation} />
          </>
        ) : (
          <p className="public-collective-decision-page__empty">Outcome is not yet available.</p>
        )}
      </ProfileSection>

      {decision.decisionSubject.subjectType === "Initiative" ||
      linkedAnalysisId ||
      linkedPetitionId ? (
        <nav className="public-collective-decision-page__related" aria-label="Platform integration">
          {decision.decisionSubject.subjectType === "Initiative" ? (
            <Link
              href={`/initiatives/public/${encodeURIComponent(decision.decisionSubject.subjectId)}`}
            >
              View Public Initiative
            </Link>
          ) : null}
          {linkedAnalysisId ? (
            <Link href={`/collaborative-analysis/public/${encodeURIComponent(linkedAnalysisId)}`}>
              View Public Collaborative Analysis
            </Link>
          ) : null}
          {linkedPetitionId ? (
            <Link href={`/petitions/public/${encodeURIComponent(linkedPetitionId)}`}>
              View Public Petition
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p className="public-collective-decision-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
