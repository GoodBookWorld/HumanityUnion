import Link from "next/link";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicInitiativePublicImpact } from "../../../features/initiative-public-impact/api";
import { getPublicCivicArchiveForImpact } from "../../../features/public-civic-archive/api";

interface PublicImpactPageProps {
  params: Promise<{
    impactId: string;
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

export default async function PublicImpactPage({ params }: PublicImpactPageProps) {
  const { impactId } = await params;
  const impact = await getPublicInitiativePublicImpact(impactId);
  const archiveRecord =
    impact?.status === "verified" ? await getPublicCivicArchiveForImpact(impactId) : null;

  if (!impact) {
    return (
      <main>
        <h1>Public Impact</h1>
        <p>Public impact record is not available.</p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>{impact.title}</h1>
        <p>Public impact — observable societal outcome</p>
      </header>

      <ProfileSection title="Impact">
        <ProfileField label="Summary" value={impact.summary} />
        <ProfileField label="Observed impact" value={impact.observedImpact} />
        <ProfileField label="Affected community" value={impact.affectedCommunity} />
        <ProfileField label="Evidence summary" value={impact.evidenceSummary} />
        <ProfileField label="Status" value={impact.status} />
        <ProfileField label="Author" value={impact.authorDisplayName} />
        {impact.publishedAt ? (
          <ProfileField label="Published" value={formatDate(impact.publishedAt)} />
        ) : null}
        {impact.verifiedAt ? (
          <ProfileField label="Verified" value={formatDate(impact.verifiedAt)} />
        ) : null}
        {impact.archivedAt ? (
          <ProfileField label="Archived" value={formatDate(impact.archivedAt)} />
        ) : null}
      </ProfileSection>

      {impact.evidence.length > 0 ? (
        <ProfileSection title="Evidence">
          <ul>
            {impact.evidence.map((item) => (
              <li key={item.evidenceId}>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <ProfileField label="Reference type" value={item.referenceType} />
                {item.referenceUrl ? (
                  <ProfileField label="Reference URL" value={item.referenceUrl} />
                ) : null}
                <p>
                  {item.authorDisplayName} · {formatDate(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {archiveRecord ? (
        <ProfileSection title="Included in Humanity Union Civic Archive">
          <Link href={`/civic-archive/${encodeURIComponent(archiveRecord.archiveRecordId)}`}>
            Open Archive Record
          </Link>
        </ProfileSection>
      ) : null}

      <CivicIntegrationPanel entityType="public-impact" entityId={impactId} />

      <nav aria-label="Platform integration">
        <Link href={`/initiatives/public/${encodeURIComponent(impact.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link href={`/implementation-tracking/public/${encodeURIComponent(impact.trackingId)}`}>
          View Implementation Tracking
        </Link>
      </nav>

      <p>
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
