import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { ViewImplementationLink } from "../../../../features/implementation/components/ViewImplementationLink";
import { getPublicImplementationCommitment } from "../../../../features/implementation-commitment/api";

import "./public-commitment-page.css";

interface PublicImplementationCommitmentPageProps {
  params: Promise<{
    commitmentId: string;
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

export default async function PublicImplementationCommitmentPage({
  params,
}: PublicImplementationCommitmentPageProps) {
  const { commitmentId } = await params;
  let projection = null;

  try {
    projection = await getPublicImplementationCommitment(commitmentId);
  } catch {
    projection = null;
  }

  if (!projection) {
    return (
      <main className="public-commitment-page">
        <h1>Public Implementation Commitment</h1>
        <p>Public implementation commitment is not available.</p>
        <p className="public-commitment-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  const {
    collectiveDecisionReference,
    commitmentIdentity,
    communityCapacity,
    communityNeeds,
    frozenPolicySummary,
    humanityAssistant,
    implementationReadiness,
    initiativeContext,
    petitionReference,
    registrationGateway,
    shareReference,
  } = projection;

  return (
    <main className="public-commitment-page">
      <header className="public-commitment-page__header">
        <h1 className="public-commitment-page__title">{commitmentIdentity.title}</h1>
        <p className="public-commitment-page__subtitle">Public implementation commitment</p>
      </header>

      <ProfileSection title="Initiative Context">
        <ProfileField label="Initiative" value={initiativeContext.title} />
        <ProfileField label="Summary" value={initiativeContext.summary} />
        <ProfileField label="Lifecycle State" value={commitmentIdentity.lifecycleStatus} />
        <ProfileField
          label="Collection Status"
          value={commitmentIdentity.collectionStatusSummary}
        />
      </ProfileSection>

      <ProfileSection title="Collective Decision Reference">
        {collectiveDecisionReference.contextAvailable ? (
          <>
            <ProfileField
              label="Collective Decision"
              value={collectiveDecisionReference.collectiveDecisionId}
            />
            <ProfileField
              label="Decision Summary"
              value={collectiveDecisionReference.decisionSummary ?? "Not available"}
            />
            <ProfileField
              label="Approved Result"
              value={collectiveDecisionReference.approvedResultSummary ?? "Not available"}
            />
            <ProfileField
              label="Decision Outcome"
              value={collectiveDecisionReference.approvedOutcomeSummary ?? "Not available"}
            />
          </>
        ) : (
          <p className="public-commitment-page__empty">
            Approved decision context is unavailable.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="Petition Reference">
        {petitionReference.contextAvailable ? (
          <>
            <ProfileField label="Petition" value={petitionReference.petitionId} />
            <ProfileField label="Context" value={petitionReference.summaryStatement} />
            <ProfileField label="Note" value={petitionReference.endorsementContextNote} />
          </>
        ) : (
          <p className="public-commitment-page__empty">Related Petition context is unavailable.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Community Capacity">
        <p className="public-commitment-page__derived">{communityCapacity.derivedValueNote}</p>
        <ProfileField
          label="Active Declarations"
          value={String(communityCapacity.totalContributions)}
        />
        <ProfileField label="Volunteers" value={String(communityCapacity.volunteers)} />
        <ProfileField
          label="Professional Capacity"
          value={String(communityCapacity.professionalCapacity)}
        />
        <ProfileField label="Resources" value={String(communityCapacity.resources)} />
        <ProfileField label="Availability Summary" value={communityCapacity.availabilitySummary} />
        <ProfileField label="Skill Coverage" value={communityCapacity.skillCoverageSummary} />
        <ProfileField label="Derived At" value={formatDate(communityCapacity.derivedAt)} />
      </ProfileSection>

      <ProfileSection title="Frozen Policy Summary">
        <ProfileField label="Policy Label" value={frozenPolicySummary.label} />
        <ProfileField label="Summary" value={frozenPolicySummary.summaryStatement} />
        {frozenPolicySummary.requiredThresholdLabels.length > 0 ? (
          <>
            <p className="public-commitment-page__note">Required thresholds:</p>
            <ul className="public-commitment-page__list">
              {frozenPolicySummary.requiredThresholdLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </>
        ) : null}
        {frozenPolicySummary.optionalThresholdLabels.length > 0 ? (
          <>
            <p className="public-commitment-page__note">Optional thresholds:</p>
            <ul className="public-commitment-page__list">
              {frozenPolicySummary.optionalThresholdLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Implementation Readiness">
        <p className="public-commitment-page__derived">
          {implementationReadiness.derivedValueNote}
        </p>
        <ProfileField
          label="Readiness Reached"
          value={implementationReadiness.readinessReached ? "Yes" : "Not yet"}
        />
        <ProfileField label="Explanation" value={implementationReadiness.explanation} />
        <ProfileField
          label="Satisfied Thresholds"
          value={String(implementationReadiness.satisfiedThresholdCount)}
        />
        <ProfileField
          label="Pending Thresholds"
          value={String(implementationReadiness.unsatisfiedThresholdCount)}
        />
        <ProfileField label="Derived At" value={formatDate(implementationReadiness.derivedAt)} />
        <p className="public-commitment-page__note">
          {implementationReadiness.notApprovalStatement}
        </p>
      </ProfileSection>

      <ProfileSection title="Community Needs">
        {communityNeeds.length > 0 ? (
          <ul className="public-commitment-page__list">
            {communityNeeds.map((need) => (
              <li key={need.description}>{need.description}</li>
            ))}
          </ul>
        ) : (
          <p className="public-commitment-page__empty">
            No required public needs are currently unmet.
          </p>
        )}
      </ProfileSection>

      <ProfileSection title="Share Link">
        {shareReference.available && shareReference.url ? (
          <>
            <ProfileField label="Public URL" value={shareReference.url} />
            <p className="public-commitment-page__note">{shareReference.sharingNote}</p>
          </>
        ) : (
          <p className="public-commitment-page__empty">Share link is not yet available.</p>
        )}
      </ProfileSection>

      <ProfileSection title="Registration Gateway">
        <ProfileField label="Entry Intent" value={registrationGateway.entryIntent} />
        <p className="public-commitment-page__message">
          {registrationGateway.registrationGatewayMessage}
        </p>
        <ProfileField label="Viewing" value={registrationGateway.viewingNote} />
        <ProfileField label="Sharing" value={registrationGateway.sharingNote} />
        <ProfileField
          label="Registration Required To Declare"
          value={registrationGateway.registrationRequired ? "Yes" : "No"}
        />
        <ProfileField
          label="Declaration Available"
          value={registrationGateway.declarationAvailable ? "Yes" : "No"}
        />
        {registrationGateway.declarationAvailable ? (
          <p className="public-commitment-page__action">
            <Link href={registrationGateway.workspacePath}>
              Continue to Implementation Commitment Workspace after registration
            </Link>
          </p>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Humanity Assistant">
        <p className="public-commitment-page__message">{humanityAssistant.summary}</p>
        <ProfileField label="Readiness" value={humanityAssistant.readinessExplanation} />
        <ProfileField label="Policy" value={humanityAssistant.policyExplanation} />
        <ProfileField label="Community Needs" value={humanityAssistant.communityNeedsExplanation} />
        <p className="public-commitment-page__note">{humanityAssistant.boundaryStatement}</p>
      </ProfileSection>

      <nav className="public-commitment-page__related" aria-label="Related public records">
        <Link href={`/initiatives/public/${encodeURIComponent(initiativeContext.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link
          href={`/collective-decisions/public/${encodeURIComponent(collectiveDecisionReference.collectiveDecisionId)}`}
        >
          View Public Collective Decision
        </Link>
        <Link href={`/petitions/public/${encodeURIComponent(petitionReference.petitionId)}`}>
          View Public Petition
        </Link>
        <ViewImplementationLink
          implementationCommitmentId={commitmentIdentity.implementationCommitmentId}
          publicView
        />
      </nav>

      <p className="public-commitment-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
