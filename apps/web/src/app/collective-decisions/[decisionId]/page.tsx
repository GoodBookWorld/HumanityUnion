import Link from "next/link";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { getCollaborativeAnalysisByInitiativeId } from "../../../features/collaborative-analysis/api";
import { getCollectiveDecisionById } from "../../../features/collective-decision/api";
import { CollectiveDecisionWorkspace } from "../../../features/collective-decision/components/CollectiveDecisionWorkspace";
import { getInitiativeById } from "../../../features/initiatives/api";
import { getPetitionByCollectiveDecisionId } from "../../../features/petition/api";
import { WorkspaceNavigation } from "../../../features/initiatives/components/WorkspaceNavigation";

import "../collective-decision-page.css";

const NAV_ITEMS = [
  "Decision Overview",
  "Decision Subject",
  "Analysis Summary",
  "Ballot",
  "Decision Panel",
  "Participation Statistics",
  "Decision Result",
  "Outcome",
  "Actions",
];

interface CollectiveDecisionPageProps {
  params: Promise<{
    decisionId: string;
  }>;
}

export default async function CollectiveDecisionPage({ params }: CollectiveDecisionPageProps) {
  const { decisionId } = await params;
  let decision = null;

  try {
    decision = await getCollectiveDecisionById(decisionId);
  } catch {
    decision = null;
  }

  if (!decision) {
    return (
      <main className="collective-decision-page">
        <WorkspaceNavigation current="Initiatives" />
        <h1>Collective Decision Workspace</h1>
        <p>Collective Decision is not available.</p>
        <p className="collective-decision-page__back">
          <Link href="/initiatives">Back to Initiatives</Link>
        </p>
      </main>
    );
  }

  let initiativeSubject = null;
  let linkedAnalysis = null;

  if (decision.decisionSubjectType === "Initiative") {
    try {
      initiativeSubject = await getInitiativeById(decision.decisionSubjectId);
    } catch {
      initiativeSubject = null;
    }

    try {
      linkedAnalysis = await getCollaborativeAnalysisByInitiativeId(decision.decisionSubjectId);
    } catch {
      linkedAnalysis = null;
    }
  }

  const linkedAnalysisId = linkedAnalysis?.analysisId ?? null;
  let linkedPetitionId: string | null = null;

  try {
    const linkedPetition = await getPetitionByCollectiveDecisionId(decisionId);
    linkedPetitionId = linkedPetition.petitionId;
  } catch {
    linkedPetitionId = null;
  }

  return (
    <main className="collective-decision-page">
      <MemberWorkspace
        title="Collective Decision"
        subtitle="Structured community decision-making"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Initiatives" />}
      >
        <CollectiveDecisionWorkspace
          initialDecision={decision}
          initiativeSubject={initiativeSubject}
          collaborativeAnalysis={
            linkedAnalysis
              ? {
                  summaries: linkedAnalysis.summaries,
                  readiness: linkedAnalysis.readiness,
                  progressPolicy: linkedAnalysis.progressPolicy,
                }
              : null
          }
        />
      </MemberWorkspace>

      <nav className="collective-decision-page__links" aria-label="Platform integration">
        <Link href="/initiatives">Initiative Workspace</Link>
        {linkedAnalysisId ? (
          <Link href={`/collaborative-analysis/${encodeURIComponent(linkedAnalysisId)}`}>
            Collaborative Analysis Workspace
          </Link>
        ) : null}
        <Link href={`/collective-decisions/public/${encodeURIComponent(decisionId)}`}>
          Public Collective Decision
        </Link>
        {decision.decisionSubjectType === "Initiative" ? (
          <Link href={`/initiatives/public/${encodeURIComponent(decision.decisionSubjectId)}`}>
            Public Initiative
          </Link>
        ) : null}
        {linkedAnalysisId ? (
          <Link href={`/collaborative-analysis/public/${encodeURIComponent(linkedAnalysisId)}`}>
            Public Collaborative Analysis
          </Link>
        ) : null}
        {linkedPetitionId ? (
          <>
            <Link href={`/petitions/${encodeURIComponent(linkedPetitionId)}`}>
              Petition Workspace
            </Link>
            <Link href={`/petitions/public/${encodeURIComponent(linkedPetitionId)}`}>
              Public Petition
            </Link>
          </>
        ) : null}
      </nav>

      <p className="collective-decision-page__back">
        <Link href="/initiatives">Back to Initiatives</Link>
      </p>
    </main>
  );
}
