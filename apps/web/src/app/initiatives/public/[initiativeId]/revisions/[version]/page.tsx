import Link from "next/link";

import { ProfileField } from "../../../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../../../components/member/ProfileSection";
import { getPublicInitiativeVersionRevision } from "../../../../../../features/initiative-version-revision/api";

import "./public-initiative-revision-page.css";

interface PublicInitiativeRevisionPageProps {
  params: Promise<{
    initiativeId: string;
    version: string;
  }>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicInitiativeRevisionPage({
  params,
}: PublicInitiativeRevisionPageProps) {
  const { initiativeId, version: versionParam } = await params;
  const version = Number.parseInt(versionParam, 10);
  let revision = null;

  if (Number.isFinite(version) && version >= 1) {
    try {
      revision = await getPublicInitiativeVersionRevision(initiativeId, version);
    } catch {
      revision = null;
    }
  }

  if (!revision) {
    return (
      <main className="public-initiative-revision-page">
        <h1>Initiative Revision</h1>
        <p>Initiative revision is not available.</p>
        <p className="public-initiative-revision-page__back">
          <Link href={`/initiatives/public/${encodeURIComponent(initiativeId)}`}>
            Back to Public Initiative
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="public-initiative-revision-page">
      <header className="public-initiative-revision-page__header">
        <h1 className="public-initiative-revision-page__title">
          Version {revision.version}
          {revision.isCurrent ? " (Current)" : ""}
        </h1>
        <p className="public-initiative-revision-page__subtitle">Initiative revision</p>
      </header>

      <ProfileSection title="Revision">
        <ProfileField label="Summary" value={revision.revisionSummary} />
        <ProfileField label="Title" value={revision.title} />
        <ProfileField label="Description" value={revision.description} />
        <ProfileField label="Author" value={revision.authorDisplayName} />
        <ProfileField label="Published" value={formatDate(revision.publishedAt)} />
        <ProfileField
          label="Accepted proposals used"
          value={
            revision.acceptedProposalIds.length + revision.partiallyAcceptedProposalIds.length > 0
              ? [...revision.acceptedProposalIds, ...revision.partiallyAcceptedProposalIds].join(
                  ", ",
                )
              : "None"
          }
        />
      </ProfileSection>

      <nav className="public-initiative-revision-page__related" aria-label="Related public records">
        <Link href={`/initiatives/public/${encodeURIComponent(initiativeId)}`}>
          View Public Initiative
        </Link>
      </nav>

      <p className="public-initiative-revision-page__back">
        <Link href={`/initiatives/public/${encodeURIComponent(initiativeId)}`}>
          Back to Public Initiative
        </Link>
      </p>
    </main>
  );
}
