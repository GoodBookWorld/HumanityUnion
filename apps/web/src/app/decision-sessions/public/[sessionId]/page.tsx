import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicDecisionSession } from "../../../../features/decision-session/api";

import "./public-decision-session-page.css";

interface PublicDecisionSessionPageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicDecisionSessionPage({
  params,
}: PublicDecisionSessionPageProps) {
  const { sessionId } = await params;
  let session = null;

  try {
    session = await getPublicDecisionSession(sessionId);
  } catch {
    session = null;
  }

  if (!session) {
    return (
      <main className="public-decision-session-page">
        <h1>Public Decision Session</h1>
        <p>Public decision session is not available.</p>
        <p className="public-decision-session-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="public-decision-session-page">
      <header className="public-decision-session-page__header">
        <h1 className="public-decision-session-page__title">{session.title}</h1>
        <p className="public-decision-session-page__subtitle">Decision session</p>
      </header>

      <ProfileSection title="Session">
        <ProfileField label="Purpose" value={session.purpose} />
        <ProfileField label="Decision question" value={session.decisionQuestion} />
        <ProfileField label="Status" value={session.status} />
        <ProfileField label="Steward" value={session.stewardDisplayName} />
        <ProfileField
          label="Current initiative version"
          value={`Version ${session.initiativeVersion}`}
        />
        <ProfileField label="Opens" value={formatDate(session.opensAt)} />
        <ProfileField label="Closes" value={formatDate(session.closesAt)} />
        <ProfileField label="Published" value={formatDate(session.publishedAt)} />
        {session.closedAt ? (
          <ProfileField label="Closed" value={formatDate(session.closedAt)} />
        ) : null}
      </ProfileSection>

      <ProfileSection title="Revision History">
        {session.decisionPackage.revisions.length > 0 ? (
          <ul>
            {session.decisionPackage.revisions.map((revision) => (
              <li key={revision.revisionId}>
                <Link
                  href={`/initiatives/public/${encodeURIComponent(session.initiativeId)}/revisions/${revision.version}`}
                >
                  Version {revision.version}
                  {revision.isCurrent ? " (Current)" : ""}
                </Link>
                <p>{revision.revisionSummary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No revisions in decision package.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Collaborative Analyses">
        {session.decisionPackage.analyses.length > 0 ? (
          <ul>
            {session.decisionPackage.analyses.map((analysis) => (
              <li key={analysis.analysisId}>
                <Link
                  href={`/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`}
                >
                  {analysis.title}
                </Link>
                <p>
                  {analysis.authorDisplayName} · Version {analysis.initiativeVersion}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No analyses in decision package.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Improvement Proposals">
        {session.decisionPackage.proposals.length > 0 ? (
          <ul>
            {session.decisionPackage.proposals.map((proposal) => (
              <li key={proposal.proposalId}>
                <Link
                  href={`/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`}
                >
                  {proposal.targetSection}: {proposal.proposedChange}
                </Link>
                <p>
                  {proposal.status.replace("_", " ")} · {proposal.authorDisplayName}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No improvement proposals in decision package.</p>
        )}
      </ProfileSection>

      <CivicIntegrationPanel entityType="decision-session" entityId={sessionId} />

      <p className="public-decision-session-page__back">
        <Link href={`/initiatives/public/${encodeURIComponent(session.initiativeId)}`}>
          Back to Initiative
        </Link>
      </p>
    </main>
  );
}
