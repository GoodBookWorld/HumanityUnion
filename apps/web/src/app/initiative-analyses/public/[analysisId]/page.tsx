import { redirect } from "next/navigation";

import { getPublicInitiativeAnalysis } from "../../../../features/initiative-collaborative-analysis/api";

interface PublicInitiativeAnalysisPageProps {
  params: Promise<{
    analysisId: string;
  }>;
}

/**
 * Initiative Lifecycle — Part B, Section 0 (Mandatory Architectural
 * Rule): "no duplicate stage implementations". This standalone page
 * used to render its own full copy of the Analysis public result
 * (`PublicInitiativeAnalysisExperiencePage`) — now removed. Every
 * pre-existing deep link to this URL (proposal pages, decision-session
 * pages, the civic-activity aggregator) keeps working via a redirect to
 * the ONE canonical renderer: the Initiative's own public experience
 * page, scrolled to the Collaborative Analysis stage.
 */
export default async function PublicInitiativeAnalysisPage({
  params,
}: PublicInitiativeAnalysisPageProps) {
  const { analysisId } = await params;

  let initiativeId: string | null = null;

  try {
    const analysis = await getPublicInitiativeAnalysis(analysisId);
    initiativeId = analysis.initiativeId;
  } catch {
    initiativeId = null;
  }

  if (!initiativeId) {
    return (
      <main className="pie-page">
        <h1>Public Initiative Analysis</h1>
        <p>Public initiative analysis is not available.</p>
      </main>
    );
  }

  redirect(`/initiatives/public/${encodeURIComponent(initiativeId)}#collaborative-analysis`);
}
