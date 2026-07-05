import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getPublicInitiativeAnalysis } from "../../../../features/initiative-collaborative-analysis/api";
import { listPublicImprovementProposalsForAnalysis } from "../../../../features/initiative-improvement-proposal/api";

import "./public-initiative-analysis-page.css";

interface PublicInitiativeAnalysisPageProps {
  params: Promise<{
    analysisId: string;
  }>;
}

function formatPublishedDate(publishedAt: string): string {
  return new Date(publishedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicInitiativeAnalysisPage({
  params,
}: PublicInitiativeAnalysisPageProps) {
  const { analysisId } = await params;
  let analysis = null;
  let relatedProposals: Awaited<ReturnType<typeof listPublicImprovementProposalsForAnalysis>> = [];

  try {
    analysis = await getPublicInitiativeAnalysis(analysisId);
  } catch {
    analysis = null;
  }

  if (analysis) {
    try {
      relatedProposals = await listPublicImprovementProposalsForAnalysis(analysisId);
    } catch {
      relatedProposals = [];
    }
  }

  if (!analysis) {
    return (
      <main className="public-initiative-analysis-page">
        <h1>Public Initiative Analysis</h1>
        <p>Public initiative analysis is not available.</p>
        <p className="public-initiative-analysis-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="public-initiative-analysis-page">
      <header className="public-initiative-analysis-page__header">
        <h1 className="public-initiative-analysis-page__title">{analysis.title}</h1>
        <p className="public-initiative-analysis-page__subtitle">Collaborative analysis</p>
      </header>

      <ProfileSection title="Analysis">
        <ProfileField label="Summary" value={analysis.summary} />
        <ProfileField label="Supporting evidence" value={analysis.supportingEvidence} />
        <ProfileField label="Risks" value={analysis.risks} />
        <ProfileField label="Suggested improvements" value={analysis.suggestedImprovements} />
        <ProfileField label="References" value={analysis.references} />
        <ProfileField label="Author" value={analysis.authorDisplayName} />
        <ProfileField label="Published" value={formatPublishedDate(analysis.publishedAt)} />
      </ProfileSection>

      {relatedProposals.length > 0 ? (
        <ProfileSection title="Improvement Proposals">
          <ul>
            {relatedProposals.map((proposal) => (
              <li key={proposal.proposalId}>
                <Link
                  href={`/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`}
                >
                  {proposal.targetSection}: {proposal.proposedChange}
                </Link>
                <p>
                  {proposal.status.replace("_", " ")} · {proposal.authorDisplayName}
                  {proposal.decidedAt
                    ? ` · ${formatPublishedDate(proposal.decidedAt)}`
                    : ` · ${formatPublishedDate(proposal.updatedAt)}`}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      <nav className="public-initiative-analysis-page__related" aria-label="Related public records">
        <Link href={`/initiatives/public/${encodeURIComponent(analysis.initiativeId)}`}>
          View Public Initiative
        </Link>
      </nav>

      <p className="public-initiative-analysis-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
