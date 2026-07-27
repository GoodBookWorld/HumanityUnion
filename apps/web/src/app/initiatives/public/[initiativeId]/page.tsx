import Link from "next/link";

import { getPublicInitiativeExperience } from "../../../../features/public-initiative-experience/api";
import { PublicInitiativeExperiencePage } from "../../../../features/public-initiative-experience/components/PublicInitiativeExperiencePage";

interface PublicInitiativePageProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

async function loadExperience(initiativeId: string) {
  try {
    return await getPublicInitiativeExperience(initiativeId);
  } catch {
    return null;
  }
}

export default async function PublicInitiativePage({ params }: PublicInitiativePageProps) {
  const { initiativeId } = await params;
  const experience = await loadExperience(initiativeId);

  if (!experience) {
    return (
      <main className="pie-page">
        <h1>Public Initiative</h1>
        <p>Public initiative is not available.</p>
        <p>
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return <PublicInitiativeExperiencePage experience={experience} />;
}
