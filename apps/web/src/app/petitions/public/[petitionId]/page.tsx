import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getImplementationCommitmentByPetitionId } from "../../../../features/implementation-commitment/api";
import { getPublicPetition } from "../../../../features/petition/api";

import "./public-petition-page.css";

interface PublicPetitionPageProps {
  params: Promise<{
    petitionId: string;
  }>;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicPetitionPage({ params }: PublicPetitionPageProps) {
  const { petitionId } = await params;
  let petition = null;

  try {
    petition = await getPublicPetition(petitionId);
  } catch {
    petition = null;
  }

  if (!petition) {
    return (
      <main className="public-petition-page">
        <h1>Public Petition</h1>
        <p>Public petition is not available.</p>
        <p className="public-petition-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  const {
    approvedDecisionContext,
    participationEntryGuidance,
    petitionIdentity,
    petitionOutcome,
    petitionSubject,
    petitionSummary,
    publicSupportStatistics,
    shareReference,
  } = petition;

  let implementationCommitmentId: string | null = null;

  try {
    const commitment = await getImplementationCommitmentByPetitionId(petitionId);
    implementationCommitmentId = commitment.implementationCommitmentId;
  } catch {
    implementationCommitmentId = null;
  }

  return (
    <main className="public-petition-page">
      <header className="public-petition-page__header">
        <h1 className="public-petition-page__title">{petitionIdentity.title}</h1>
        <p className="public-petition-page__subtitle">Public petition</p>
      </header>

      <ProfileSection title="Petition Summary">
        <ProfileField label="Purpose" value={petitionSummary.purpose} />
        <ProfileField label="Support Status" value={petitionIdentity.supportStatus} />
        <ProfileField label="Lifecycle State" value={petitionIdentity.lifecycleStatus} />
        <ProfileField
          label="Approved Decision Context"
          value={petitionSummary.followsApprovedDecisionStatement}
        />
        <ProfileField label="Published" value={formatDate(petitionSummary.publishedAt)} />
        <ProfileField label="Opens" value={formatDate(petitionSummary.opensAt)} />
        <ProfileField label="Closes" value={formatDate(petitionSummary.closesAt)} />
      </ProfileSection>

      <ProfileSection title="Petition Subject">
        <ProfileField label="Subject Type" value={petitionSubject.subjectType} />
        <ProfileField label="Subject Title" value={petitionSubject.title} />
        <ProfileField label="Subject Summary" value={petitionSubject.summary} />
      </ProfileSection>

      <ProfileSection title="Public Endorsement Context">
        {approvedDecisionContext.contextAvailable ? (
          <>
            <ProfileField
              label="Collective Decision"
              value={approvedDecisionContext.collectiveDecisionId}
            />
            <ProfileField
              label="Decision Summary"
              value={approvedDecisionContext.decisionSummary ?? "Not available"}
            />
            <ProfileField
              label="Approved Result"
              value={approvedDecisionContext.approvedResultSummary ?? "Not available"}
            />
            <ProfileField
              label="Decision Outcome"
              value={approvedDecisionContext.approvedOutcomeSummary ?? "Not available"}
            />
            <ProfileField
              label="Initiative Context"
              value={approvedDecisionContext.initiativeContextSummary ?? "Not available"}
            />
            <ProfileField
              label="Analysis Context"
              value={approvedDecisionContext.analysisContextSummary ?? "Not available"}
            />
          </>
        ) : (
          <p className="public-petition-page__empty">
            Approved decision context is unavailable. Review the Petition subject before
            considering endorsement.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="Public Support">
        <ProfileField label="Support Count" value={String(publicSupportStatistics.supportCount)} />
        <ProfileField label="Support State" value={publicSupportStatistics.supportState} />
        {publicSupportStatistics.thresholdDefined ? (
          <>
            <ProfileField
              label="Threshold Progress"
              value={publicSupportStatistics.thresholdProgress ?? "Not available"}
            />
            <ProfileField
              label="Threshold Reached"
              value={publicSupportStatistics.thresholdReached ? "Yes" : "No"}
            />
          </>
        ) : (
          <ProfileField label="Threshold" value="No threshold defined" />
        )}
        {publicSupportStatistics.recentActivitySummary ? (
          <ProfileField
            label="Recent Activity"
            value={publicSupportStatistics.recentActivitySummary}
          />
        ) : (
          <p className="public-petition-page__empty">No public support activity recorded yet.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Share Link">
        {shareReference.available && shareReference.url ? (
          <>
            <ProfileField label="Public URL" value={shareReference.url} />
            <p className="public-petition-page__note">{shareReference.sharingNote}</p>
          </>
        ) : (
          <p className="public-petition-page__empty">Share link is not yet available.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Registration Gateway">
        <ProfileField label="Entry Intent" value={participationEntryGuidance.entryIntent} />
        <p className="public-petition-page__message">
          {participationEntryGuidance.registrationGatewayMessage}
        </p>
        <ProfileField label="Viewing" value={participationEntryGuidance.viewingNote} />
        <ProfileField label="Sharing" value={participationEntryGuidance.sharingNote} />
        <ProfileField
          label="Registration Required To Sign"
          value={participationEntryGuidance.registrationRequired ? "Yes" : "No"}
        />
        <ProfileField
          label="Signing Available"
          value={participationEntryGuidance.signingAvailable ? "Yes" : "No"}
        />
        {participationEntryGuidance.signingAvailable ? (
          <p className="public-petition-page__action">
            <Link href={participationEntryGuidance.workspacePath}>
              Continue to Petition Workspace after registration
            </Link>
          </p>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Petition Outcome">
        {petitionOutcome ? (
          <>
            <ProfileField label="Outcome Type" value={petitionOutcome.outcomeType} />
            <ProfileField label="Explanation" value={petitionOutcome.explanation} />
            {petitionOutcome.finalSupportCount !== null ? (
              <ProfileField
                label="Final Support Count"
                value={String(petitionOutcome.finalSupportCount)}
              />
            ) : null}
          </>
        ) : (
          <p className="public-petition-page__empty">
            Final Petition Outcome will appear when the lifecycle permits.
          </p>
        )}
      </ProfileSection>

      <nav className="public-petition-page__related" aria-label="Related public records">
        <Link href={`/initiatives/public/${encodeURIComponent(petitionSubject.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link
          href={`/collective-decisions/public/${encodeURIComponent(approvedDecisionContext.collectiveDecisionId)}`}
        >
          View Public Collective Decision
        </Link>
        {implementationCommitmentId ? (
          <Link
            href={`/implementation-commitments/public/${encodeURIComponent(implementationCommitmentId)}`}
          >
            View Public Implementation Commitment
          </Link>
        ) : null}
      </nav>

      <p className="public-petition-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
