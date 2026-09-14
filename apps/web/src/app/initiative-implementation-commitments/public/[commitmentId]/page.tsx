import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicInitiativeImplementationCommitment } from "../../../../features/initiative-implementation-commitment/api";
import { listPublicInitiativeImplementationTrackingsForCommitment } from "../../../../features/initiative-implementation-tracking/api";
import {
  CivicPublicTranslatedSection,
  joinLinesForDisplay,
} from "../../../../features/language";

interface PublicInitiativeImplementationCommitmentPageProps {
  params: Promise<{
    commitmentId: string;
  }>;
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Not specified";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicInitiativeImplementationCommitmentPage({
  params,
}: PublicInitiativeImplementationCommitmentPageProps) {
  const { commitmentId } = await params;
  const commitment = await getPublicInitiativeImplementationCommitment(commitmentId);

  if (!commitment) {
    return (
      <main className="hu-page-container hu-page-container--sectioned">
        <h1>Public Implementation Commitment</h1>
        <p>Public implementation commitment is not available.</p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  let implementationTrackings: Awaited<
    ReturnType<typeof listPublicInitiativeImplementationTrackingsForCommitment>
  > = [];

  try {
    implementationTrackings =
      await listPublicInitiativeImplementationTrackingsForCommitment(commitmentId);
  } catch {
    implementationTrackings = [];
  }

  return (
    <main className="hu-page-container hu-page-container--sectioned">
      <header>
        <h1>{commitment.title}</h1>
        <p>Public implementation commitment</p>
      </header>

      <ProfileSection title="Commitment">
        <CivicPublicTranslatedSection
          sourceKind="implementation_commitment"
          sourceRecordId={commitment.commitmentId}
          fallbackFields={{
            title: commitment.title,
            summary: commitment.summary,
            organization: commitment.organization ?? "",
            commitmentScope: commitment.commitmentScope,
            approvedAction: commitment.approvedAction ?? "",
            suggestedResponsibleRole: commitment.suggestedResponsibleRole ?? "",
            priority: commitment.priority ?? "",
            requiredResources: joinLinesForDisplay(commitment.requiredResources),
            relatedRisks: joinLinesForDisplay(commitment.relatedRisks),
            references: joinLinesForDisplay(commitment.references),
          }}
        />
        <ProfileField label="Status" value={commitment.status} />
        <ProfileField label="Author" value={commitment.authorDisplayName} />
        <ProfileField label="Expected start" value={formatDate(commitment.expectedStartDate)} />
        <ProfileField
          label="Expected completion"
          value={formatDate(commitment.expectedCompletionDate)}
        />
        {commitment.publishedAt ? (
          <ProfileField label="Published" value={formatDate(commitment.publishedAt)} />
        ) : null}
        {commitment.withdrawnAt ? (
          <ProfileField label="Withdrawn" value={formatDate(commitment.withdrawnAt)} />
        ) : null}
        {commitment.completedAt ? (
          <ProfileField label="Completed" value={formatDate(commitment.completedAt)} />
        ) : null}
      </ProfileSection>

      {implementationTrackings.length > 0 ? (
        <ProfileSection title="Implementation Tracking">
          <ul>
            {implementationTrackings.map((tracking) => (
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

      <nav aria-label="Platform integration">
        <Link href={`/initiatives/public/${encodeURIComponent(commitment.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link href={`/collective-decisions/public/${encodeURIComponent(commitment.decisionId)}`}>
          View Public Collective Decision
        </Link>
      </nav>

      <CivicIntegrationPanel entityType="implementation-commitment" entityId={commitmentId} />

      <p>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
