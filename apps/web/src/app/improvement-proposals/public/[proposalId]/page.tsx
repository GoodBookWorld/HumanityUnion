import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicImprovementProposal } from "../../../../features/initiative-improvement-proposal/api";
import { CivicPublicTranslatedSection } from "../../../../features/language";

import "./public-improvement-proposal-page.css";

interface PublicImprovementProposalPageProps {
  params: Promise<{
    proposalId: string;
  }>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicImprovementProposalPage({
  params,
}: PublicImprovementProposalPageProps) {
  const { proposalId } = await params;
  let proposal = null;

  try {
    proposal = await getPublicImprovementProposal(proposalId);
  } catch {
    proposal = null;
  }

  if (!proposal) {
    return (
      <main className="public-improvement-proposal-page">
        <h1>Public Improvement Proposal</h1>
        <p>Public improvement proposal is not available.</p>
        <p className="public-improvement-proposal-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="public-improvement-proposal-page">
      <header className="public-improvement-proposal-page__header">
        <h1 className="public-improvement-proposal-page__title">{proposal.targetSection}</h1>
        <p className="public-improvement-proposal-page__subtitle">Improvement proposal</p>
      </header>

      <ProfileSection title="Proposal">
        <ProfileField label="Status" value={proposal.status.replace("_", " ")} />
        <CivicPublicTranslatedSection
          sourceKind="improvement_proposal"
          sourceRecordId={proposal.proposalId}
          fallbackFields={{
            targetSection: proposal.targetSection,
            currentIssue: proposal.currentIssue,
            proposedChange: proposal.proposedChange,
            rationale: proposal.rationale,
            expectedImprovement: proposal.expectedImprovement,
            references: proposal.references,
            decisionNote: proposal.decisionNote ?? "",
          }}
        />
        <ProfileField label="Author" value={proposal.authorDisplayName} />
        <ProfileField label="Submitted" value={formatDate(proposal.updatedAt)} />
        {proposal.decidedAt ? (
          <ProfileField label="Decided" value={formatDate(proposal.decidedAt)} />
        ) : null}
        <ProfileField
          label="Implementation"
          value={
            proposal.implementedInVersion
              ? `Implemented in Version ${proposal.implementedInVersion}`
              : proposal.status === "accepted" || proposal.status === "partially_accepted"
                ? "Not yet implemented"
                : "Not applicable"
          }
        />
      </ProfileSection>

      <nav
        className="public-improvement-proposal-page__related"
        aria-label="Related public records"
      >
        <Link href={`/initiatives/public/${encodeURIComponent(proposal.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link href={`/initiative-analyses/public/${encodeURIComponent(proposal.analysisId)}`}>
          View Collaborative Analysis
        </Link>
      </nav>

      <CivicIntegrationPanel entityType="improvement-proposal" entityId={proposalId} />

      <p className="public-improvement-proposal-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
