import Link from "next/link";

import { ProfileField } from "../../../../components/member/ProfileField";
import { ProfileSection } from "../../../../components/member/ProfileSection";
import { getCollaborativeAnalysisByInitiativeId } from "../../../../features/collaborative-analysis/api";
import { getCollectiveDecisionByInitiativeId } from "../../../../features/collective-decision/api";
import { getPublicInitiative } from "../../../../features/initiatives/api";
import { listPublicInitiativeAnalyses } from "../../../../features/initiative-collaborative-analysis/api";
import { getPetitionByInitiativeId } from "../../../../features/petition/api";

import "./public-initiative-page.css";

interface PublicInitiativePageProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Not specified";
}

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PublicInitiativePage({ params }: PublicInitiativePageProps) {
  const { initiativeId } = await params;
  let initiative = null;
  let linkedAnalysisId: string | null = null;
  let linkedDecisionId: string | null = null;
  let linkedPetitionId: string | null = null;
  let publishedAnalyses: Awaited<ReturnType<typeof listPublicInitiativeAnalyses>> = [];

  try {
    initiative = await getPublicInitiative(initiativeId);
  } catch {
    initiative = null;
  }

  if (initiative) {
    try {
      publishedAnalyses = await listPublicInitiativeAnalyses(initiativeId);
    } catch {
      publishedAnalyses = [];
    }

    try {
      const analysis = await getCollaborativeAnalysisByInitiativeId(initiativeId);
      linkedAnalysisId = analysis.analysisId;
    } catch {
      linkedAnalysisId = null;
    }

    try {
      const decision = await getCollectiveDecisionByInitiativeId(initiativeId);
      linkedDecisionId = decision.decisionId;
    } catch {
      linkedDecisionId = null;
    }

    try {
      const petition = await getPetitionByInitiativeId(initiativeId);
      linkedPetitionId = petition.petitionId;
    } catch {
      linkedPetitionId = null;
    }
  }

  if (!initiative) {
    return (
      <main className="public-initiative-page">
        <h1>Public Initiative</h1>
        <p>Public initiative is not available.</p>
        <p className="public-initiative-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="public-initiative-page">
      <header className="public-initiative-page__header">
        <h1 className="public-initiative-page__title">{initiative.title}</h1>
        <p className="public-initiative-page__subtitle">Public initiative</p>
      </header>

      <ProfileSection title="Initiative">
        <ProfileField label="Description" value={initiative.description} />
        <ProfileField label="Status" value={initiative.status} />
        <ProfileField label="Category" value={initiative.metadata.category} />
        <ProfileField label="Tags" value={formatList(initiative.metadata.tags)} />
        <ProfileField label="Region" value={initiative.metadata.region} />
        <ProfileField label="Language" value={initiative.metadata.language} />
        <ProfileField label="Steward" value={initiative.stewardDisplayName} />
        <ProfileField label="Created" value={formatCreatedDate(initiative.createdAt)} />
      </ProfileSection>

      {publishedAnalyses.length > 0 ? (
        <ProfileSection title="Collaborative Analyses">
          <ul>
            {publishedAnalyses.map((analysis) => (
              <li key={analysis.analysisId}>
                <Link
                  href={`/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`}
                >
                  {analysis.title}
                </Link>
                <p>{analysis.summary}</p>
                <p>
                  {analysis.authorDisplayName} · {formatCreatedDate(analysis.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
        </ProfileSection>
      ) : null}

      {linkedAnalysisId || linkedDecisionId || linkedPetitionId ? (
        <nav className="public-initiative-page__related" aria-label="Platform integration">
          {linkedAnalysisId ? (
            <Link href={`/collaborative-analysis/public/${encodeURIComponent(linkedAnalysisId)}`}>
              View Public Collaborative Analysis
            </Link>
          ) : null}
          {linkedDecisionId ? (
            <Link href={`/collective-decisions/public/${encodeURIComponent(linkedDecisionId)}`}>
              View Public Collective Decision
            </Link>
          ) : null}
          {linkedPetitionId ? (
            <Link href={`/petitions/public/${encodeURIComponent(linkedPetitionId)}`}>
              View Public Petition
            </Link>
          ) : null}
        </nav>
      ) : null}

      <p className="public-initiative-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}
