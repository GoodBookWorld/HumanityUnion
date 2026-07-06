import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getCollaborativeAnalysisByInitiativeId } from "../../../../features/collaborative-analysis/api";
import { getCollectiveDecisionByInitiativeId } from "../../../../features/collective-decision/api";
import { getPublicInitiative } from "../../../../features/initiatives/api";
import { listPublicInitiativeAnalyses } from "../../../../features/initiative-collaborative-analysis/api";
import { listPublicInitiativeImprovementProposals } from "../../../../features/initiative-improvement-proposal/api";
import { getPublicInitiativeVersionHistory } from "../../../../features/initiative-version-revision/api";
import { listPublicDecisionSessionsForInitiative } from "../../../../features/decision-session/api";
import { listPublicInitiativeCollectiveDecisions } from "../../../../features/initiative-collective-decision/api";
import { listPublicInitiativeImplementationCommitments } from "../../../../features/initiative-implementation-commitment/api";
import { listPublicInitiativeImplementationTrackings } from "../../../../features/initiative-implementation-tracking/api";
import { listPublicInitiativePublicImpacts } from "../../../../features/initiative-public-impact/api";
import { listPublicCivicCompatibilityReviews } from "../../../../features/civic-compatibility-review/api";
import { getPetitionByInitiativeId } from "../../../../features/petition/api";

import "./public-initiative-page.css";

