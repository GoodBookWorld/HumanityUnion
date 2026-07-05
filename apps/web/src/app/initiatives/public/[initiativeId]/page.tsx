import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getCollaborativeAnalysisByInitiativeId } from "../../../../features/collaborative-analysis/api";
import { getCollectiveDecisionByInitiativeId } from "../../../../features/collective-decision/api";
import { getPublicInitiative } from "../../../../features/initiatives/api";
import { listPublicInitiativeAnalyses } from "../../../../features/initiative-collaborative-analysis/api";
import { listPublicInitiativeImprovementProposals } from "../../../../features/initiative-improvement-proposal/api";
import { getPublicInitiativeVersionHistory } from "../../../../features/initiative-version-revision/api";
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
                  {analysis.authorDisplayName} · {formatCreatedDate(analysis.publishedAt)}
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
