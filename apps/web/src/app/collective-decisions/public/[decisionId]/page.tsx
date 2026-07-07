import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getCollaborativeAnalysisByInitiativeId } from "../../../../features/collaborative-analysis/api";
import { getPublicCollectiveDecision } from "../../../../features/collective-decision/api";
import { getPublicInitiativeCollectiveDecision } from "../../../../features/initiative-collective-decision/api";
import { getPublicCivicActionPackageForDecision } from "../../../../features/civic-action-package/api";
import { listPublicOfficialResponsesForCap } from "../../../../features/official-response/api";
import { OfficialResponsesPublicSection } from "../../../../features/official-response/components/OfficialResponsesPublicSection";
import { listPublicInitiativeImplementationCommitmentsForDecision } from "../../../../features/initiative-implementation-commitment/api";
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

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Not completed";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatOutcome(outcome: string): string {
  return outcome.replace(/_/g, " ");
}

export default async function PublicCollectiveDecisionPage({
  params,
}: PublicCollectiveDecisionPageProps) {
  const { decisionId } = await params;
  const initiativeDecision = await getPublicInitiativeCollectiveDecision(decisionId);

  if (initiativeDecision) {
    let implementationCommitments: Awaited<
      ReturnType<typeof listPublicInitiativeImplementationCommitmentsForDecision>
    > = [];
    const civicActionPackage =
      initiativeDecision.status === "closed"
        ? await getPublicCivicActionPackageForDecision(decisionId)
        : null;
    const officialResponses = civicActionPackage
      ? await listPublicOfficialResponsesForCap(civicActionPackage.capId)
      : [];

    try {
      implementationCommitments =
        await listPublicInitiativeImplementationCommitmentsForDecision(decisionId);
    } catch {
      implementationCommitments = [];
    }

    return (
      <main className="public-collective-decision-page">
        <header className="public-collective-decision-page__header">
          <h1 className="public-collective-decision-page__title">{initiativeDecision.question}</h1>
          <p className="public-collective-decision-page__subtitle">Public collective decision</p>
        </header>

        <ProfileSection title="Decision">
          <ProfileField label="Status" value={initiativeDecision.status} />
          <ProfileField label="Participation scope" value={initiativeDecision.participationScope} />
          <ProfileField label="Steward" value={initiativeDecision.stewardDisplayName} />
          {initiativeDecision.openedAt ? (
            <ProfileField label="Opened" value={formatDate(initiativeDecision.openedAt)} />
          ) : null}
          <ProfileField label="Closes" value={formatDate(initiativeDecision.closesAt)} />
          {initiativeDecision.closedAt ? (
            <ProfileField label="Closed" value={formatDate(initiativeDecision.closedAt)} />
          ) : null}
          {initiativeDecision.cancelledAt ? (
            <ProfileField label="Cancelled" value={formatDate(initiativeDecision.cancelledAt)} />
          ) : null}
        </ProfileSection>

        {initiativeDecision.outcome ? (
          <>
            <ProfileSection title="Result Counts">
              <ul className="public-collective-decision-page__stats">
                <li>Support: {initiativeDecision.statistics.supportCount}</li>
                <li>Do Not Support: {initiativeDecision.statistics.doNotSupportCount}</li>
                <li>Abstain: {initiativeDecision.statistics.abstainCount}</li>
                <li>Total votes: {initiativeDecision.statistics.totalVotesCast}</li>
              </ul>
            </ProfileSection>

            <ProfileSection title="Verified / Unverified Breakdown">
              <ProfileField
                label="Verified votes"
                value={String(initiativeDecision.statistics.verifiedVotesCast)}
              />
              <ProfileField
                label="Unverified votes"
                value={String(initiativeDecision.statistics.unverifiedVotesCast)}
              />
              <ul className="public-collective-decision-page__stats">
                <li>
                  Verified — Support: {initiativeDecision.outcome.verifiedStatistics.support}, Do
                  Not Support: {initiativeDecision.outcome.verifiedStatistics.doNotSupport},
                  Abstain: {initiativeDecision.outcome.verifiedStatistics.abstain}
                </li>
                <li>
                  Unverified — Support: {initiativeDecision.outcome.unverifiedStatistics.support},
                  Do Not Support: {initiativeDecision.outcome.unverifiedStatistics.doNotSupport},
                  Abstain: {initiativeDecision.outcome.unverifiedStatistics.abstain}
                </li>
              </ul>
            </ProfileSection>

            <ProfileSection title="Outcome">
              <ProfileField
                label="Outcome"
                value={formatOutcome(initiativeDecision.outcome.outcome)}
              />
              <ProfileField
                label="Participation confidence"
                value={initiativeDecision.participationConfidenceLevel}
              />
              <ProfileField label="Summary" value={initiativeDecision.outcomeSummary} />
              <p className="public-collective-decision-page__transparency-note">
                {initiativeDecision.transparencyNote}
              </p>
            </ProfileSection>
          </>
        ) : (
          <ProfileSection title="Results">
            <p className="public-collective-decision-page__empty">
              Results are not yet available for this collective decision.
            </p>
          </ProfileSection>
        )}

        {implementationCommitments.length > 0 ? (
          <ProfileSection title="Implementation Commitments">
            <ul className="public-collective-decision-page__stats">
              {implementationCommitments.map((commitment) => (
                <li key={commitment.commitmentId}>
                  <Link
                    href={`/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`}
                  >
                    {commitment.title}
                  </Link>
                  <p>
                    {commitment.status}
                    {commitment.organization ? ` · ${commitment.organization}` : ""} ·{" "}
                    {commitment.authorDisplayName}
                  </p>
                  <p>{commitment.summary}</p>
                </li>
              ))}
            </ul>
          </ProfileSection>
        ) : null}

        {civicActionPackage ? (
          <ProfileSection title="Civic Action Package">
            <p>CAP generated from this decision result.</p>
            <Link
              href={`/civic-action-packages/public/${encodeURIComponent(civicActionPackage.capId)}`}
            >
              Open Civic Action Package →
            </Link>
          </ProfileSection>
        ) : null}

        {officialResponses.length > 0 ? (
          <ProfileSection title="Official Responses">
            <OfficialResponsesPublicSection responses={officialResponses} />
          </ProfileSection>
        ) : null}

        <nav className="public-collective-decision-page__related" aria-label="Platform integration">
          <Link href={`/initiatives/public/${encodeURIComponent(initiativeDecision.initiativeId)}`}>
            View Public Initiative
          </Link>
        </nav>

        <p className="public-collective-decision-page__back">
          <Link href="/">Back to Home</Link>
        </p>

        <CivicIntegrationPanel entityType="collective-decision" entityId={decisionId} />
      </main>
    );
  }

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

      <CivicIntegrationPanel entityType="collective-decision" entityId={decisionId} />

      <p className="public-collective-decision-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
