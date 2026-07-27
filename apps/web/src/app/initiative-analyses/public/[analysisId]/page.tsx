import { getPublicInitiativeExperience } from "../../../../features/public-initiative-experience/api";
import { PublicInitiativeAnalysisExperiencePage } from "../../../../features/public-initiative-experience/components/PublicInitiativeAnalysisExperiencePage";
import { getPublicInitiativeAnalysis } from "../../../../features/initiative-collaborative-analysis/api";

interface PublicInitiativeAnalysisPageProps {
  params: Promise<{
    analysisId: string;
  }>;
}

async function loadAnalysisPageData(analysisId: string) {
  try {
    const analysis = await getPublicInitiativeAnalysis(analysisId);

    try {
      const experience = await getPublicInitiativeExperience(analysis.initiativeId);
      return { analysis, experience };
    } catch {
      return { analysis, experience: null };
    }
  } catch {
    return { analysis: null, experience: null };
  }
}

export default async function PublicInitiativeAnalysisPage({
  params,
}: PublicInitiativeAnalysisPageProps) {
  const { analysisId } = await params;
  const { analysis, experience } = await loadAnalysisPageData(analysisId);

  if (!analysis || !experience) {
    return (
      <main className="pie-page">
        <h1>Public Initiative Analysis</h1>
        <p>Public initiative analysis is not available.</p>
      </main>
    );
  }

  return <PublicInitiativeAnalysisExperiencePage experience={experience} analysis={analysis} />;
}
