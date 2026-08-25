import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getPublicPetition } from "../../../../features/petition/api";
import { buildUnavailablePublicMetadata } from "../../../../lib/seo/public-surface-copy";

interface PublicPetitionPageProps {
  params: Promise<{
    petitionId: string;
  }>;
}

/**
 * SEO Pack 10 — Strategy B (Initiative-owned Petition).
 * Legacy compatibility route: resolve + redirect only.
 * Not an independently indexable SEO document — no self-canonical, noindex.
 */
export async function generateMetadata({ params }: PublicPetitionPageProps): Promise<Metadata> {
  const { petitionId } = await params;

  try {
    const petition = await getPublicPetition(petitionId);
    const title = petition.petitionIdentity.title?.trim() || "Petition";
    return {
      title: `${title} | Humanity Union`,
      robots: { index: false, follow: false, nocache: true },
    };
  } catch {
    return buildUnavailablePublicMetadata("Petition not found | Humanity Union");
  }
}

/**
 * Phase 03 — LEGACY Stage-root petition URL. Compatibility redirect to the
 * canonical Initiative experience shell (#petition). Does not govern
 * lifecycle progression.
 *
 * SEO Pack 04 / 10 — No Petition JSON-LD. Crawlable document + Structured Data
 * live on the Initiative public page.
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
