import Link from "next/link";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { getCollectiveDecisionById } from "../../../features/collective-decision/api";
import { getImplementationCommitmentById } from "../../../features/implementation-commitment/api";
import { getImplementationById } from "../../../features/implementation/api";
import { ImplementationWorkspace } from "../../../features/implementation/components/ImplementationWorkspace";
import { getInitiativeById } from "../../../features/initiatives/api";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";
import { getPetitionById } from "../../../features/petition/api";

import "../implementation-page.css";

const NAV_ITEMS = [
  "Initiative Context",
  "Implementation Status",
  "Collective Progress",
  "Current Phase",
  "Milestones",
  "Achievements",
  "Evidence",
  "Completion Assessment",
  "Next Meaningful Observation",
  "Humanity Assistant",
  "Related Navigation",
];

interface ImplementationPageProps {
  params: Promise<{
    implementationId: string;
  }>;
}

export default async function ImplementationPage({ params }: ImplementationPageProps) {
  const { implementationId } = await params;
  let implementation = null;

  try {
    implementation = await getImplementationById(implementationId);
  } catch {
    implementation = null;
  }

  if (!implementation) {
    return (
      <main className="implementation-page">
        <WorkspaceNavigation current="Initiatives" />
        <h1>Implementation Workspace</h1>
        <p>Implementation is not available.</p>
        <p className="implementation-page__back">
          <Link href="/initiatives">Back to Initiatives</Link>
        </p>
      </main>
    );
  }

  let collectiveDecision = null;
  let initiative = null;
  let petition = null;
  let commitment = null;

  try {
    collectiveDecision = await getCollectiveDecisionById(implementation.collectiveDecisionId);
  } catch {
    collectiveDecision = null;
  }

  try {
    initiative = await getInitiativeById(implementation.initiativeId);
  } catch {
    initiative = null;
  }

  try {
    petition = await getPetitionById(implementation.petitionId);
  } catch {
    petition = null;
  }

  try {
    commitment = await getImplementationCommitmentById(implementation.implementationCommitmentId);
  } catch {
    commitment = null;
  }

  return (
    <main className="implementation-page">
      <MemberWorkspace
        title="Implementation"
        subtitle="Collective execution progress and derived completion"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Initiatives" />}
      >
        <ImplementationWorkspace
          initialImplementation={implementation}
          initiative={initiative}
          collectiveDecision={collectiveDecision}
          petition={petition}
          commitment={commitment}
        />
      </MemberWorkspace>

      <nav className="implementation-page__links" aria-label="Platform integration">
        <Link href="/initiatives">Initiative Workspace</Link>
        <Link
          href={`/collective-decisions/${encodeURIComponent(implementation.collectiveDecisionId)}`}
        >
          Collective Decision Workspace
        </Link>
        <Link href={`/petitions/${encodeURIComponent(implementation.petitionId)}`}>
          Petition Workspace
        </Link>
        <Link
          href={`/implementation-commitments/${encodeURIComponent(implementation.implementationCommitmentId)}`}
        >
          Implementation Commitment Workspace
        </Link>
        <Link
          href={`/implementations/public/${encodeURIComponent(implementation.implementationId)}`}
        >
          Public Implementation
        </Link>
      </nav>

      <p className="implementation-page__back">
        <Link href="/initiatives">Back to Initiatives</Link>
      </p>
    </main>
  );
}
