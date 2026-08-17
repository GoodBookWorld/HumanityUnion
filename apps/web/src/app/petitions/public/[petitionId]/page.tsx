import { redirect } from "next/navigation";

import { getPublicPetition } from "../../../../features/petition/api";

interface PublicPetitionPageProps {
  params: Promise<{
    petitionId: string;
  }>;
}

/**
 * Phase 03 — LEGACY Stage-root petition URL. Compatibility redirect to the
 * canonical Initiative experience shell (#petition). Does not govern
 * lifecycle progression.
 */
export default async function PublicPetitionPage({ params }: PublicPetitionPageProps) {
  const { petitionId } = await params;

  let initiativeId: string | null = null;

  try {
    const petition = await getPublicPetition(petitionId);
    initiativeId = petition.petitionSubject.initiativeId;
  } catch {
    initiativeId = null;
  }

  if (!initiativeId) {
    return (
      <main className="public-petition-page">
        <h1>Public Petition</h1>
        <p>Public petition is not available.</p>
      </main>
    );
  }

  redirect(`/initiatives/public/${encodeURIComponent(initiativeId)}#petition`);
}
