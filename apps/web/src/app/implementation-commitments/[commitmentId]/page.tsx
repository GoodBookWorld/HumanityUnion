import Link from "next/link";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { getCollectiveDecisionById } from "../../../features/collective-decision/api";
import { getImplementationCommitmentById } from "../../../features/implementation-commitment/api";
import { ImplementationCommitmentWorkspace } from "../../../features/implementation-commitment/components/ImplementationCommitmentWorkspace";
import { ViewImplementationLink } from "../../../features/implementation/components/ViewImplementationLink";
import { getInitiativeById } from "../../../features/initiatives/api";
import { getPetitionById } from "../../../features/petition/api";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

import "../commitment-page.css";

const NAV_ITEMS = [
  "Initiative Context",
  "Current Implementation Readiness",
  "Community Capacity",
  "Frozen Policy",
  "Participant Commitment",
  "Contribution Profile",
  "Community Needs",
  "Next Meaningful Action",
  "Humanity Assistant",
  "Related Navigation",
];

interface ImplementationCommitmentPageProps {
  params: Promise<{
    commitmentId: string;
  }>;
}

export default async function ImplementationCommitmentPage({
  params,
}: ImplementationCommitmentPageProps) {
  const { commitmentId } = await params;
  let commitment = null;

  try {
    commitment = await getImplementationCommitmentById(commitmentId);
  } catch {
    commitment = null;
  }

  if (!commitment) {
    return (
      <main className="commitment-page">
        <WorkspaceNavigation current="Initiatives" />
        <h1>Implementation Commitment Workspace</h1>
        <p>Implementation Commitment is not available.</p>
        <p className="commitment-page__back">
          <Link href="/initiatives">Back to Initiatives</Link>
        </p>
      </main>
    );
  }

  let collectiveDecision = null;
  let initiative = null;
  let petition = null;

  try {
    collectiveDecision = await getCollectiveDecisionById(commitment.collectiveDecisionId);
  } catch {
    collectiveDecision = null;
  }

  try {
    initiative = await getInitiativeById(commitment.initiativeId);
  } catch {
    initiative = null;
  }

  try {
    petition = await getPetitionById(commitment.petitionId);
  } catch {
    petition = null;
  }

  return (
    <main className="commitment-page">
      <MemberWorkspace
        title="Implementation Commitment"
        subtitle="Declared preparedness and derived implementation readiness"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Initiatives" />}
      >
        <ImplementationCommitmentWorkspace
          initialCommitment={commitment}
          initiative={initiative}
          collectiveDecision={collectiveDecision}
          petition={petition}
        />
      </MemberWorkspace>

      <nav className="commitment-page__links" aria-label="Platform integration">
        <Link href="/initiatives">Initiative Workspace</Link>
        <Link href={`/collective-decisions/${encodeURIComponent(commitment.collectiveDecisionId)}`}>
          Collective Decision Workspace
        </Link>
        <Link href={`/petitions/${encodeURIComponent(commitment.petitionId)}`}>
          Petition Workspace
        </Link>
        <Link
          href={`/implementation-commitments/public/${encodeURIComponent(commitment.implementationCommitmentId)}`}
        >
          Public Implementation Commitment
        </Link>
        <Link href={`/initiatives/public/${encodeURIComponent(commitment.initiativeId)}`}>
          Public Initiative
        </Link>
        <Link
          href={`/collective-decisions/public/${encodeURIComponent(commitment.collectiveDecisionId)}`}
        >
          Public Collective Decision
        </Link>
        <Link href={`/petitions/public/${encodeURIComponent(commitment.petitionId)}`}>
          Public Petition
        </Link>
        <ViewImplementationLink
          implementationCommitmentId={commitment.implementationCommitmentId}
        />
        <ViewImplementationLink
          implementationCommitmentId={commitment.implementationCommitmentId}
          publicView
        />
      </nav>

      <p className="commitment-page__back">
        <Link href="/initiatives">Back to Initiatives</Link>
      </p>
    </main>
  );
}
