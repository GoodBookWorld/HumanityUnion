import Link from "next/link";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { CivicIntegrationPanel } from "../../../features/capability02-integration/components/CivicIntegrationPanel";
import { getPublicCivicArchive } from "../../../features/public-civic-archive/api";

interface CivicArchiveDetailPageProps {
  params: Promise<{
    archiveRecordId: string;
  }>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function CivicArchiveDetailPage({ params }: CivicArchiveDetailPageProps) {
  const { archiveRecordId } = await params;
  const record = await getPublicCivicArchive(archiveRecordId);

  if (!record) {
    return (
      <main>
        <h1>Public Civic Archive</h1>
        <p>Archive record is not available.</p>
        <p>
          <Link href="/civic-archive">Back to Civic Archive</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <header>
        <h1>{record.title}</h1>
        <p>Humanity Union Public Civic Archive · Version {record.archivedVersion}</p>
      </header>

      <ProfileSection title="Archive Summary">
        <ProfileField label="Summary" value={record.summary} />
        <ProfileField label="Country" value={record.country} />
        <ProfileField label="Region" value={record.region} />
        <ProfileField label="Community" value={record.community} />
        <ProfileField label="Activity area" value={record.activityArea} />
        <ProfileField label="Participation scope" value={record.participationScope} />
        <ProfileField label="Implementation period" value={record.implementationPeriod} />
        <ProfileField label="Archived" value={formatDate(record.archivedAt)} />
        <ProfileField label="Author" value={record.authorDisplayName} />
        <ProfileField label="Steward" value={record.stewardDisplayName} />
      </ProfileSection>

      <ProfileSection title="Initiative Summary">
        <ProfileField label="Initiative summary" value={record.initiativeSummary} />
        <ProfileField label="Civic challenge" value={record.civicChallenge} />
      </ProfileSection>

      <ProfileSection title="Implementation Story">
        <ProfileField label="Story" value={record.implementationStory} />
      </ProfileSection>

      <ProfileSection title="Verified Public Impact">
        <ProfileField label="Observed impact" value={record.verifiedPublicImpact} />
      </ProfileSection>

      <ProfileSection title="Lessons Learned">
        <ProfileField label="What worked" value={record.lessonsLearned.whatWorked} />
        <ProfileField label="What did not work" value={record.lessonsLearned.whatDidNotWork} />
        <ProfileField
          label="Recommendations for future"
          value={record.lessonsLearned.recommendationsForFuture}
        />
        <ProfileField
          label="Transferable experience"
          value={record.lessonsLearned.transferableExperience}
        />
      </ProfileSection>

      <ProfileSection title="Knowledge Contribution">
        <ProfileField label="Social benefits" value={record.knowledgeContribution.socialBenefits} />
        <ProfileField
          label="Environmental benefits"
          value={record.knowledgeContribution.environmentalBenefits}
        />
        <ProfileField
          label="Economic benefits"
          value={record.knowledgeContribution.economicBenefits}
        />
        <ProfileField
          label="Governance benefits"
          value={record.knowledgeContribution.governanceBenefits}
        />
        <ProfileField
          label="Educational benefits"
          value={record.knowledgeContribution.educationalBenefits}
        />
        <ProfileField
          label="Additional observations"
          value={record.knowledgeContribution.additionalObservations}
        />
      </ProfileSection>

      <ProfileSection title="Historical Timeline">
        <ul>
          {record.historicalTimeline.map((entry) => (
            <li key={entry.eventId}>
              <strong>{entry.label}</strong> · {formatDate(entry.occurredAt)}
            </li>
          ))}
        </ul>
      </ProfileSection>

      <ProfileSection title="Related References">
        <ProfileField label="Initiative" value={record.references.initiativeId} />
        <ProfileField
          label="Initiative version"
          value={String(record.references.initiativeVersion)}
        />
        <ProfileField label="Collective decision" value={record.references.decisionId} />
        <ProfileField label="Implementation commitment" value={record.references.commitmentId} />
        <ProfileField label="Implementation tracking" value={record.references.trackingId} />
        <ProfileField label="Verified public impact" value={record.references.impactId} />
      </ProfileSection>

      <nav aria-label="Platform integration">
        <Link href={`/initiatives/public/${encodeURIComponent(record.initiativeId)}`}>
          View Public Initiative
        </Link>
        <Link href={`/public-impact/${encodeURIComponent(record.impactId)}`}>
          View Verified Public Impact
        </Link>
        <Link href="/civic-archive">Back to Civic Archive</Link>
      </nav>

      <CivicIntegrationPanel entityType="civic-archive" entityId={archiveRecordId} />
    </main>
  );
}
