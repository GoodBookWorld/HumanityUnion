import Link from "next/link";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { getCollaborativeAnalysisByInitiativeId } from "../../../features/collaborative-analysis/api";
import { getCollectiveDecisionById } from "../../../features/collective-decision/api";
import { getInitiativeById } from "../../../features/initiatives/api";
import { getPetitionById } from "../../../features/petition/api";
import { PetitionWorkspace } from "../../../features/petition/components/PetitionWorkspace";
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
}

export default async function PetitionPage({ params }: PetitionPageProps) {
  const { petitionId } = await params;
  let petition = null;

  try {
    petition = await getPetitionById(petitionId);
  } catch {
    petition = null;
  }

  if (!petition) {
    return (
      <main className="petition-page">
        <WorkspaceNavigation current="Initiatives" />
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

  return (
    <main className="petition-page">
      <MemberWorkspace
        title="Petition"
        subtitle="Public endorsement after collective decision"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Initiatives" />}
      >
        <PetitionWorkspace
          initialPetition={petition}
          collectiveDecision={collectiveDecision}
          initiative={initiative}
          collaborativeAnalysis={collaborativeAnalysis}
        />
      </MemberWorkspace>

      <nav className="petition-page__links" aria-label="Platform integration">
        <Link href="/initiatives">Initiative Workspace</Link>
        <Link href={`/collective-decisions/${encodeURIComponent(petition.collectiveDecisionId)}`}>
          Collective Decision Workspace
        </Link>
        <Link href={`/petitions/public/${encodeURIComponent(petition.petitionId)}`}>
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
      </nav>

      <p className="petition-page__back">
        <Link href="/initiatives">Back to Initiatives</Link>
      </p>
    </main>
  );
}
