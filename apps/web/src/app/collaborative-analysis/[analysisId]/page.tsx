import Link from "next/link";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { getCollaborativeAnalysisById } from "../../../features/collaborative-analysis/api";
import { CollaborativeAnalysisWorkspace } from "../../../features/collaborative-analysis/components/CollaborativeAnalysisWorkspace";
import { getCollectiveDecisionByInitiativeId } from "../../../features/collective-decision/api";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

import "../collaborative-analysis-page.css";

const NAV_ITEMS = [
  "Analysis Overview",
  "Readiness Dashboard",
  "Progress Policy",
  "Contribution Explorer",
  "Signal Overview",
  "Analysis Summary",
  "Actions",
];

interface CollaborativeAnalysisPageProps {
  params: Promise<{
    analysisId: string;
  }>;
}

export default async function CollaborativeAnalysisPage({
  params,
}: CollaborativeAnalysisPageProps) {
  const { analysisId } = await params;
  let analysis = null;

  try {
    analysis = await getCollaborativeAnalysisById(analysisId);
  } catch {
    analysis = null;
  }

  if (!analysis) {
    return (
      <main className="collaborative-analysis-page">
        <WorkspaceNavigation current="Initiatives" />
        <h1>Collaborative Analysis Workspace</h1>
        <p>Collaborative Analysis is not available.</p>
        <p className="collaborative-analysis-page__back">
          <Link href="/initiatives">Back to Initiatives</Link>
        </p>
      </main>
    );
  }

  let linkedDecisionId: string | null = null;

  try {
    const decision = await getCollectiveDecisionByInitiativeId(analysis.initiativeId);
    linkedDecisionId = decision.decisionId;
  } catch {
    linkedDecisionId = null;
  }

  return (
    <main className="collaborative-analysis-page">
      <MemberWorkspace
        title="Collaborative Analysis"
        subtitle="Analytical progress for an initiative"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Initiatives" />}
      >
        <CollaborativeAnalysisWorkspace
          analysis={analysis}
          initiativeTitle={analysis.initiativeId}
        />
      </MemberWorkspace>

      <nav className="collaborative-analysis-page__links" aria-label="Platform integration">
        <Link href="/initiatives">Initiative Workspace</Link>
        {linkedDecisionId ? (
          <Link href={`/collective-decisions/${encodeURIComponent(linkedDecisionId)}`}>
            Collective Decision Workspace
          </Link>
        ) : null}
        <Link href={`/collaborative-analysis/public/${encodeURIComponent(analysisId)}`}>
          Public Collaborative Analysis
        </Link>
        {linkedDecisionId ? (
          <Link href={`/collective-decisions/public/${encodeURIComponent(linkedDecisionId)}`}>
            Public Collective Decision
          </Link>
        ) : null}
        <Link href={`/initiatives/public/${encodeURIComponent(analysis.initiativeId)}`}>
          Public Initiative
        </Link>
      </nav>

      <p className="collaborative-analysis-page__back">
        <Link href="/initiatives">Back to Initiatives</Link>
      </p>
    </main>
  );
}