interface PublicInitiativePageProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Not specified";
}

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicInitiativePage({ params }: PublicInitiativePageProps) {
  const { initiativeId } = await params;
  let initiative = null;
  let linkedAnalysisId: string | null = null;
  let linkedDecisionId: string | null = null;
  let linkedPetitionId: string | null = null;
  let publishedAnalyses: Awaited<ReturnType<typeof listPublicInitiativeAnalyses>> = [];
  let improvementProposals: Awaited<
    ReturnType<typeof listPublicInitiativeImprovementProposals>
  > | null = null;
  let versionHistory: Awaited<ReturnType<typeof getPublicInitiativeVersionHistory>> | null = null;
  let decisionSessions: Awaited<ReturnType<typeof listPublicDecisionSessionsForInitiative>> | null =
    null;
  let collectiveDecisions: Awaited<
    ReturnType<typeof listPublicInitiativeCollectiveDecisions>
  > | null = null;
  let implementationCommitments: Awaited<
    ReturnType<typeof listPublicInitiativeImplementationCommitments>
  > | null = null;
  let implementationTrackings: Awaited<
    ReturnType<typeof listPublicInitiativeImplementationTrackings>
  > | null = null;
  let publicImpacts: Awaited<ReturnType<typeof listPublicInitiativePublicImpacts>> | null = null;
  let compatibilityReviews: Awaited<ReturnType<typeof listPublicCivicCompatibilityReviews>> | null =
    null;

  try {
    initiative = await getPublicInitiative(initiativeId);
  } catch {
    initiative = null;
  }

  if (initiative) {
    try {
      versionHistory = await getPublicInitiativeVersionHistory(initiativeId);
    } catch {
      versionHistory = null;
    }

    try {
      improvementProposals = await listPublicInitiativeImprovementProposals(initiativeId);
    } catch {
      improvementProposals = null;
    }

    try {
      decisionSessions = await listPublicDecisionSessionsForInitiative(initiativeId);
    } catch {
      decisionSessions = null;
    }

    try {
      collectiveDecisions = await listPublicInitiativeCollectiveDecisions(initiativeId);
    } catch {
      collectiveDecisions = null;
    }

    try {
      implementationCommitments = await listPublicInitiativeImplementationCommitments(initiativeId);
    } catch {
      implementationCommitments = null;
    }

    try {
      implementationTrackings = await listPublicInitiativeImplementationTrackings(initiativeId);
    } catch {
      implementationTrackings = null;
    }

    try {
      publicImpacts = await listPublicInitiativePublicImpacts(initiativeId);
    } catch {
      publicImpacts = null;
    }

    try {
      compatibilityReviews = await listPublicCivicCompatibilityReviews(initiativeId);
    } catch {
      compatibilityReviews = null;
    }

    try {
      publishedAnalyses = await listPublicInitiativeAnalyses(initiativeId);
    } catch {
      publishedAnalyses = [];
    }

    try {
      const analysis = await getCollaborativeAnalysisByInitiativeId(initiativeId);
      linkedAnalysisId = analysis.analysisId;
    } catch {
      linkedAnalysisId = null;
    }

    try {
      const decision = await getCollectiveDecisionByInitiativeId(initiativeId);
      linkedDecisionId = decision.decisionId;
    } catch {
      linkedDecisionId = null;
    }

    try {
      const petition = await getPetitionByInitiativeId(initiativeId);
      linkedPetitionId = petition.petitionId;
    } catch {
      linkedPetitionId = null;
    }
  }

  if (!initiative) {
    return (
      <main className="public-initiative-page">
        <h1>Public Initiative</h1>
        <p>Public initiative is not available.</p>
        <p className="public-initiative-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="public-initiative-page">
      <header className="public-initiative-page__header">
        <h1 className="public-initiative-page__title">{initiative.title}</h1>
        <p className="public-initiative-page__subtitle">Public initiative</p>
      </header>

      <ProfileSection title="Initiative">
        <ProfileField label="Description" value={initiative.description} />
        <ProfileField label="Status" value={initiative.status} />
        <ProfileField label="Category" value={initiative.metadata.category} />
        <ProfileField label="Tags" value={formatList(initiative.metadata.tags)} />
        <ProfileField label="Region" value={initiative.metadata.region} />
        <ProfileField label="Language" value={initiative.metadata.language} />
        <ProfileField label="Steward" value={initiative.stewardDisplayName} />
        <ProfileField label="Current Version" value={`Version ${initiative.currentVersion}`} />
        <ProfileField label="Created" value={formatCreatedDate(initiative.createdAt)} />
      </ProfileSection>

      {versionHistory && versionHistory.revisions.length > 0 ? (
        <ProfileSection title="Revision History">
          <ul>
            {versionHistory.revisions.map((revision) => (
              <li key={revision.revisionId}>
                <Link
                  href={`/initiatives/public/${encodeURIComponent(initiativeId)}/revisions/${revision.version}`}
                >
                  Version {revision.version}
                  {revision.isCurrent ? " (Current)" : ""}
                </Link>
                <p>{revision.revisionSummary}</p>
                <p>
                  {revision.authorDisplayName} · {formatCreatedDate(revision.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {publishedAnalyses.length > 0 ? (
        <ProfileSection title="Collaborative Analyses">
          <ul>
            {publishedAnalyses.map((analysis) => (
              <li key={analysis.analysisId}>
                <Link
                  href={`/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`}
                >
                  {analysis.title}
                </Link>
                <p>{analysis.summary}</p>
                <p>
                  {analysis.authorDisplayName} · Version {analysis.initiativeVersion} ·{" "}
                  {formatCreatedDate(analysis.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {improvementProposals && improvementProposals.proposals.length > 0 ? (
        <ProfileSection title="Improvement Proposals">
          <ProfileField
            label="Submitted"
            value={String(improvementProposals.metrics.submittedCount)}
          />
          <ProfileField
            label="Accepted"
            value={String(improvementProposals.metrics.acceptedCount)}
          />
          <ProfileField
            label="Partially Accepted"
            value={String(improvementProposals.metrics.partiallyAcceptedCount)}
          />
          <ProfileField
            label="Declined"
            value={String(improvementProposals.metrics.declinedCount)}
          />
          <ul>
            {improvementProposals.proposals.map((proposal) => (
              <li key={proposal.proposalId}>
                <Link
                  href={`/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`}
                >
                  {proposal.targetSection}: {proposal.proposedChange}
                </Link>
                <p>
                  {proposal.status.replace("_", " ")} · {proposal.authorDisplayName}
                  {proposal.implementedInVersion
                    ? ` · Implemented in Version ${proposal.implementedInVersion}`
                    : proposal.status === "accepted" || proposal.status === "partially_accepted"
                      ? " · Not yet implemented"
                      : ""}
                  {proposal.decidedAt
                    ? ` · ${formatCreatedDate(proposal.decidedAt)}`
                    : ` · ${formatCreatedDate(proposal.updatedAt)}`}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {compatibilityReviews?.latest ? (
        <ProfileSection title="Civic Compatibility Review">
          {compatibilityReviews.latest.reviewAvailableNotice ? (
            <p className="public-initiative-page__compatibility-notice" role="status">
              {compatibilityReviews.latest.reviewAvailableNotice}
            </p>
          ) : null}
          <ProfileField
            label="Compatibility Status"
            value={compatibilityReviews.latest.compatibilityStatus.replace(/_/g, " ")}
          />
          <ProfileField
            label="Review Summary"
            value={compatibilityReviews.latest.compatibilitySummary}
          />
          <ProfileField
            label="Last Review Date"
            value={formatCreatedDate(compatibilityReviews.latest.generatedAt)}
          />
          {compatibilityReviews.latest.referencedPrinciples.length > 0 ? (
            <ProfileField
              label="Referenced Principles"
              value={compatibilityReviews.latest.referencedPrinciples
                .map((principle) => principle.referenceCode)
                .join(", ")}
            />
          ) : null}
          <details className="public-initiative-page__compatibility-details">
            <summary>View review details</summary>
            <ProfileField
              label="Human Rights Assessment"
              value={compatibilityReviews.latest.humanRightsAssessment}
            />
            <ProfileField
              label="Humanity Union Assessment"
              value={compatibilityReviews.latest.humanityUnionAssessment}
            />
            {compatibilityReviews.latest.positiveAlignment.length > 0 ? (
              <ProfileField
                label="Positive Alignment"
                value={compatibilityReviews.latest.positiveAlignment.join(" ")}
              />
            ) : null}
            {compatibilityReviews.latest.detectedConcerns.length > 0 ? (
              <ul>
                {compatibilityReviews.latest.detectedConcerns.map((concern) => (
                  <li key={concern.concernId}>
                    <strong>{concern.summary}</strong>
                    <p>{concern.explanation}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {compatibilityReviews.latest.recommendations.length > 0 ? (
              <ul>
                {compatibilityReviews.latest.recommendations.map((recommendation) => (
                  <li key={recommendation.recommendationId}>
                    <strong>{recommendation.summary}</strong>
                    <p>{recommendation.explanation}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {compatibilityReviews.latest.referencedHumanRightsArticles.length > 0 ? (
              <ProfileField
                label="Referenced Human Rights Articles"
                value={compatibilityReviews.latest.referencedHumanRightsArticles
                  .map((article) => article.referenceCode)
                  .join(", ")}
              />
            ) : null}
          </details>
        </ProfileSection>
      ) : null}

      {decisionSessions && decisionSessions.sessions.length > 0 ? (
        <ProfileSection title="Decision Sessions">
          <ul>
            {decisionSessions.sessions.map((session) => (
              <li key={session.sessionId}>
                <Link href={`/decision-sessions/public/${encodeURIComponent(session.sessionId)}`}>
                  {session.title}
                </Link>
                <p>
                  {session.status} · Opens {formatCreatedDate(session.opensAt)} · Closes{" "}
                  {formatCreatedDate(session.closesAt)}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {collectiveDecisions && collectiveDecisions.decisions.length > 0 ? (
        <ProfileSection title="Collective Decisions">
          <ul>
            {collectiveDecisions.decisions.map((decision) => (
              <li key={decision.decisionId}>
                <Link
                  href={`/collective-decisions/public/${encodeURIComponent(decision.decisionId)}`}
                >
                  {decision.question}
                </Link>
                <p>
                  {decision.status} · {decision.participationScope} · Support{" "}
                  {decision.statistics.supportCount} · Do Not Support{" "}
                  {decision.statistics.doNotSupportCount} · Abstain{" "}
                  {decision.statistics.abstainCount}
                </p>
                <p>
                  Verified: {decision.statistics.verifiedVotesCast} · Unverified:{" "}
                  {decision.statistics.unverifiedVotesCast} · Confidence:{" "}
                  {decision.participationConfidenceLevel}
                </p>
                <p>{decision.outcomeSummary}</p>
                <p className="public-initiative-page__transparency-note">
                  {decision.transparencyNote}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {implementationCommitments && implementationCommitments.commitments.length > 0 ? (
        <ProfileSection title="Implementation Commitments">
          <ul>
            {implementationCommitments.commitments.map((commitment) => (
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

      {implementationTrackings && implementationTrackings.trackings.length > 0 ? (
        <ProfileSection title="Implementation Tracking">
          <ul>
            {implementationTrackings.trackings.map((tracking) => (
              <li key={tracking.trackingId}>
                <Link
                  href={`/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`}
                >
                  {tracking.summary}
                </Link>
                <p>
                  {tracking.status} · {tracking.currentStage} · {tracking.authorDisplayName} ·{" "}
                  {tracking.updateCount} update{tracking.updateCount === 1 ? "" : "s"}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {publicImpacts && publicImpacts.impacts.length > 0 ? (
        <ProfileSection title="Public Impact">
          <ul>
            {publicImpacts.impacts.map((impact) => (
              <li key={impact.impactId}>
                <Link href={`/public-impact/${encodeURIComponent(impact.impactId)}`}>
                  {impact.title}
                </Link>
                <p>
                  {impact.status} · {impact.affectedCommunity} · {impact.authorDisplayName} ·{" "}
                  {impact.evidenceCount} evidence item{impact.evidenceCount === 1 ? "" : "s"}
                </p>
                <p>{impact.observedImpact}</p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {linkedAnalysisId || linkedDecisionId || linkedPetitionId ? (
        <nav className="public-initiative-page__related" aria-label="Platform integration">
          {linkedAnalysisId ? (
            <Link href={`/collaborative-analysis/public/${encodeURIComponent(linkedAnalysisId)}`}>
              View Public Collaborative Analysis
            </Link>
          ) : null}
          {linkedDecisionId ? (
            <Link href={`/collective-decisions/public/${encodeURIComponent(linkedDecisionId)}`}>
              View Public Collective Decision
            </Link>
          ) : null}
          {linkedPetitionId ? (
            <Link href={`/petitions/public/${encodeURIComponent(linkedPetitionId)}`}>
              View Public Petition
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p className="public-initiative-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
