import Link from "next/link";

import { getCollaborativeAnalysisByInitiativeId } from "../../../features/collaborative-analysis/api";
import { getCollectiveDecisionById } from "../../../features/collective-decision/api";
import { getInitiativeById } from "../../../features/initiatives/api";
import { getPetitionById } from "../../../features/petition/api";
import { getImplementationCommitmentByPetitionId } from "../../../features/implementation-commitment/api";
import { PetitionWorkspace } from "../../../features/petition/components/PetitionWorkspace";
import { PetitionDocumentViews } from "../../../features/initiative-petition-lifecycle/components/PetitionDocumentViews";
import {
  PETITION_VIEW_QUERY_PARAM,
  readPetitionDocumentView,
} from "../../../features/initiative-petition-lifecycle/petition-editing-workspace";
import { publicPetitionHref } from "../../../features/initiative-petition-lifecycle/petition-viewer-selection";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

import "../petition-page.css";

const NAV_ITEMS = [
  "Petition Status",
  "Petition Subject",
  "Decision Context",
  "Signature",
  "Support Metrics",
  "Petition Outcome",
  "Contribution Recognition",
  "Next Meaningful Action",
  "Related Links",
];

interface PetitionPageProps {
  params: Promise<{
    petitionId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PetitionPage({ params, searchParams }: PetitionPageProps) {
  const { petitionId } = await params;
  const initialView = readPetitionDocumentView((await searchParams)[PETITION_VIEW_QUERY_PARAM]);
  let petition = null;

  try {
    petition = await getPetitionById(petitionId);
  } catch {
    petition = null;
  }

  if (!petition) {
    return (
      <main className="petition-page humanity-workspace-page">
        <WorkspaceNavigation />
        <h1>Petition Workspace</h1>
        <p>Petition is not available.</p>
        <p className="petition-page__back">
          <Link href="/initiatives">Back to Initiatives</Link>
        </p>
      </main>
    );
  }

  let collectiveDecision = null;
  let initiative = null;
  let collaborativeAnalysis = null;

  try {
    collectiveDecision = await getCollectiveDecisionById(petition.collectiveDecisionId);
  } catch {
    collectiveDecision = null;
  }

  try {
    initiative = await getInitiativeById(petition.subject.initiativeId);
  } catch {
    initiative = null;
  }

  try {
    collaborativeAnalysis = await getCollaborativeAnalysisByInitiativeId(
      petition.subject.initiativeId,
    );
  } catch {
    collaborativeAnalysis = null;
  }

  let implementationCommitmentId: string | null = null;

  try {
    const commitment = await getImplementationCommitmentByPetitionId(petition.petitionId);
    implementationCommitmentId = commitment.implementationCommitmentId;
  } catch {
    implementationCommitmentId = null;
  }

  return (
    <main className="petition-page humanity-workspace-page">
      <PetitionDocumentViews
        petitionId={petition.petitionId}
        initiativeId={petition.subject.initiativeId}
        initialView={initialView}
        title="Petition"
        subtitle="Public endorsement after collective decision"
        statusNavItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <PetitionWorkspace
          initialPetition={petition}
          collectiveDecision={collectiveDecision}
          initiative={initiative}
          collaborativeAnalysis={collaborativeAnalysis}
        />
      </PetitionDocumentViews>

      <nav className="petition-page__links" aria-label="Platform integration">
        <Link href="/initiatives">Initiative Workspace</Link>
        <Link href={`/collective-decisions/${encodeURIComponent(petition.collectiveDecisionId)}`}>
          Collective Decision Workspace
        </Link>
        <Link href={publicPetitionHref(petition.subject.initiativeId, petition.petitionId)}>
          Public Petition
        </Link>
        <Link href={`/initiatives/public/${encodeURIComponent(petition.subject.initiativeId)}`}>
          Public Initiative
        </Link>
        <Link
          href={`/collective-decisions/public/${encodeURIComponent(petition.collectiveDecisionId)}`}
        >
          Public Collective Decision
        </Link>
        {implementationCommitmentId ? (
          <>
            <Link
              href={`/implementation-commitments/${encodeURIComponent(implementationCommitmentId)}`}
            >
              Implementation Commitment Workspace
            </Link>
            <Link
              href={`/implementation-commitments/public/${encodeURIComponent(implementationCommitmentId)}`}
            >
              Public Implementation Commitment
            </Link>
          </>
        ) : null}
      </nav>

      <p className="petition-page__back">
        <Link href="/initiatives">Back to Initiatives</Link>
      </p>
    </main>
  );
}
