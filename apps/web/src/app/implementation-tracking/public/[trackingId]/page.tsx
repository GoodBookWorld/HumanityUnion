import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicInitiativeImplementationTracking } from "../../../../features/initiative-implementation-tracking/api";
import { listPublicOfficialResponsesForInitiative } from "../../../../features/official-response/api";
import { listPublicCivicAccountabilitiesForInitiative } from "../../../../features/civic-accountability/api";
import { OfficialResponsesPublicSection } from "../../../../features/official-response/components/OfficialResponsesPublicSection";
import { CivicAccountabilityPublicSection } from "../../../../features/civic-accountability/components/CivicAccountabilityPublicSection";
import { listPublicInitiativePublicImpactsForTracking } from "../../../../features/initiative-public-impact/api";

interface PublicImplementationTrackingPageProps {
  params: Promise<{
    trackingId: string;
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

export default async function PublicImplementationTrackingPage({
  params,
}: PublicImplementationTrackingPageProps) {
  const { trackingId } = await params;
  const tracking = await getPublicInitiativeImplementationTracking(trackingId);

  if (!tracking) {
    return (
      <main>
        <h1>Public Implementation Tracking</h1>
        <p>Public implementation tracking is not available.</p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  let publicImpacts: Awaited<ReturnType<typeof listPublicInitiativePublicImpactsForTracking>> = [];
  let officialResponses: Awaited<
    ReturnType<typeof listPublicOfficialResponsesForInitiative>
  > | null = null;
  let civicAccountability: Awaited<
    ReturnType<typeof listPublicCivicAccountabilitiesForInitiative>
  > = [];

  try {
    publicImpacts = await listPublicInitiativePublicImpactsForTracking(trackingId);
  } catch {
    publicImpacts = [];
  }

  try {
    officialResponses = await listPublicOfficialResponsesForInitiative(tracking.initiativeId);
  } catch {
    officialResponses = null;
  }

  try {
    civicAccountability = await listPublicCivicAccountabilitiesForInitiative(tracking.initiativeId);
  } catch {
    civicAccountability = [];
  }

  return (
    <main>
      <header>
        <h1>Implementation Tracking</h1>
        <p>Public execution journal</p>
      </header>

      <ProfileSection title="Tracking">
        <ProfileField label="Summary" value={tracking.summary} />
        <ProfileField label="Status" value={tracking.status} />
        <ProfileField label="Current stage" value={tracking.currentStage} />
        <ProfileField label="Author" value={tracking.authorDisplayName} />
        {tracking.activatedAt ? (
          <ProfileField label="Activated" value={formatDate(tracking.activatedAt)} />
        ) : null}
        {tracking.completedAt ? (
          <ProfileField label="Completed" value={formatDate(tracking.completedAt)} />
        ) : null}
        {tracking.archivedAt ? (
          <ProfileField label="Archived" value={formatDate(tracking.archivedAt)} />
        ) : null}
      </ProfileSection>

      {tracking.executionHistory.length > 0 ? (
        <ProfileSection title="Execution History">
          <ul>
            {tracking.executionHistory.map((update) => (
              <li key={update.updateId}>
                <h2>{update.title}</h2>
                <p>{update.summary}</p>
                <ProfileField label="Evidence" value={update.evidence} />
                {update.references.length > 0 ? (
                  <ProfileField label="References" value={update.references.join(", ")} />
                ) : null}
                <p>
                  {update.authorDisplayName} · {formatDate(update.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {publicImpacts.length > 0 ? (
        <ProfileSection title="Public Impact">
          <ul>
            {publicImpacts.map((impact) => (
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

      {officialResponses && officialResponses.responses.length > 0 ? (
        <ProfileSection title="Official Responses">
          <OfficialResponsesPublicSection responses={officialResponses.responses} />
        </ProfileSection>
      ) : null}

      {civicAccountability.length > 0 ? (
        <ProfileSection title="Civic Accountability">
          <CivicAccountabilityPublicSection records={civicAccountability} />
        </ProfileSection>
      ) : null}

      <nav aria-label="Platform integration">
        <Link href={`/initiatives/public/${encodeURIComponent(tracking.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link
          href={`/initiative-implementation-commitments/public/${encodeURIComponent(tracking.commitmentId)}`}
        >
          View Public Implementation Commitment
        </Link>
      </nav>

      <CivicIntegrationPanel entityType="implementation-tracking" entityId={trackingId} />

      <p>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
